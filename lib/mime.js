'use strict';
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
const NotHTTPTokenCodePoint = /[^\u0021\u0023-\u0027\u002A\u002B\u002D\u002E\u005E\u005F\u0060\u007C\u007EA-Za-z0-9]/g;
NotHTTPTokenCodePoint[SymbolReplace] = null;
const encode = (value) => {
  NotHTTPTokenCodePoint.lastIndex = 0;
  const encode = Apply(RegexpPrototypeTest, NotHTTPTokenCodePoint, [value]);
  if (!encode) return value;
  const escaped = Apply(StringPrototypeReplace, value,
                        [/["\\]/g, '\\$&']);
  const ret = `"${escaped}"`;
  return ret;
};
class MIMEParams {
  constructor() {
    MIMEParamsData.set(this, new Map());
  }

  delete(name) {
    return $(this, MIMEParamsData).delete(name);
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
    return $(this, MIMEParamsData).set(name, value);
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

  [SymbolIterator]() {
    $(this, MIMEParamsData);
    return this.entries();
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
    return $(this, MIMEData).type = v;
  }

  get subtype() {
    return $(this, MIMEData).subtype;
  }

  set subtype(v) {
    return $(this, MIMEData).subtype = v;
  }

  get params() {
    return $(this, MIMEData).parameters;
  }

  toJSON() {
    $(this, MIMEData);
    return `${this}`;
  }

  toString() {
    const data = $(this, MIMEData);
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
  }
}
module.exports = {
  MIME,
};
