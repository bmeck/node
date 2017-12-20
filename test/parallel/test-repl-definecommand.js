'use strict';

const common = require('../common');

const stream = require('stream');
const assert = require('assert');
const repl = require('repl');

const inputStream = new stream.PassThrough();
const outputStream = new stream.PassThrough();
const accumulator = [];
outputStream.on('data', function(d) {
  accumulator.push(d);
});

const r = repl.start({
  input: inputStream,
  output: outputStream,
  terminal: true
});

r.defineCommand('say1', {
  help: 'help for say1',
  action: function(thing) {
    this.outputStream.write(`hello ${thing}\n`);
    this.displayPrompt();
  }
});

r.defineCommand('say2', function() {
  this.outputStream.write('hello from say2\n');
  this.displayPrompt();
});

inputStream.write('.help\n');
inputStream.write('.say1 node developer\n');
inputStream.write('.say2 node developer\n');

r.close();
r.on('exit', common.mustCall(() => {
  const output = accumulator.join('');
  console.log('output: %j', output)
  assert(/\.say1     help for say1/.test(output),
         'help for say1 not present');
  assert(/.say2/.test(output), 'help for say2 not present');
  assert(/hello node developer\n/.test(output), 'say1 outputted incorrectly');
  assert(/hello from say2\n/.test(output), 'say2 outputted incorrectly');
}));
