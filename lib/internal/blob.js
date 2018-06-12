'use strict';
const { MIME } = require('mime');
const { TextEncoder } = require('util');
function convertLineEndingsToNative(str) {
  const nativeLineEnding = '\n';
  //process.platform === 'win32' ? '\r\n' : '\n';
  const chars = [...str];
  for (var i = 0; i < chars.length; i++) {
    const char = chars[i].codePointAt(0);
    if (char === 0x0d /* \r */) {
      chars[i] = nativeLineEnding;
      i++;
      if (i < chars.length) {
        if (chars[i].codePointAt(0) === 0x0a /* \n */) {
          chars[i] = '';
          i++;
        }
      }
    } else if (char === 0x0a /* \n */) {
      chars[i] = nativeLineEnding;
    }
  }
  return chars.join('');
}
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
const BLOB_DATA = new WeakMap();
const ENCODER = new TextEncoder('utf8');
class Blob {
  constructor(blobParts, options = {}) {
    if (this instanceof Blob !== true) {
      throw new Error('cannot construct invalid subclass');
    }
    if (typeof options !== 'object') {
      throw new TypeError('options must be an object');
    }
    let type = options.type;
    const endings = options.endings === undefined ? 'transparent' : options.endings;
    if (type !== '') {
      try {
        type = `${new MIME(type)}`;
      } catch (e) {
        type = '';
      }
    }
    let buffer;
    if (arguments.length === 0) {
      buffer = new Uint8Array(0);
    } else {
      buffer = processBlobParts(blobParts, endings);
    }
    BLOB_DATA.set(this, {
      type,
      buffer
    });
  }
  get size() {
    return BLOB_DATA.get(this).buffer.byteLength;
  }
  get type() {
    return BLOB_DATA.get(this).type;
  }
  slice(start, end, contentType) {
    const data = BLOB_DATA.get(this);
    const size = data.buffer.byteLength;
    if (start === null || start === undefined) {
      start = 0;
    }
    if (start < 0) {
      start = Math.max(size + start, 0);
    } else {
      start = Math.min(start, size);
    }
    if (end === null || end === undefined) {
      end = size;
    }
    if (end < 0) {
      end = Math.max(size + end, 0);
    } else {
      end = Math.min(end, size);
    }
    if (contentType === null || contentType === undefined) {
      contentType = '';
    } else {
      // handled by constructor
    }
    return new Blob([data.buffer.slice(start, end)], {
      type: contentType
    });
  }
}

function processBlobParts(blobParts, endings) {
  const retParts = [];
  let length = 0;
  for (const part of blobParts) {
    if (part instanceof Blob) {
      // no need to copy, isn't be shared / writable
      const other = BLOB_DATA.get(part).buffer;
      retParts.push(other);
      length += other.byteLength;
    } else if (typeof part === 'string') {
      let str;
      if (endings === 'native') {
        str = convertLineEndingsToNative(part);
      } else if (endings === 'transparent') {
        str = part;
      }
      const encoded = ENCODER.encode(str);
      retParts.push(encoded);
      length += encoded.byteLength;
    } else if (part instanceof ArrayBufferSource) {
      const buf = new Uint8Array(part.byteLength);
      buf.set(part, 0);
      retParts.push(buf);
      length += part.byteLength;
    } else {
      throw new TypeError('Not a sequence');
    }
  }
  const ret = new Uint8Array(length);
  let index = 0;
  for (const part of retParts) {
    ret.set(part, index);
    index += part.byteLength;
  }
  return ret;
}
module.exports = { Blob, _BLOB_DATA: BLOB_DATA };
