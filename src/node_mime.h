#ifndef SRC_NODE_MIME_H_
#define SRC_NODE_MIME_H_

#if defined(NODE_WANT_INTERNALS) && NODE_WANT_INTERNALS

#include <string>
#include <map>
#include <utility>

namespace node {
namespace mime {

enum mime_flags {
  MIME_FLAGS_NONE = 0x00,
  MIME_FLAGS_INVALID_TYPE = 0x01,
  MIME_FLAGS_INVALID_SUBTYPE = 0x02,
};

struct mime_data {
  int32_t flags = mime_flags::MIME_FLAGS_NONE;
  std::string type;
  std::string subtype;
  std::map<std::string, std::string> parameters;
};

class MIME {
  public:
  MIME(std::string src);

  int32_t flags() const {
    return context_.flags;
  }

  const std::string& type() const {
    return context_.type;
  }

  const std::string& subtype() const {
    return context_.subtype;
  }

  static const std::string MISSING_PARAMETER;
  const std::string& parameter(std::string name) const {
    auto entry = context_.parameters.find(name);
    if (entry != context_.parameters.end()) {
      return entry->second;
    }
    return MISSING_PARAMETER;
  }

  const std::string to_string() const {
    std::string result;
    if (context_.flags != MIME_FLAGS_NONE) {
      return result;
    }
    result += type() + '/' + subtype();
    for (std::pair<std::string, std::string> element : context_.parameters) {
      result += ';' + element.first + '=' + element.second;
    }
    return result;
  }

  MIME(const MIME&) = default;
  MIME& operator=(const MIME&) = default;
  MIME(MIME&&) = default;
  MIME& operator=(MIME&&) = default;

  private:
  mime_data context_;
};

} // namespace mime

} // namespace node

#endif  // defined(NODE_WANT_INTERNALS) && NODE_WANT_INTERNALS

#endif  // SRC_NODE_MIME_H_
