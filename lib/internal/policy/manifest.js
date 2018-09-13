//
// {
//   "resources": {
//      "url": {
//        "integrity": "sri"
//      }
//   }
// }
//
const SRI = require('internal/policy/sri');
const crypto = require('crypto');
class Manifest {
  constructor(obj) {
    this._integrities = {
      __proto__: null,
    };
    this._policies = {
      __proto__: null,
    };
    for (const [url, {
      integrity,
      policy
    }] of Object.entries(obj.resources)) {
      if (integrity != null) {
        this._integrities[url] = SRI.parse(integrity);
      }
      if (policy != null) {
        if (policy in obj.policies) {
          this._policies[url] = obj.policies[policy];
        } else {
          throw TypeError(`Cannot use undefined policy ${policy}`);
        }
      }
    }
  }
  createVariables(url, vars) {
    const {
      variables = {__proto__: null},
      dependencies = {__proto__: null},
    } = this._policies[url].privileges;
    let {
      filename,
      dirname,
      thisValue,
      exports,
      module,
      require,
    } = vars;
    if (!variables['require.cache']) {
      delete require.cache;
    }
    if (!variables['__filename']) {
      filename = null;
    }
    if (!variables['__dirname']) {
      dirname = null;
    }
    if (!variables['module.children']) {
      delete module.children;
    }
    if (!variables['module.parent']) {
      delete module.parent;
    }
    if (!variables['module.paths']) {
      delete module.paths;
    }
    if (!variables['module.loaded']) {
      delete module.loaded;
    }
    if (!variables['require.extensions']) {
      delete require.extensions;
    }
    if (!variables['require.main']) {
      delete require.main;
    }
    const _require = require;
    const nonBareSpecifierPattern = /^\.?\.?[\/]/;
    require = function require(...args) {
      // TODO: should this verify against resolved **OR** requested?
      //       right now just requested
      const isBare = !nonBareSpecifierPattern.test(args[0]);
      if (isBare && !(dependencies[args[0]] === true)) {
        throw new EvalError(`Insufficient permissions to load ${args[0]}`);
      }
      return _require(...args);
    };
    return {
      __proto__: null,
      filename,
      dirname,
      thisValue,
      exports,
      module,
      require
    };
  }
  matchesIntegrity(url, content) {
    if (url in this._integrities) {
      const integrityEntries = this._integrities[url];
      for (const {algorithm, value: expected} of integrityEntries) {
        const hash = crypto.createHash(algorithm);
        hash.update(content);
        const digest = hash.digest('base64');
        if (digest === expected) {
          return true;
        }
      }
    }
    return false;
  }
}
Object.setPrototypeOf(Manifest, null);
Object.setPrototypeOf(Manifest.prototype, null);
Object.freeze(Manifest);
Object.freeze(Manifest.prototype);
module.exports = { Manifest };
