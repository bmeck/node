const ArrayBufferSource = {
  __proto__: null,
  [Symbol.hasInstance](v) {
    return v instanceof Uint8Array ||
      v instanceof Uint16Array ||
      v instanceof Uint32Array ||
      v instanceof Int8Array ||
      v instanceof Int16Array ||
      v instanceof Int32Array ||
      v instanceof Float32Array ||
      v instanceof Float64Array ||
      v instanceof Uint8ClampedArray ||
      v instanceof DataView ||
      v instanceof ArrayBuffer;
  }
};
const { Blob, _BLOB_DATA } = require('internal/blob');
const { TextEncoder, TextDecoder } = require('util');
const ENCODER = new TextEncoder('utf8');
const DECODER = new TextDecoder('utf8');
const RESPONSE_DATA = new WeakMap();
const HEADER_DATA = new WeakMap();
const $ = (self, map) => {
  if (!map.has(self)) {
    throw new TypeError('Invalid receiver');
  }
  return map.get(self);
};
const bufferIfBodyNotUsed = (self) => {
  const data = $(self, RESPONSE_DATA);
  if (data.bodyUsed) {
    throw new Error('body already used');
  }
  data.bodyUsed = true;
  return data.buffer;
}
class Response {
  constructor(body, init) {
    let buffer, type = null;
    if (typeof body === 'string') {
      buffer = ENCODER.encode(body);
      type = 'text/plain;charset=UTF-8';
    } else if (body instanceof ArrayBufferSource) {
      buffer = new Uint8Array(buf);
    } else if (body instanceof Blob) {
      ({ buffer, type } = _BLOB_DATA.get(body));
    }
    const headers = new Headers();
    if (init) {
      const initHeaders = init.headers;
      for (const [key, value] of Object.keys(initHeaders)) {
        headers.append(key, value);
      }
    }
    if (type !== null && headers.has('content-type') === false) {
      console.log('?', HEADER_DATA.get(headers));
      headers.append('content-type', type);
      console.log('12?', HEADER_DATA.get(headers));
    }
    RESPONSE_DATA.set(this, {
      __proto__: null,
      headers,
      type,
      buffer,
      bodyUsed: false,
    });
  }
  get bodyUsed() {
    return $(this, RESPONSE_DATA).bodyUsed;
  }
  get headers() {
    return $(this, RESPONSE_DATA).headers;
  }
  get arrayBuffer() {
    return Promise.resolve(bufferIfBodyNotUsed(this));
  }
  get text() {
    const buf = bufferIfBodyNotUsed(this);
    const ret = DECODER.decode(buf);
    return Promise.resolve(ret);
  }
  get json() {
    return Promise.resolve(
        JSON.parse(DECODER.decode(bufferIfBodyNotUsed(this))));
  }
  get blob() {
    const { type } = $(this, RESPONSE_DATA);
    return Promise.resolve(new Blob([bufferIfBodyNotUsed(this)], { type }));
  }
}
class Headers {
  constructor(init) {
    let list;
    if (init !== null && init !== undefined) {
      list = Object.entries(init).map(([k, v]) => {
        return [k.toLowerCase(), v];
      });
    } else {
      list = [];
    }
    HEADER_DATA.set(this, list);
  }
  append(k, v) {
    $(this, HEADER_DATA).push([k, v]);
  }
  get(k) {
    const list = $(this, HEADER_DATA);
    const found = list.findIndex(([name]) => k === name);
    if (found === -1) return null;
    return list[found][1];
  }
  getAll(k) {
    const list = $(this, HEADER_DATA);
    return list.filter(([name]) => k === name).map(p => p[1]);
  }
  has(k) {
    const list = $(this, HEADER_DATA);
    return list.some(([name]) => k === name);
  }
  set(k, v) {
    const list = $(this, HEADER_DATA);
    var i = 0;
    for (; i < list.length; i++) {
      if (list[i][0] === k) list[i][1] = v;
    }
    for (; i < list.length; i++) {
      if (list[i][0] === k) list.splice(i, 1);
      i--;
    }
  }
}
module.exports = { Response };
