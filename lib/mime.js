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

const DATA = new WeakMap();
const $ = (self, guard) => {
  if (!DATA.has(self)) {
    throw new TypeError('Invalid receiver');
  }
  const data = DATA.get(self);
  if (guard !== data.guard) {
    throw new TypeError('Invalid receiver');
  }
  return data.value;
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
    DATA.set(this, {
      value: new Map(),
      guard: MIMEParams
    });
  }
  delete(name) {
    return $(this, MIMEParams).delete(name);
  }
  get(name) {
    const data = $(this, MIMEParams);
    if (data.has(name)) {
      return data.get(name);
    }
    return null;
  }
  has(name) {
    return $(this, MIMEParams).has(name);
  }
  set(name, value) {
    return $(this, MIMEParams).set(name, value);
  }
  *entries() {
    return yield* $(this, MIMEParams).entries();
  }
  *keys() {
    return yield* $(this, MIMEParams).keys();
  }
  *values() {
    return yield* $(this, MIMEParams).values();
  }
  [SymbolIterator]() {
    $(this, MIMEParams);
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

    DATA.set(this, {
      value: data,
      guard: MIME
    });
  }
  get type() {
    return $(this, MIME).type;
  }
  set type(v) {
    return $(this, MIME).type = v;
  }
  get subtype() {
    return $(this, MIME).subtype;
  }
  set subtype(v) {
    return $(this, MIME).subtype = v;
  }
  get params() {
    return $(this, MIME).parameters;
  }
  toJSON() {
    $(this, MIME);
    return `${this}`;
  }
  toString() {
    const data = $(this, MIME);
    let ret = `${data.type}/${data.subtype}`;
    const entries = $(data.parameters, MIMEParams).entries();
    let _, done;
    while (({ value: _, done } = Apply(MapIteratorPrototypeNext, entries, []))) {
      if (done) break;
      const [key, value] = _;
      const encoded = encode(value);
      ret += `;${key}=${encoded}`;
    }
    return ret;
  }
}
module.exports = {
  MIME,
};
