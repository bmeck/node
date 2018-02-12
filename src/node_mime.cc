#include <string>
#include "./node_mime.h"
namespace node {

namespace mime {

namespace {

bool is_ascii_upper_alpha(char c) {
  return c >= '\x41' && c <= '\x5A';
}
bool is_ascii_lower_alpha(char c) {
  return c >= '\x61' && c <= '\x7A';
}
bool is_ascii_digit(char c) {
  return c >= '\x30' && c <= '\x39';
}
bool is_ascii_alpha(char c) {
  return is_ascii_upper_alpha(c) || is_ascii_lower_alpha(c);
}
bool is_ascii_alphanumeric(char c) {
  return is_ascii_digit(c) || is_ascii_alpha(c);
}
char to_ascii_lower(char c) {
  if (!is_ascii_upper_alpha(c)) return c;
  return c - 0x20;
}
bool is_http_token(char c) {
  return c == '\x21' ||
      c == '\x23' ||
      c == '\x24' ||
      c == '\x25' ||
      c == '\x26' ||
      c == '\x27' ||
      c == '\x2A' ||
      c == '\x2B' ||
      c == '\x2D' ||
      c == '\x2E' ||
      c == '\x5E' ||
      c == '\x5F' ||
      c == '\x60' ||
      c == '\x7C' ||
      c == '\x7E' ||
      is_ascii_alphanumeric(c);
}
bool is_ascii_whitespace(char c) {
  return c == '\x09' ||
      c == '\x0A' ||
      c == '\x0C' ||
      c == '\x0D' ||
      c == '\x20';
}
bool is_http_quoted_string_token(char c) {
  return c == '\x09' || (c >= '\x20' && c <= '\x7E') || (c >= '\x80' && c <= '\xFF');
}

} // anonymous namespace

MIME::MIME(std::string src) {
  size_t left = 0;
  auto saw_invalid_char = false;
  size_t first_invalid_char = 0;
  for (; left < src.size(); left++) {
    auto c = src[left];
    if (!is_ascii_whitespace(c)) break;
  }
  std::string& type = context_.type;
  std::string& subtype = context_.subtype;
  std::map<std::string, std::string>& parameters = context_.parameters;
  size_t right = left;
  for (; right < src.size(); right++) {
    auto c = src[right];
    if (c == '/') {
      if (left == right || right >= src.size() || saw_invalid_char) {
        this->context_.flags |= MIME_FLAGS_INVALID_TYPE;
        return;
      }
      type = src.substr(left, right - left);
      break;
    } else if (!saw_invalid_char && !is_http_token(c)) {
      saw_invalid_char = true;
      first_invalid_char = right;
    }
  }
  saw_invalid_char = false;
  right++;
  left = right;
  for (; right < src.size(); right++) {
    auto c = src[right];
    if (c == ';') {
      if (left == right) {
        this->context_.flags |= MIME_FLAGS_INVALID_SUBTYPE;
        return;
      }
      break;
    } else if (!saw_invalid_char && !is_http_token(c)) {
      saw_invalid_char = true;
      first_invalid_char = right;
    }
  }
  {
    auto trim_right = right;
    while (is_ascii_whitespace(src[trim_right - 1])) {
      trim_right--;
    }
    if (saw_invalid_char && first_invalid_char < trim_right) {
      this->context_.flags |= MIME_FLAGS_INVALID_SUBTYPE;
      return;
    }
    subtype = src.substr(left, trim_right - left);
  }
  std::transform(type.begin(), type.end(), type.begin(), to_ascii_lower);
  std::transform(subtype.begin(), subtype.end(), subtype.begin(), to_ascii_lower);
  while (right <= src.size()) {
    right++; // ;
    for (; right < src.size(); right++) {
      auto c = src[right];
      if (!is_ascii_whitespace(c)) break;
    }
    left = right;
    saw_invalid_char = false;
    for (; right < src.size(); right++) {
      auto c = src[right];
      if (c == ';'|| c == '=') {
        break;
      } else if (!is_http_token(c)) {
        saw_invalid_char = true;
      }
    }
    std::string parameterName;
    if (right < src.size()) {
      if (!saw_invalid_char) {
        parameterName = src.substr(left, right - left);
        std::transform(parameterName.begin(), parameterName.end(), parameterName.begin(), to_ascii_lower);
      }
      if (src[right] == ';') {
        continue;
      }
      right++; // =
      left = right;
    }
    bool saw_invalid_value = false;
    std::string parameterValue;
    if (right < src.size()) {
      if (src[right] == '"') {
        right++;
        while (true) {
          left = right;
          for (; right < src.size(); right++) {
            auto c = src[right];
            if (c == '"' || c == '\\') {
              break;
            } else if (!is_http_quoted_string_token(c)) {
              saw_invalid_value = true;
            }
          }
          parameterValue += src.substr(left, right - left);
          if (right < src.size() && src[right] == '\\') {
            right++;
            if (right < src.size()) {
              parameterValue += src[right];
              right++;
              continue;
            } else {
              parameterValue += '\\';
              break;
            }
          } else {
            break;
          }
        }
        for (; right < src.size(); right++) {
          auto c = src[right];
          if (c == ';') {
            break;
          }
        }
      } else {
        for (; right < src.size(); right++) {
          auto c = src[right];
          if (c == ';') {
            break;
          } else if (!saw_invalid_char && !is_http_quoted_string_token(c)) {
            saw_invalid_char = true;
            first_invalid_char = right;
          }
        }
        {
          auto trim_right = right;
          while (is_ascii_whitespace(src[trim_right - 1])) {
            trim_right--;
          }
          if (!saw_invalid_char || first_invalid_char >= trim_right) {
            parameterValue = src.substr(left, trim_right - left);
          }
        }
      }
    }
    if (parameterName.size() > 0 &&
        parameterValue.size() > 0 &&
        !saw_invalid_value && parameters.count(parameterName) == 0) {
      parameters[parameterName] = parameterValue;
    }
  }
}

}

}
