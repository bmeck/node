'use strict';

const { URL } = require('url');
const internalCJSModule = require('internal/module');
const internalURLModule = require('internal/url');
const internalFS = require('internal/fs');
const NativeModule = require('native_module');
const { extname } = require('path');
const { realpathSync } = require('fs');
const preserveSymlinks = !!process.binding('config').preserveSymlinks;
const {
  ModuleWrap,
  createDynamicModule
} = require('internal/loader/ModuleWrap');
const errors = require('internal/errors');

const search = require('internal/loader/search');
const asyncReadFile = require('util').promisify(require('fs').readFile);
const debug = require('util').debuglog('esm');

const realpathCache = new Map();

const formatProviders = new Map();
exports.formatProviders = formatProviders;

// Strategy for loading a standard JavaScript module
formatProviders.set('esm', async (url) => {
  const source = `${await asyncReadFile(url)}`;
  debug(`Loading StandardModule ${url}`);
  return new ModuleWrap(internalCJSModule.stripShebang(source),
                        `${url}`);
});

// Strategy for loading a node-style CommonJS module
formatProviders.set('cjs', async (url) => {
  const ctx = createDynamicModule(['default'], url, (reflect) => {
    debug(`Loading CJSModule ${url.pathname}`);
    const CJSModule = require('module');
    const pathname = internalURLModule.getPathFromURL(url);
    ctx.reflect.exports.default.set(CJSModule._load(pathname));
  });
  return ctx.module;
});

// Strategy for loading a node builtin CommonJS module that isn't
// through normal resolution
formatProviders.set('native', async (url) => {
  const ctx = createDynamicModule(['default'], url, (reflect) => {
    debug(`Loading NativeModule ${url.pathname}`);
    const exports = NativeModule.require(url.pathname);
    reflect.exports.default.set(exports);
  });
  return ctx.module;
});

formatProviders.set('json', async (url) => {
  const source = `${await asyncReadFile(url)}`;
  const ctx = createDynamicModule(['default'], url, (reflect) => {
    debug(`Loading JSONModule ${url.pathname}`);
    const json = JSON.parse(source);
    ctx.reflect.exports.default.set(json);
  });
  return ctx.module;
});

// TODO: make this native binary handling only
formatProviders.set('binary', async (url) => {
  const ctx = createDynamicModule(['default'], url, (reflect) => {
    debug(`Loading CJSModule ${url.pathname}`);
    const CJSModule = require('module');
    const pathname = internalURLModule.getPathFromURL(url);
    ctx.reflect.exports.default.set(CJSModule._load(pathname));
  });
  return ctx.module;
});

exports.resolve = resolve;
function resolve(specifier, parentURL) {
  if (NativeModule.nonInternalExists(specifier)) {
    return {
      url: new URL(`node:${specifier}`),
      format: 'native'
    };
  }

  let url = search(specifier, parentURL);

  if (url.protocol !== 'file:') {
    throw new errors.Error('ERR_INVALID_PROTOCOL', url.protocol, 'file:');
  }

  if (!preserveSymlinks) {
    const real = realpathSync(internalURLModule.getPathFromURL(url), {
      [internalFS.realpathCacheKey]: realpathCache
    });
    const old = url;
    url = internalURLModule.getURLFromFilePath(real);
    url.search = old.search;
    url.hash = old.hash;
  }

  const ext = extname(url.pathname);
  switch (ext) {
    case '.mjs':
      return { url, format: 'esm' };
    case '.json':
      return { url, format: 'json' };
    case '.node':
      return { url, format: 'binary' };
    default:
      return { url, format: 'cjs' };
  }
};
