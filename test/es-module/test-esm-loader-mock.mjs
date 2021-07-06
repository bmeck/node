// Flags: --experimental-loader
// ./test/fixtures/es-module-loaders/mock-loader.mjs
import '../common/index.mjs';
import assert from 'assert/strict';
import mock from 'node:mock';

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

const mutator = mock('node:events', {
  EventEmitter: 'This is mocked v2!'
});

const mockedV2 = await import('node:events');
assert.deepStrictEqual(mockedV2, Object.defineProperty({
  __proto__: null,
  EventEmitter: 'This is mocked v2!'
}, Symbol.toStringTag, {
  enumerable: false,
  value: 'Module'
}));

mutator.EventEmitter = 'This is mocked v3!';
assert.deepStrictEqual(mockedV2, Object.defineProperty({
  __proto__: null,
  EventEmitter: 'This is mocked v3!'
}, Symbol.toStringTag, {
  enumerable: false,
  value: 'Module'
}));
