'use strict';
//
// {
//   "resources": {
//      "url": {
//        "integrity": "sri"
//      }
//   }
// }
//
const {
  ERR_MANIFEST_ASSERT_DEPENDENCY,
  ERR_MANIFEST_ASSERT_INTEGRITY,
  ERR_MANIFEST_PARSE_INTEGRITY,
  ERR_MANIFEST_PARSE_POLICY
} = require('internal/errors').codes;
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
        try {
          this._integrities[url] = SRI.parse(integrity);
        } catch (e) {
          throw new ERR_MANIFEST_PARSE_INTEGRITY(url, e.message);
        }
      }
      if (policy != null) {
        if (policy in obj.policies) {
          this._policies[url] = obj.policies[policy];
        } else {
          throw new ERR_MANIFEST_PARSE_POLICY(url, policy);
        }
      }
    }
    Object.freeze(this._policies);
    Object.freeze(this._integrities);
    Object.freeze(this);
  }
  createVariables(url, vars) {
    const {
      variables = { __proto__: null },
      dependencies = { __proto__: null },
    } = this._policies[url].privileges;
    let {
      filename,
      dirname,
      require,
    } = vars;
    if (!variables['require.cache']) {
      delete require.cache;
    }
    if (!variables.__filename) {
      filename = null;
    }
    if (!variables.__dirname) {
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
    const nonBareSpecifierPattern = /^\.?\.?[/]/;
    require = function require(...args) {
      // TODO: should this verify against resolved **OR** requested?
      //       right now just requested
      const isBare = !nonBareSpecifierPattern.test(args[0]);
      if (isBare && !(dependencies[args[0]] === true)) {
        throw new ERR_MANIFEST_ASSERT_DEPENDENCY(args[0]);
      }
      return _require(...args);
    };
    return {
      __proto__: null,
      filename,
      dirname,
      thisValue: vars.thisValue,
      exports: vars.exports,
      module: vars.module,
      require
    };
  }
  assertIntegrity(url, content) {
    const realIntegrities = new Map();
    if (url in this._integrities) {
      const integrityEntries = this._integrities[url];
      for (const { algorithm, value: expected } of integrityEntries) {
        let digest;
        if (realIntegrities.has(algorithm)) {
          digest = realIntegrities.get(algorithm);
        } else {
          const hash = crypto.createHash(algorithm);
          hash.update(content);
          digest = hash.digest('base64');
        }
        if (digest === expected) {
          return true;
        }
        realIntegrities.set(algorithm, digest);
      }
    }
    throw new ERR_MANIFEST_ASSERT_INTEGRITY(url, realIntegrities);
  }
}
Object.setPrototypeOf(Manifest, null);
Object.setPrototypeOf(Manifest.prototype, null);
Object.freeze(Manifest);
Object.freeze(Manifest.prototype);
module.exports = { Manifest };
