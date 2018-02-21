// Flags: --experimental-modules
'use strict';

require('../common');
const { spawnSync } = require('child_process');
const assert = require('assert');
const path = require('path');
const url = require('url');

const loader_add_hash = path.join(__dirname, 'loader-add-hash.mjs');
const loader_remove_params = path.join(__dirname, 'loader-remove-params.mjs');
const logger = path.join(__dirname, 'esm-log-import-url.mjs');
const dependency = path.join(__dirname, 'esm-export-url.mjs');

{
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-modules',
      '--loader',
      loader_remove_params,
      '--loader',
      loader_add_hash,
      logger,
    ],
    {
      stdio: 'pipe'
    }
  );
  assert.strictEqual(result.status, 0);
  const dependencyResolved = new url.URL(`${result.stdout}`);
  assert.strictEqual(dependencyResolved.pathname, dependency);
  assert.strictEqual(dependencyResolved.hash, '#hash');
  assert.strictEqual(dependencyResolved.search, '');
}

{
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-modules',
      '--loader',
      loader_add_hash,
      '--loader',
      loader_remove_params,
      logger,
    ],
    {
      stdio: 'pipe'
    }
  );
  assert.strictEqual(result.status, 0);
  const dependencyResolved = new url.URL(`${result.stdout}`);
  assert.strictEqual(dependencyResolved.pathname, dependency);
  assert.strictEqual(dependencyResolved.hash, '');
  assert.strictEqual(dependencyResolved.search, '');
}

{
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-modules',
      logger,
    ],
    {
      stdio: 'pipe',
    }
  );
  assert.strictEqual(result.status, 0);
  const dependencyResolved = new url.URL(`${result.stdout}`);
  assert.strictEqual(dependencyResolved.pathname, dependency);
  assert.strictEqual(dependencyResolved.hash, '');
  assert.strictEqual(dependencyResolved.search, '?x=y');
}
