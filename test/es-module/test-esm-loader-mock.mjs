// Flags: --experimental-loader ./test/fixtures/es-module-loaders/mock-loader.mjs
import '../common/index.mjs';
import assert from 'assert/strict';

mock('node:events', {
  default: 'mocked default',
  EventEmitter: 'This is mocked!'
});

console.dir(await import('node:events'));

// mock('node:events', {
//   EventEmitter: 'This is mocked!... version 2.0'
// });
// console.dir(await import('events'));