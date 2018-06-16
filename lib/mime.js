'use strict';
const { internalBinding } = require('internal/bootstrap/loaders');
const { parse } = internalBinding('mime_wrap');
const {
  Apply,
  MapIteratorPrototypeNext,
  RegexpPrototypeTest,
  StringPrototypeReplace,
  SymbolReplace,
  SymbolIterator,
  TypeError,
  SafeMap: Map,
  SafeWeakMap: WeakMap,
} = require('internal/safe_globals');

const MIMEData = new WeakMap();
const MIMEParamsData = new WeakMap();
const $ = (self, map) => {
  if (!map.has(self)) {
    throw new TypeError('Invalid receiver');
  }
  return map.get(self);
};

const NotHTTPTokenCodePoint = /[^\!\#\$\%\&\'\*\+\-\.\^\_\`\|\~A-Za-z0-9]/g;
const NotHTTPQuotedStringCodePoint = /[^\t\u0020-\~\u0080-\u00FF]/g;
NotHTTPQuotedStringCodePoint[SymbolReplace] = null;

const test = (pattern, value) => {
  pattern.lastIndex = 0;
  return Apply(RegexpPrototypeTest, pattern, [value]);
};

const encode = (value) => {
  NotHTTPTokenCodePoint.lastIndex = 0;
  const encode = test(NotHTTPTokenCodePoint, value);
  if (!encode) return value;
  const escaped = Apply(StringPrototypeReplace, value,
                        [/["\\]/g, '\\$&']);
  const ret = `"${escaped}"`;
  return ret;
};

const MIMEStringify = (self) => {
  const data = $(self, MIMEData);
  let ret = `${data.type}/${data.subtype}`;
  const entries = $(data.parameters, MIMEParamsData).entries();
  let keyValuePair, done;
  for (;;) {
    ({ value: keyValuePair, done } =
        Apply(MapIteratorPrototypeNext, entries, []));
    if (done) break;
    const [key, value] = keyValuePair;
    const encoded = encode(value);
    ret += `;${key}=${encoded}`;
  }
  return ret;
};

class MIMEParams {
  constructor() {
    MIMEParamsData.set(this, new Map());
  }

  delete(name) {
    $(this, MIMEParamsData).delete(name);
  }

  get(name) {
    const data = $(this, MIMEParamsData);
    if (data.has(name)) {
      return data.get(name);
    }
    return null;
  }

  has(name) {
    return $(this, MIMEParamsData).has(name);
  }

  set(name, value) {
    const data = $(this, MIMEParamsData);
    NotHTTPTokenCodePoint.lastIndex = 0;
    let o = name;
    name = name.trimLeft();
    const invalidName = test(NotHTTPTokenCodePoint, name);
    if (name.length === 0 || invalidName) {
      throw new Error('Invalid MIME parameter name');
    }
    NotHTTPQuotedStringCodePoint.lastIndex = 0;
    const invalidValue = test(NotHTTPQuotedStringCodePoint, value);
    if (value.length === 0 || invalidValue) {
      throw new Error('Invalid MIME parameter value');
    }
    data.set(name, value);
  }

  *entries() {
    return yield* $(this, MIMEParamsData).entries();
  }

  *keys() {
    return yield* $(this, MIMEParamsData).keys();
  }

  *values() {
    return yield* $(this, MIMEParamsData).values();
  }

  *[SymbolIterator]() {
    return yield* $(this, MIMEParamsData).entries();
  }
}
class MIME {
  constructor(string) {
    const data = parse(string, { __proto__: null });
    const parameters = new MIMEParams();
    for (var i = 0; i < data.parameters.length; i++) {
      const [k, v] = data.parameters[i];
      if (!parameters.has(k)) {
        parameters.set(k, v);
      }
    }
    data.parameters = parameters;

    MIMEData.set(this, data);
  }

  get type() {
    return $(this, MIMEData).type;
  }

  set type(v) {
    const data = $(this, MIMEData);
    v = v.trimLeft();
    const invalidType = test(NotHTTPTokenCodePoint, v);
    if (v.length === 0 || invalidType) {
      throw new Error('Invalid MIME type');
    }
    data.type = v;
  }

  get subtype() {
    return $(this, MIMEData).subtype;
  }

  set subtype(v) {
    const data = $(this, MIMEData);
    v = v.trimRight();
    const invalidSubtype = test(NotHTTPTokenCodePoint, v);
    if (v.length === 0 || invalidSubtype) {
      throw new Error('Invalid MIME subtype');
    }
    data.subtype = v;
  }

  get params() {
    return $(this, MIMEData).parameters;
  }

  toJSON() {
    return MIMEStringify(this);
  }

  toString() {
    return MIMEStringify(this);
  }
}
module.exports = {
  MIME,
};
