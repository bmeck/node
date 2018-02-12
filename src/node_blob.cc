#include <map>
#include <string>
#include "node_mime.h"
#include "node_crypto.h"
#include "uv.h"

namespace node {
namespace blob {

namespace {
// FROM inspector_io.cc
// UUID RFC: https://www.ietf.org/rfc/rfc4122.txt
// Used ver 4 - with numbers
std::string GenerateID() {
  uint16_t buffer[8];
  CHECK(crypto::EntropySource(reinterpret_cast<unsigned char*>(buffer),
                              sizeof(buffer)));

  char uuid[256];
  snprintf(uuid, sizeof(uuid), "%04x%04x-%04x-%04x-%04x-%04x%04x%04x",
           buffer[0],  // time_low
           buffer[1],  // time_mid
           buffer[2],  // time_low
           (buffer[3] & 0x0fff) | 0x4000,  // time_hi_and_version
           (buffer[4] & 0x3fff) | 0x8000,  // clk_seq_hi clk_seq_low
           buffer[5],  // node
           buffer[6],
           buffer[7]);
  return uuid;
}

} // anonymous namespace

using node::mime::MIME;
struct Blob {
  MIME mime_;
  uv_buf_t body_;
  public:
  Blob(MIME mime, uv_buf_t body) : mime_(mime), body_(body) {}
  const MIME mime() const {
    return mime_;
  }
  const uv_buf_t body() const {
    return body_;
  }
};

class BlobStore {
  std::map<std::string, Blob> resources;

  std::string add(Blob& blob) {
    while (true) {
      auto id = GenerateID();
      auto origin = "null";
      const std::string url = "blob:" + (origin + ("/" + id));
      if (resources.count(url) > 0) {
        continue;
      }
      resources.insert(std::pair<std::string, Blob>(url, blob));
      return url;
    }
  }

  static const Blob MISSING_BLOB;
  const Blob& get(std::string url) const {
    auto entry = resources.find(url);
    if (entry != resources.end()) {
      return entry->second;
    }
    return MISSING_BLOB;
  }

  bool erase(std::string url) {
    return resources.erase(url) != 0;
  }
};

using v8::Local;
using v8::Object;
using v8::Value;
using v8::Context;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::FunctionTemplate;

void BlobWrap(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);

  Isolate* isolate = args.GetIsolate();
  if (!args[0]->IsUint8Array()) {
    env->ThrowError("first argument is not a Uint8Array");
    return;
  }
  MIME type("");
  if (!args[1]->IsUndefined()) {
    if (!args[1]->IsObject()) {
      env->ThrowError("second argument is not an Object");
      return;
    }
  } else {
    auto options = args[2]->ToObject();
    auto prop = options->Get(FIXED_ONE_BYTE_STRING(isolate, "type"));
    v8::String::Utf8Value utf(prop);
    type = MIME(std::string(*utf));
  }
}

void Initialize(Local<Object> target,
                          Local<Value> unused,
                          Local<Context> context) {
  Environment* env = Environment::GetCurrent(context);
  Isolate* isolate = context->GetIsolate();
  Local<FunctionTemplate> tpl = env->NewFunctionTemplate(BlobWrap);
  tpl->SetClassName(FIXED_ONE_BYTE_STRING(isolate, "Blob"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  
}

} // namespace blob

} // namespace node

NODE_MODULE_CONTEXT_AWARE_INTERNAL(blob_wrap,
                                   node::blob::Initialize)