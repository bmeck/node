'use strict';
const {
  process
} = require('internal/globals');

module.exports = require('internal/linkedlist');
process.emitWarning(
  '_linklist module is deprecated. Please use a userland alternative.',
  'DeprecationWarning');
