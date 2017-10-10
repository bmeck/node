// Flags: --experimental-modules
/* eslint-disable required-modules */
import '../common';
import assert from 'assert';
import * as useexports from './esm-use-exports-empty';

assert.strictEqual(useexports.default, undefined);
assert.strictEqual(useexports.require, undefined);
assert.strictEqual(useexports.notFound, undefined);
assert.deepStrictEqual(Object.keys(useexports), []);
