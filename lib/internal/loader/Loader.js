'use strict';

const { URL } = require('url');
const { getURLFromFilePath } = require('internal/url');

const {
  getNamespaceOfModuleWrap
} = require('internal/loader/ModuleWrap');

const ModuleMap = require('internal/loader/ModuleMap');
const ModuleJob = require('internal/loader/ModuleJob');
let { formatProviders, resolve } = require('internal/loader/ModuleRequest');
const errors = require('internal/errors');

function getBase() {
  try {
    return getURLFromFilePath(`${process.cwd()}/`);
  } catch (e) {
    e.stack;
    // If the current working directory no longer exists.
    if (e.code === 'ENOENT') {
      return undefined;
    }
    throw e;
  }
}

class Loader {
  constructor(base = getBase()) {
    this.moduleMap = new ModuleMap();
    if (typeof base !== 'undefined' && base instanceof URL !== true) {
      throw new errors.TypeError('ERR_INVALID_ARG_TYPE', 'base', 'URL');
    }
    this.base = base;
  }

  setModuleResolver(resolver) {
    resolve = resolver;
  }

  async resolve(specifier, parentURLOrString = this.base) {
    if (typeof parentURLOrString === 'string') {
      parentURLOrString = new URL(parentURLOrString);
    }
    else if (parentURLOrString instanceof URL === false) {
      throw new errors.TypeError('ERR_INVALID_ARG_TYPE', 'parentURLOrString', 'URL');
    }
    const { url, format } = await resolve(specifier, parentURLOrString);
    if (typeof url === 'string') {
      url = new URL(url);
    }
    else if (!(url instanceof URL)) {
      throw new errors.TypeError('ERR_INVALID_ARG_TYPE', 'url', 'URL');
    }
    if (url.protocol !== 'file:') {
      throw new errors.Error('ERR_INVALID_PROTOCOL',
                             request.url.protocol, 'file:');
    }
    if (!formatProviders.has(format)) {
      throw new errors.Error('ERR_INVALID_FORMAT', format);
    }
    return { url, format };
  }

  async getModuleJob(specifier, parentURLOrString = this.base) {
    const { url, format } = await this.resolve(specifier, parentURLOrString);
    const urlString = `${url}`;
    let job = this.moduleMap.get(urlString);
    if (job === undefined) {
      job = new ModuleJob(this, url, formatProviders.get(format));
      this.moduleMap.set(urlString, job);
    }
    return job;
  }

  async import(specifier, parentURLOrString = this.base) {
    const job = await this.getModuleJob(specifier, parentURLOrString);
    const module = await job.run();
    return getNamespaceOfModuleWrap(module);
  }
}
Object.setPrototypeOf(Loader.prototype, null);
module.exports = Loader;
