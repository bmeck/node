#include <string>
#include "env.h"
#include "node.h"
#include "node_mime.h"
#include "node_internals.h"
#include "util-inl.h"

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


namespace {

bool is_ascii_upper_alpha(char c) {
  return c >= 'A' && c <= 'Z';
}

bool is_ascii_lower_alpha(char c) {
  return c >= 'a' && c <= 'z';
}

bool is_ascii_digit(char c) {
  return c >= '0' && c <= '9';
}

bool is_ascii_alpha(char c) {
  return is_ascii_upper_alpha(c) || is_ascii_lower_alpha(c);
}

bool is_ascii_alphanumeric(char c) {
  return is_ascii_digit(c) || is_ascii_alpha(c);
}

bool is_http_token(char c) {
  return c == '!' ||
      c == '#' ||
      c == '$' ||
      c == '%' ||
      c == '&' ||
      c == '\'' ||
      c == '*' ||
      c == '+' ||
      c == '-' ||
      c == '.' ||
      c == '^' ||
      c == '_' ||
      c == '`' ||
      c == '|' ||
      c == '~' ||
      is_ascii_alphanumeric(c);
}

bool is_ascii_whitespace(char c) {
  return c == '\t' ||
      c == '\n' ||
      c == '\f' ||
      c == '\r' ||
      c == ' ';
}

bool is_http_quoted_string_token(char c) {
  return c == '\t' ||
      (c >= ' ' && c <= '\x7E') ||
      (c >= '\x80' && c <= '\xFF');
}

}   // anonymous namespace

