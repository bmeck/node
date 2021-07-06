// Flags: --experimental-loader
// ./test/fixtures/es-module-loaders/mock-loader.mjs
import {allowGlobals} from '../common/index.mjs';
import assert from 'assert/strict';
allowGlobals(mock);

mock('node:events', {
  EventEmitter: 'This is mocked!'
});

// this resolves to node:events
assert.deepStrictEqual(await import('events'), Object.defineProperty({
  __proto__: null,
  EventEmitter: 'This is mocked!'
}, Symbol.toStringTag, {
  enumerable: false,
  value: 'Module'
}));

mock('node:events', {
  EventEmitter: 'This is mocked v2!'
});

assert.deepStrictEqual(await import('node:events'), Object.defineProperty({
  __proto__: null,
  EventEmitter: 'This is mocked v2!'
}, Symbol.toStringTag, {
  enumerable: false,
  value: 'Module'
}));
