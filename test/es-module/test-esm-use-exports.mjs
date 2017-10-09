// Flags: --experimental-modules
/* eslint-disable required-modules */
import '../common';
import assert from 'assert';
import * as useexports from './esm-use-exports';

assert.strictEqual(useexports.default, 'use exports');
assert.strictEqual(typeof useexports.require, 'function');
assert.strictEqual(useexports.notFound, undefined);
assert.deepStrictEqual(Object.keys(useexports), ['default', 'require']);
