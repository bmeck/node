var common = require('../common');
var assert = require('assert');
var cluster = require('cluster');

assert(cluster.isMaster);

assert.deepEqual(cluster.settings, {},
                 'cluster.settings should not be initialized until needed');

cluster.setupMaster();
assert.deepEqual(cluster.settings, {
  args: process.argv.slice(2),
  exec: process.argv[1],
  execArgv: process.execArgv,
  silent: false,
});
console.log('ok sets defaults');

cluster.setupMaster({ exec: 'overridden' });
assert.strictEqual(cluster.settings.exec, 'overridden');
console.log('ok overrids defaults');

cluster.setupMaster({ args: ['foo', 'bar'] });
assert.strictEqual(cluster.settings.exec, 'overridden');
assert.deepEqual(cluster.settings.args, ['foo', 'bar']);

cluster.setupMaster({ execArgv: ['baz', 'bang'] });
assert.strictEqual(cluster.settings.exec, 'overridden');
assert.deepEqual(cluster.settings.args, ['foo', 'bar']);
assert.deepEqual(cluster.settings.execArgv, ['baz', 'bang']);
console.log('ok preserves unchanged settings on repeated calls');

cluster.setupMaster();
assert.deepEqual(cluster.settings, {
  args: ['foo', 'bar'],
  exec: 'overridden',
  execArgv: ['baz', 'bang'],
  silent: false,
});
console.log('ok preserves current settings');
