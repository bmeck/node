// Flags: --experimental-modules
'use strict';

require('../common');
const { spawnSync } = require('child_process');
const assert = require('assert');
const path = require('path');

const invalid_resolve = path.join(__dirname, 'loader-invalid-resolve-type.mjs');
const invalid_dynamic_instantiate = path.join(
  __dirname,
  'loader-invalid-dynamic-instantiate-type.mjs');

{
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-modules',
      '--loader',
      invalid_resolve,
      __filename
    ],
    {
      stdio: 'pipe'
    }
  );
  assert.strictEqual(result.status, 1);
  assert(/ERR_LOADER_HOOK_BAD_TYPE/.test(result.stderr));
}

{
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-modules',
      '--loader',
      invalid_dynamic_instantiate,
      __filename
    ],
    {
      stdio: 'pipe'
    }
  );
  assert.strictEqual(result.status, 1);
  assert(/ERR_LOADER_HOOK_BAD_TYPE/.test(result.stderr));
}
