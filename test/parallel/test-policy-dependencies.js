'use strict';

const common = require('../common');
if (!common.hasCrypto)
  common.skip('missing crypto');
common.requireNoPackageJSONAbove();

const fixtures = require('../common/fixtures');

const assert = require('assert');
const { spawnSync } = require('child_process');

const dep = fixtures.path('policy', 'parent.js');
{
  const depPolicy = fixtures.path(
    'policy',
    'dependencies',
    'dependencies-redirect-policy.json');
  const { status, stderr, stdout } = spawnSync(
    process.execPath,
    [
      '--experimental-policy', depPolicy, dep,
    ]
  );
  console.log('%s\n%s', stderr, stdout);
  assert.strictEqual(status, 0);
}
{
  const depPolicy = fixtures.path(
    'policy',
    'dependencies',
    'dependencies-redirect-builtin-policy.json');
  const { status } = spawnSync(
    process.execPath,
    [
      '--experimental-policy', depPolicy, dep,
    ]
  );
  assert.strictEqual(status, 0);
}
{
  const depPolicy = fixtures.path(
    'policy',
    'dependencies',
    'dependencies-redirect-unknown-builtin-policy.json');
  const { status } = spawnSync(
    process.execPath,
    [
      '--experimental-policy', depPolicy, dep,
    ]
  );
  assert.strictEqual(status, 1);
}
{
  const depPolicy = fixtures.path(
    'policy',
    'dependencies',
    'dependencies-wildcard-policy.json');
  const { status, stderr, stdout } = spawnSync(
    process.execPath,
    [
      '--experimental-policy', depPolicy, dep,
    ]
  );
  console.log('%s\n%s', stderr, stdout);
  assert.strictEqual(status, 0);
}
{
  const depPolicy = fixtures.path(
    'policy',
    'dependencies',
    'dependencies-empty-policy.json');
  const { status } = spawnSync(
    process.execPath,
    [
      '--experimental-policy', depPolicy, dep,
    ]
  );
  assert.strictEqual(status, 1);
}
{
  const depPolicy = fixtures.path(
    'policy',
    'dependencies',
    'dependencies-missing-policy.json');
  const { status } = spawnSync(
    process.execPath,
    [
      '--experimental-policy', depPolicy, dep,
    ]
  );
  assert.strictEqual(status, 1);
}
{
  const depPolicy = fixtures.path(
    'policy',
    'dependencies',
    'dependencies-scopes-relative-specifier.json');
  const { status } = spawnSync(
    process.execPath,
    [
      '--experimental-policy',
      depPolicy,
      fixtures.path('policy', 'canonicalize.mjs')
    ]
  );
  assert.strictEqual(
    status,
    0,
    new Error(
      'policies should canonicalize specifiers by default prior to matching'
    )
  );
}
