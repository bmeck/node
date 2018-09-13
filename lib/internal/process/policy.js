'use strict';

// const process = require('process');
const fs = require('fs');
const { pathToFileURL } = require('internal/url');
const { URL } = require('url');
const { Manifest } = require('internal/policy/manifest');
let manifest;
module.exports = Object.freeze({
  __proto__: null,
  setup() {
    const manifestSpecifier = process.binding('config').experimentalPolicy;
    if (typeof manifestSpecifier !== 'string') {
      manifest = null;
      return;
    }
    const cwdURL = pathToFileURL(`${process.cwd()}/`);
    // URL here as it is slightly different parsing
    // no bare specifiers for now
    const manifestURL = new URL(manifestSpecifier, cwdURL);
    const json = JSON.parse(fs.readFileSync(manifestURL, 'utf8'), (_, o) => {
      if (o && typeof o === 'object') {
        Reflect.setPrototypeOf(o, null);
        Object.freeze(o);
      }
      return o;
    });
    manifest = new Manifest(json);
  },
  get manifest() {
    if (typeof manifest === 'undefined') {
      throw new Error('Policy setup has not yet run');
    }
    return manifest;
  },
  onFailedIntegrity() {
    throw new Error('Integrity mismatch');
  }
});
