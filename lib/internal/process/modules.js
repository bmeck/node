'use strict';

const {
  setImportModuleDynamicallyCallback,
  setInitializeImportMetaObjectCallback,
} = internalBinding('module_wrap');

const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);
const apply = Reflect.apply;

const errors = require('internal/errors');
const { getURLFromFilePath } = require('internal/url');
const Loader = require('internal/loader/Loader');
const path = require('path');
const { URL } = require('url');

// fires a getter or reads the value off a descriptor
function grabPropertyOffDescriptor(object, descriptor) {
  if (hasOwnProperty(descriptor, 'value')) {
    return descriptor.value;
  } else {
    return apply(descriptor.get, object, []);
  }
}

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
      let resolve = (url, referrer) => {
        return require('internal/loader/DefaultResolve')(url, referrer);
      };
      let dynamicInstantiate = (url) => {
        throw new errors.Error('ERR_MISSING_DYNAMIC_INSTANTIATE_HOOK');
      };
      for (var i = 0; i < userLoaders.length; i++) {
        const loaderSpecifier = userLoaders[i];
        const { default: factory } = await ESMLoader.import(loaderSpecifier);
        const cachedResolve = resolve;
        const cachedDynamicInstantiate = dynamicInstantiate;
        const next = factory({
          __proto__: null,
          resolve: Object.setPrototypeOf(async (url, referrer) => {
            const ret = await cachedResolve(url, referrer);
            return {
              __proto__: null,
              url: `${ret.url}`,
              format: `${ret.format}`,
            };
          }, null),
          dynamicInstantiate: Object.setPrototypeOf(async (url) => {
            const ret = await cachedDynamicInstantiate(url);
            return {
              __proto__: null,
              exports: ret.exports,
              execute: ret.execute,
            };
          }, null),
        });
        const resolveDesc = getOwnPropertyDescriptor(next, 'resolve');
        if (resolveDesc !== undefined) {
          resolve = grabPropertyOffDescriptor(next, resolveDesc);
          if (typeof resolve !== 'function') {
            throw new errors.TypeError('ERR_LOADER_HOOK_BAD_TYPE',
                                       'resolve', 'function');
          }
        }
        const dynamicInstantiateDesc = getOwnPropertyDescriptor(
          next,
          'dynamicInstantiate');
        if (dynamicInstantiateDesc !== undefined) {
          dynamicInstantiate = grabPropertyOffDescriptor(
            next,
            dynamicInstantiateDesc);
          if (typeof dynamicInstantiate !== 'function') {
            throw new errors.TypeError('ERR_LOADER_HOOK_BAD_TYPE',
                                       'dynamicInstantiate', 'function');
          }
        }
      }
      ESMLoader.hook({
        resolve,
        dynamicInstantiate
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
