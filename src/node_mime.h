#ifndef SRC_NODE_MIME_H_
#define SRC_NODE_MIME_H_

#if defined(NODE_WANT_INTERNALS) && NODE_WANT_INTERNALS

#include <string>
#include <vector>
#include <utility>
#include "v8.h"
#include "env.h"
#include "base_object-inl.h"

namespace node {
namespace mime {

enum mime_flags {
  MIME_FLAGS_NONE = 0x00,
  MIME_FLAGS_INVALID_TYPE = 0x01,
  MIME_FLAGS_INVALID_SUBTYPE = 0x02,
};


class MIME {
 public:
  explicit MIME(std::string src);

  MIME(const MIME&) = default;
  MIME& operator=(const MIME&) = default;
  MIME(MIME&&) = default;
  MIME& operator=(MIME&&) = default;

  int32_t flags_ = mime_flags::MIME_FLAGS_NONE;
  std::string type_;
  std::string subtype_;
  std::vector<std::pair<std::string, std::string>> parameters_;
};

class MIMEParser {
 public:
  static void Parse(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Initialize(v8::Local<v8::Object> target,
                         v8::Local<v8::Value> unused,
                         v8::Local<v8::Context> context);
};

}  // namespace mime

}  // namespace node

#endif  // defined(NODE_WANT_INTERNALS) && NODE_WANT_INTERNALS

#endif  // SRC_NODE_MIME_H_
