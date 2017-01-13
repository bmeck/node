/* eslint-disable no-restricted-globals */
'use strict';
module.exports = Object.create(null);
for (var name of [
  // generated from:
  //
  // ./node tools/eslint/bin/eslint.js \
  //   --rulesdir=tools/eslint-rules \
  //   --format=tap lib |
  //   tr -s ' ' |
  //   grep -- '- message: Unexpected use of ' |
  //   sort |
  //   uniq |
  //   cut -d ' ' -f7
  'Array',
  'ArrayBuffer',
  'Boolean',
  'DTRACE_HTTP_CLIENT_REQUEST',
  'DTRACE_HTTP_CLIENT_RESPONSE',
  'DTRACE_HTTP_SERVER_REQUEST',
  'DTRACE_HTTP_SERVER_RESPONSE',
  'DTRACE_NET_SERVER_CONNECTION',
  'DTRACE_NET_STREAM_END',
  'Date',
  'Error',
  'Float32Array',
  'Float64Array',
  'Function',
  'Infinity',
  'Intl',
  'JSON',
  'Map',
  'Math',
  'Number',
  'Object',
  'RangeError',
  'Reflect',
  'RegExp',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'URIError',
  'Uint32Array',
  'Uint8Array',
  'WeakMap',
  'clearTimeout',
  'console',
  'decodeURIComponent',
  'eval',
  'global',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'process',
  'setImmediate',
  'setTimeout'
]) {
  let root = global;
  let desc;
  try {
    while (desc === undefined) {
      desc = Object.getOwnPropertyDescriptor(root, name);
      root = Object.getPrototypeOf(root);
    }
    Object.defineProperty(module.exports, name, desc);
  }
  catch (e) {
    throw new Error(`cannot find ${name}`);
  }
}
Object.freeze(module.exports);
