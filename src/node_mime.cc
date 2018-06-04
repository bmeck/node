#include <string>
#include "node.h"
#include "env.h"
#include "node_mime.h"
#include "node_internals.h"
namespace node {

namespace mime {

using v8::Array;
using v8::Context;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::FunctionTemplate;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;


// utilities for
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
  return c + 0x20;
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
  return c == '\x09' ||
      (c >= '\x20' && c <= '\x7E') ||
      (c >= '\x80' && c <= '\xFF');
}

}   // anonymous namespace

MIME::MIME(std::string src) {
  size_t left = 0;
  auto saw_invalid_char = false;
  size_t first_invalid_char = 0;
  for (; left < src.size(); left++) {
    auto c = src[left];
    if (!is_ascii_whitespace(c)) break;
  }
  std::string& type = type_;
  std::string& subtype = subtype_;
  auto& parameters = parameters_;
  size_t right = left;
  for (; right < src.size(); right++) {
    auto c = src[right];
    if (c == '/') {
      if (left == right || right >= src.size() || saw_invalid_char) {
        this->flags_ |= MIME_FLAGS_INVALID_TYPE;
        return;
      }
      type = src.substr(left, right - left);
      break;
    } else if (!saw_invalid_char && !is_http_token(c)) {
      saw_invalid_char = true;
      first_invalid_char = right;
    }
  }
  if (type.size() == 0) {
    this->flags_ |= MIME_FLAGS_INVALID_TYPE;
    return;
  }
  saw_invalid_char = false;
  right++;
  left = right;
  for (; right < src.size(); right++) {
    auto c = src[right];
    if (c == ';') {
      if (left == right) {
        this->flags_ |= MIME_FLAGS_INVALID_SUBTYPE;
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
    while (trim_right > left) {
      if (is_ascii_whitespace(src[trim_right - 1])) {
        trim_right--;
      } else {
        subtype = src.substr(left, trim_right - left);
        break;
      }
    }
    if (saw_invalid_char && first_invalid_char < trim_right) {
      this->flags_ |= MIME_FLAGS_INVALID_SUBTYPE;
      return;
    }
  }
  if (subtype.size() == 0) {
    this->flags_ |= MIME_FLAGS_INVALID_SUBTYPE;
    return;
  }
  std::transform(type.begin(), type.end(), type.begin(), to_ascii_lower);
  std::transform(subtype.begin(),
                  subtype.end(),
                  subtype.begin(),
                  to_ascii_lower);
  while (right <= src.size()) {
    right++;   // ;
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
        std::transform(parameterName.begin(),
                        parameterName.end(),
                        parameterName.begin(),
                        to_ascii_lower);
      }
      if (src[right] == ';') {
        continue;
      }
      right++;   // =
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
          } else {
            auto is_2_byte = (c & (unsigned char)0xE0) == 0xC0;
            auto is_3_byte = (c & (unsigned char)0xF0) == 0xE0;
            auto is_4_byte = (c & (unsigned char)0xF8) == 0xF0;
            bool is_invalid = false;
            if (is_2_byte) {
              // need 2 bits of FF
              if ((c & (unsigned char)0x1C) != 0) {
                is_invalid = true;
                right += 1;
              } else {
                right += 1;
                if (right < src.size()) {
                  c = src[right];
                  if ((c & 0xC0) != 0x80) {
                    is_invalid = true;
                  }
                } else {
                  is_invalid = true;
                }
              }
            } else if (is_3_byte) {
              is_invalid = true;
              right += 2;
            } else if (is_4_byte) {
              is_invalid = true;
              right += 3;
            } else if (!is_http_quoted_string_token(c)) {
              is_invalid = true;
            }
            if (is_invalid && !saw_invalid_char) {
              saw_invalid_value = true;
              first_invalid_char = right;
            }
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
        !saw_invalid_value) {
      parameters.push_back(std::pair<std::string, std::string>(
          parameterName,
          parameterValue));
    }
  }
}


void MIMEParser::Parse(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  auto context = env->context();

  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);

  if (args.IsConstructCall()) {
    env->ThrowError("parse() must not be called using new");
    return;
  }

  if (!args[0]->IsString()) {
    env->ThrowError("first argument is not a string");
    return;
  }
  if (!args[1]->IsObject()) {
    env->ThrowError("second argument is not an object");
    return;
  }

  auto that = args[1]->ToObject();

  Local<String> string = args[0].As<String>();
  v8::String::Utf8Value source(isolate, string);

  MIME mime(std::string(*source, source.length()));

  if (mime.flags_ != mime_flags::MIME_FLAGS_NONE) {
    env->ThrowError("Error parsing MIME");
    return;
  }

  auto type_key = FIXED_ONE_BYTE_STRING(isolate, "type");
  auto subtype_key = FIXED_ONE_BYTE_STRING(isolate, "subtype");
  auto parameters_key = FIXED_ONE_BYTE_STRING(isolate, "parameters");
  Local<String> type =
      String::NewFromUtf8(isolate,
                          mime.type_.c_str(),
                          v8::NewStringType::kInternalized,
                          mime.type_.length()).ToLocalChecked();
  Local<String> subtype =
      String::NewFromUtf8(isolate,
                          mime.subtype_.c_str(),
                          v8::NewStringType::kInternalized,
                          mime.subtype_.length()).ToLocalChecked();
  that->Set(type_key, type);
  that->Set(subtype_key, subtype);

  auto parameters = Array::New(isolate, mime.parameters_.size());
  auto i = 0;
  for (auto pair : mime.parameters_) {
    auto key_str = pair.first;
    auto value_str = pair.second;
    auto key =
        String::NewFromUtf8(isolate,
                            key_str.c_str(),
                            v8::NewStringType::kInternalized,
                            key_str.length()).ToLocalChecked();
    auto value =
        String::NewFromUtf8(isolate,
                            value_str.c_str(),
                            v8::NewStringType::kInternalized,
                            value_str.length()).ToLocalChecked();
    auto pair_arr = Array::New(isolate, 2);
    pair_arr->Set(context, 0, key);
    pair_arr->Set(context, 1, value);
    parameters->Set(context, i, pair_arr);
    i++;
  }
  that->Set(parameters_key, parameters);

  args.GetReturnValue().Set(that);
}

void MIMEParser::Initialize(Local<Object> target,
                            Local<Value> unused,
                            Local<Context> context) {
  Environment* env = Environment::GetCurrent(context);
  Isolate* isolate = env->isolate();

  Local<FunctionTemplate> tpl = env->NewFunctionTemplate(Parse);
  tpl->SetClassName(FIXED_ONE_BYTE_STRING(isolate, "MimeParser"));
  target->Set(FIXED_ONE_BYTE_STRING(isolate, "parse"), tpl->GetFunction());
}

}  // namespace mime

}  // namespace node

NODE_MODULE_CONTEXT_AWARE_INTERNAL(mime_wrap,
                                   node::mime::MIMEParser::Initialize);
