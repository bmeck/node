'use strict';
const {
  Object,
  process
} = require('internal/globals');

// This module is soft-deprecated. Users should be directed towards using
// the specific constants exposed by the individual modules on which they
// are most relevant.
const constants = process.binding('constants');
Object.assign(exports,
              constants.os.errno,
              constants.os.signals,
              constants.fs,
              constants.crypto);
