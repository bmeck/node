'use strict';

const {
  setImportModuleDynamicallyCallback,
  setInitializeImportMetaObjectCallback
} = internalBinding('module_wrap');

const { getURLFromFilePath } = require('internal/url');
const Loader = require('internal/loader/Loader');
const path = require('path');
const { URL } = require('url');

function normalizeReferrerURL(referrer) {
  if (typeof referrer === 'string' && path.isAbsolute(referrer)) {
    return getURLFromFilePath(referrer).href;
  }
  return new URL(referrer).href;
}

function initializeImportMetaObject(wrap, meta) {
  meta.url = wrap.url;
}

let loaderResolve;
exports.loaderPromise = new Promise((resolve, reject) => {
  loaderResolve = resolve;
});

exports.ESMLoader = undefined;

exports.setup = function() {
  setInitializeImportMetaObjectCallback(initializeImportMetaObject);

  const ESMLoader = new Loader();
  const loaderPromise = (async () => {
    const { userLoaders } = process.binding('config');
    if (userLoaders) {
      let previous = {
        resolve: (url, referrer) => {
          return require('internal/loader/DefaultResolve')(url, referrer);
        },
        dynamicInstantiate: null
      };
      for (var i = 0; i < userLoaders.length; i++) {
        const loaderSpecifier = userLoaders[i];
        const { default: factory } = await ESMLoader.import(loaderSpecifier);
        const parent = previous;
        previous = factory({
          __proto__: null,
          resolve: parent.resolve ? Object.setPrototypeOf(
            async (url, referrer) => {
              const ret = await parent.resolve(url, referrer);
              return {
                __proto__: null,
                url: `${ret.url}`,
                format: `${ret.format}`,
              };
            },
            null
          ) : null,
          dynamicInstantiate: parent.dynamicInstantiate ? Object.setPrototypeOf(
            async (url) => {
              const ret = await parent.dynamicInstantiate(url);
              return {
                __proto__: null,
                exports: ret.exports,
                execute: ret.execute
              };
            },
            null
          ) : null
        });
      }
      ESMLoader.hook({
        resolve: previous.resolve !== undefined ? previous.resolve.bind(previous) : undefined,
        dynamicInstantiate: previous.dynamicInstantiate !== undefined ? previous.dynamicInstantiate.bind(previous) : undefined
      });
    }
    return ESMLoader;
  })();
  loaderResolve(loaderPromise);

  setImportModuleDynamicallyCallback(async (referrer, specifier) => {
    const loader = await loaderPromise;
    return loader.import(specifier, normalizeReferrerURL(referrer));
  });

  exports.ESMLoader = ESMLoader;
};
