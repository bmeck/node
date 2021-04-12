#include "snapshot_builder.h"
#include <iostream>
#include <sstream>
#include "debug_utils-inl.h"
#include "env-inl.h"
#include "node_external_reference.h"
#include "node_internals.h"
#include "node_main_instance.h"
#include "node_snapshotable.h"
#include "node_v8_platform-inl.h"

namespace node {

using v8::Context;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::SnapshotCreator;
using v8::StartupData;
using v8::String;
using v8::TryCatch;
using v8::Value;

template <typename T>
void WriteVector(std::stringstream* ss, const T* vec, size_t size) {
  for (size_t i = 0; i < size; i++) {
    *ss << std::to_string(vec[i]) << (i == size - 1 ? '\n' : ',');
  }
}

std::string FormatBlob(StartupData* blob,
                       const std::vector<size_t>& isolate_data_indexes,
                       const EnvSerializeInfo& env_info) {
  std::stringstream ss;

  ss << R"(#include <cstddef>
#include "env.h"
#include "node_main_instance.h"
#include "v8.h"

// This file is generated by tools/snapshot. Do not edit.

namespace node {

static const char blob_data[] = {
)";
  WriteVector(&ss, blob->data, blob->raw_size);
  ss << R"(};

static const int blob_size = )"
     << blob->raw_size << R"(;
static v8::StartupData blob = { blob_data, blob_size };
)";

  ss << R"(v8::StartupData* NodeMainInstance::GetEmbeddedSnapshotBlob() {
  return &blob;
}

static const std::vector<size_t> isolate_data_indexes {
)";
  WriteVector(&ss, isolate_data_indexes.data(), isolate_data_indexes.size());
  ss << R"(};

const std::vector<size_t>* NodeMainInstance::GetIsolateDataIndexes() {
  return &isolate_data_indexes;
}

static const EnvSerializeInfo env_info )"
     << env_info << R"(;

const EnvSerializeInfo* NodeMainInstance::GetEnvSerializeInfo() {
  return &env_info;
}

}  // namespace node
)";

  return ss.str();
}

std::string SnapshotBuilder::Generate(
    const std::vector<std::string> args,
    const std::vector<std::string> exec_args) {
  Isolate* isolate = Isolate::Allocate();
  isolate->SetCaptureStackTraceForUncaughtExceptions(
    true,
    10,
    v8::StackTrace::StackTraceOptions::kDetailed);
  per_process::v8_platform.Platform()->RegisterIsolate(isolate,
                                                       uv_default_loop());
  std::unique_ptr<NodeMainInstance> main_instance;
  std::string result;

  {
    std::vector<size_t> isolate_data_indexes;
    EnvSerializeInfo env_info;

    const std::vector<intptr_t>& external_references =
        NodeMainInstance::CollectExternalReferences();
    SnapshotCreator creator(isolate, external_references.data());
    Environment* env;
    {
      main_instance =
          NodeMainInstance::Create(isolate,
                                   uv_default_loop(),
                                   per_process::v8_platform.Platform(),
                                   args,
                                   exec_args);

      HandleScope scope(isolate);
      creator.SetDefaultContext(Context::New(isolate));
      isolate_data_indexes = main_instance->isolate_data()->Serialize(&creator);
      // fprintf(stderr, "BOOTSTRAPPING2\n\n\n");

      TryCatch bootstrapCatch(isolate);
      Local<Context> context = NewContext(isolate);
      if (bootstrapCatch.HasCaught()) {
        Local<Object> obj = bootstrapCatch.Exception()->ToObject(context)
            .ToLocalChecked();
        Local<Value> stack = obj->Get(
            context,
            FIXED_ONE_BYTE_STRING(isolate, "stack")).ToLocalChecked();
        if (stack->IsUndefined()) {
          Local<String> str = obj->Get(
              context,
              FIXED_ONE_BYTE_STRING(isolate, "name"))
            .ToLocalChecked()->ToString(context).ToLocalChecked();
          str = String::Concat(
            isolate,
            str,
            FIXED_ONE_BYTE_STRING(isolate, ": "));
          stack = String::Concat(
            isolate,
            str,
            obj->Get(
                context,
                FIXED_ONE_BYTE_STRING(isolate, "message"))
              .ToLocalChecked()->ToString(context).ToLocalChecked());
        }
        v8::String::Utf8Value utf8_value(isolate, stack);
        if (*utf8_value != nullptr) {
          std::string out(*utf8_value, utf8_value.length());
          fprintf(stderr, "Had Exception: %s\n", out.c_str());
        } else {
          fprintf(stderr, "Unknown JS Exception\n");
        }
        abort();
      }
      Context::Scope context_scope(context);

      env = new Environment(main_instance->isolate_data(),
                            context,
                            args,
                            exec_args,
                            nullptr,
                            node::EnvironmentFlags::kDefaultFlags,
                            {});
      env->RunBootstrapping().ToLocalChecked();
      if (per_process::enabled_debug_list.enabled(DebugCategory::MKSNAPSHOT)) {
        env->PrintAllBaseObjects();
        printf("Environment = %p\n", env);
      }
      env_info = env->Serialize(&creator);
      size_t index = creator.AddContext(
          context, {SerializeNodeContextInternalFields, env});
      CHECK_EQ(index, NodeMainInstance::kNodeContextIndex);
    }

    // Must be out of HandleScope
    StartupData blob =
        creator.CreateBlob(SnapshotCreator::FunctionCodeHandling::kClear);
    CHECK(blob.CanBeRehashed());
    // Must be done while the snapshot creator isolate is entered i.e. the
    // creator is still alive.
    FreeEnvironment(env);
    main_instance->Dispose();
    result = FormatBlob(&blob, isolate_data_indexes, env_info);
    delete[] blob.data;
  }

  per_process::v8_platform.Platform()->UnregisterIsolate(isolate);
  return result;
}
}  // namespace node