MIME::MIME(const char* source, size_t length) {
  size_t left = 0;
  bool saw_invalid_char = false;
  size_t first_invalid_char = 0;
  for (; left < length; left++) {
    char c = source[left];
    if (!is_ascii_whitespace(c)) break;
  }
  size_t right = left;
  for (; right < length; right++) {
    char c = source[right];
    if (c == '/') {
      if (left == right || right >= length || saw_invalid_char) {
        flags_ |= MIME_FLAGS_INVALID_TYPE;
        return;
      }
      type_.assign(const_cast<char*>(source + left), right - left);
      break;
    } else if (!saw_invalid_char && !is_http_token(c)) {
      saw_invalid_char = true;
      first_invalid_char = right;
    }
  }
  if (type_.empty()) {
    flags_ |= MIME_FLAGS_INVALID_TYPE;
    return;
  }
  saw_invalid_char = false;
  right++;
  left = right;
  for (; right < length; right++) {
    char c = source[right];
    if (c == ';') {
      if (left == right) {
        flags_ |= MIME_FLAGS_INVALID_SUBTYPE;
        return;
      }
      break;
    } else if (!saw_invalid_char && !is_http_token(c)) {
      saw_invalid_char = true;
      first_invalid_char = right;
    }
  }
  {
    size_t trim_right = right;
    while (trim_right > left) {
      if (is_ascii_whitespace(source[trim_right - 1])) {
        trim_right--;
      } else {
        subtype_.assign(const_cast<char*>(source + left), trim_right - left);
        break;
      }
    }
    if (saw_invalid_char && first_invalid_char < trim_right) {
      flags_ |= MIME_FLAGS_INVALID_SUBTYPE;
      return;
    }
  }
  if (subtype_.empty()) {
    flags_ |= MIME_FLAGS_INVALID_SUBTYPE;
    return;
  }
  std::transform(type_.begin(), type_.end(), type_.begin(),
      static_cast<char (*)(char)>(ToLower));
  std::transform(subtype_.begin(),
                 subtype_.end(),
                 subtype_.begin(),
                 static_cast<char (*)(char)>(ToLower));
  while (right <= length) {
    right++;   // ;
    for (; right < length; right++) {
      char c = source[right];
      if (!is_ascii_whitespace(c)) break;
    }
    left = right;
    saw_invalid_char = false;
    for (; right < length; right++) {
      char c = source[right];
      if (c == ';'|| c == '=') {
        break;
      } else if (!is_http_token(c)) {
        saw_invalid_char = true;
      }
    }
    std::string parameter_name;
    if (right < length) {
      if (!saw_invalid_char) {
        parameter_name.assign(const_cast<char*>(source + left), right - left);
        std::transform(parameter_name.begin(),
                       parameter_name.end(),
                       parameter_name.begin(),
                       static_cast<char (*)(char)>(
                            ToLower));
      }
      if (source[right] == ';') {
        continue;
      }
      right++;   // =
      left = right;
    }
    bool saw_invalid_value = false;
    std::string parameter_value;
    if (right < length) {
      if (source[right] == '"') {
        right++;
        while (true) {
          left = right;
          for (; right < length; right++) {
            char c = source[right];
            if (c == '"' || c == '\\') {
              break;
            } else if (!is_http_quoted_string_token(c)) {
              saw_invalid_value = true;
            }
          }
          parameter_value.append(source + left, right - left);
          if (right < length && source[right] == '\\') {
            right++;
            if (right < length) {
              parameter_value += source[right];
              right++;
              continue;
            } else {
              parameter_value += '\\';
              break;
            }
          } else {
            break;
          }
        }
        for (; right < length; right++) {
          char c = source[right];
          if (c == ';') {
            break;
          }
        }
      } else {
        for (; right < length; right++) {
          char c = source[right];
          if (c == ';') {
            break;
          } else {
            bool is_2_byte = (c & static_cast<unsigned char>(0xE0)) == 0xC0;
            bool is_3_byte = (c & static_cast<unsigned char>(0xF0)) == 0xE0;
            bool is_4_byte = (c & static_cast<unsigned char>(0xF8)) == 0xF0;
            bool is_invalid = false;
            if (is_2_byte) {
              // need 2 bits of FF
              if ((c & static_cast<unsigned char>(0x1C)) != 0) {
                is_invalid = true;
                right += 1;
              } else {
                right += 1;
                if (right < length) {
                  c = source[right];
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
          size_t trim_right = right;
          while (is_ascii_whitespace(source[trim_right - 1])) {
            trim_right--;
          }
          if (!saw_invalid_char || first_invalid_char >= trim_right) {
            parameter_value.assign(const_cast<char*>(source + left), trim_right - left);
          }
        }
      }
    }
    if (parameter_name.size() > 0 &&
        parameter_value.size() > 0 &&
        !saw_invalid_value) {
      parameters_.push_back({ parameter_name, parameter_value });
    }
  }
}


void MIMEParser::Parse(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);

  Local<Context> context = env->context();


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

  Local<Object> data_sink = args[1].As<Object>();

  Utf8Value source(isolate, args[0]);

  MIME mime(const_cast<const char*>(*source), source.length());

  if (mime.flags_ != mime_flags::MIME_FLAGS_NONE) {
    env->ThrowError("Error parsing MIME");
    return;
  }

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
  data_sink->Set(context, env->type_string(), type).FromJust();
  data_sink->Set(context, env->subtype_string(), subtype).FromJust();

  Local<Array> parameters = Array::New(isolate, mime.parameters_.size());
  size_t i = 0;
  for (const auto& pair : mime.parameters_) {
    const std::string& key_str = pair.first;
    const std::string& value_str = pair.second;
    Local<String> key =
        String::NewFromUtf8(isolate,
                            key_str.c_str(),
                            v8::NewStringType::kInternalized,
                            key_str.length()).ToLocalChecked();
    Local<String> value =
        String::NewFromUtf8(isolate,
                            value_str.c_str(),
                            v8::NewStringType::kInternalized,
                            value_str.length()).ToLocalChecked();
    Local<Array> pair_arr = Array::New(isolate, 2);
    pair_arr->Set(context, 0, key).FromJust();
    pair_arr->Set(context, 1, value).FromJust();
    parameters->Set(context, i, pair_arr).FromJust();
    i++;
  }
  data_sink->Set(context, env->parameters_string(), parameters).FromJust();

  args.GetReturnValue().Set(data_sink);
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
