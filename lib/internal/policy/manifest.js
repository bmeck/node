'use strict';

//#region imports
/**
 * @type {(o: any) => o is Array}
 */
const ArrayIsArray = primordials.ArrayIsArray;
const {
  ObjectCreate,
  ObjectEntries,
  ObjectFreeze,
  ObjectKeys,
  ObjectSetPrototypeOf,
  RegExpPrototypeTest,
  SafeMap,
  SafeSet,
  StringPrototypeEndsWith,
  StringPrototypeReplace,
  Symbol,
  uncurryThis,
} = primordials;
const {
  canBeRequiredByUsers,
} = require('internal/bootstrap/loaders').NativeModule;
const {
  ERR_MANIFEST_ASSERT_INTEGRITY,
  ERR_MANIFEST_INTEGRITY_MISMATCH,
  ERR_MANIFEST_INVALID_RESOURCE_FIELD,
  ERR_MANIFEST_UNKNOWN_ONERROR,
} = require('internal/errors').codes;
let debug = require('internal/util/debuglog').debuglog('policy', (fn) => {
  debug = fn;
});
const SRI = require('internal/policy/sri');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const { URL } = require('internal/url');
const { createHash, timingSafeEqual } = crypto;
const HashUpdate = uncurryThis(crypto.Hash.prototype.update);
const HashDigest = uncurryThis(crypto.Hash.prototype.digest);
const BufferToString = uncurryThis(Buffer.prototype.toString);
const kRelativeURLStringPattern = /^\.{0,2}\//;
const { getOptionValue } = require('internal/options');
const shouldAbortOnUncaughtException = getOptionValue(
  '--abort-on-uncaught-exception'
);
const { abort, exit, _rawDebug } = process;
//#endregion

//#region constants
// From https://url.spec.whatwg.org/#special-scheme
const kSpecialSchemes = new SafeSet([
  'file:',
  'ftp:',
  'http:',
  'https:',
  'ws:',
  'wss:',
]);

/**
 * @type {symbol}
 */
const kCascade = Symbol('cascade');
/**
 * @type {symbol}
 */
const kFallThrough = Symbol('fall through');

function REACTION_THROW(error) {
  throw error;
}

function REACTION_EXIT(error) {
  REACTION_LOG(error);
  if (shouldAbortOnUncaughtException) {
    abort();
  }
  exit(1);
}

function REACTION_LOG(error) {
  _rawDebug(error.stack);
}

//#endregion

/**
 * @typedef {Record<string, string> | typeof kFallThrough} DependencyMap
 * @typedef {Record<string, string> | null | true} JSONDependencyMap
 */
/**
 * @typedef {Map<string, any>} ScopeStore
 * @typedef {(specifier: string) => true | URL} DependencyMapper
 * @typedef {boolean | string | SRI[] | typeof kCascade} Integrity
 */

class Manifest {
  /**
   * @type {string}
   */
  href;
  /**
   * @type {ScopeStore}
   *
   * Used to compare a resource to the content body at the resource.
   * `true` is used to signify that all integrities are allowed, otherwise,
   * SRI strings are parsed to compare with the body.
   *
   * Separate from #resourceDependencies due to conflicts with things like
   * `blob:` being both a scope and a resource potentially as well as
   * `file:` being parsed to `file:///` instead of remaining host neutral.
   */
  #scopeDependencies = new SafeMap();
  /**
   * @type {Map<string, boolean | null | typeof kCascade>}
   *
   * Used to allow arbitrary loading within a scope
   */
  #scopeIntegrities = new SafeMap();
  /**
   * @type {Map<string, Integrity>}
   *
   * Used to compare a resource to the content body at the resource.
   * `true` is used to signify that all integrities are allowed, otherwise,
   * SRI strings are parsed to compare with the body.
   *
   * This stores strings instead of eagerly parsing SRI strings
   * and only converts them to SRI data structures when needed.
   * This avoids needing to parse all SRI strings at startup even
   * if some never end up being used.
   */
  #resourceIntegrities = new SafeMap();
  /**
   * @type {Map<string, DependencyMapperInstance>}
   *
   * Used to find where a dependency is located.
   *
   * This stores functions to lazily calculate locations as needed.
   * `true` is used to signify that the location is not specified
   * by the manifest and default resolution should be allowed.
   *
   * The functions return `null` to signify that a dependency is
   * not found
   */
  #resourceDependencies = new SafeMap();
  /**
   * @type {(err: Error) => void}
   *
   * Performs default action for what happens when a manifest encounters
   * a violation such as abort()ing or exiting the process, throwing the error,
   * or logging the error.
   */
  #reaction;
  /**
   * `obj` should match the policy file format described in the docs
   * it is expected to not have prototype pollution issues either by reassigning
   * the prototype to `null` for values or by running prior to any user code.
   *
   * `manifestURL` is a URL to resolve relative locations against.
   *
   * @param {object} obj
   * @param {string} manifestHREF
   */
  constructor(obj, manifestHREF) {
    this.href = manifestHREF;
    const scopes = this.#scopeDependencies;
    const integrities = this.#resourceIntegrities;
    const resourceDependencies = this.#resourceDependencies;
    let reaction = REACTION_THROW;

    if (objectButNotArray(obj) && 'onerror' in obj) {
      const behavior = obj.onerror;
      if (behavior === 'throw') {
      } else if (behavior === 'exit') {
        reaction = REACTION_EXIT;
      } else if (behavior === 'log') {
        reaction = REACTION_LOG;
      } else {
        throw new ERR_MANIFEST_UNKNOWN_ONERROR(behavior);
      }
    }

    this.#reaction = reaction;
    const jsonResourcesEntries = ObjectEntries(
      obj.resources ?? ObjectCreate(null)
    );
    const jsonScopesEntries = ObjectEntries(obj.scopes ?? ObjectCreate(null));

    for (let i = 0; i < jsonResourcesEntries.length; i++) {
      const { 0: originalHREF, 1: descriptor } = jsonResourcesEntries[i];
      const { cascade, dependencies, integrity } = descriptor;
      const href = resolve(originalHREF, manifestHREF).href;

      if (typeof integrity !== 'undefined') {
        debug('Manifest contains integrity for resource %s', originalHREF);
        if (typeof integrity === 'string') {
          integrities.set(href, integrity);
        } else if (integrity === true) {
          integrities.set(href, true);
        } else {
          throw new ERR_MANIFEST_INVALID_RESOURCE_FIELD(href, 'integrity');
        }
      } else {
        integrities.set(href, cascade === true ? kCascade : false);
      }
      insertDependencyMap(href, dependencies, cascade, resourceDependencies);
    }

    const scopeIntegrities = this.#scopeIntegrities;
    for (let i = 0; i < jsonScopesEntries.length; i++) {
      const { 0: originalHREF, 1: descriptor } = jsonScopesEntries[i];
      const { cascade, dependencies, integrity } = descriptor;
      const href = emptyOrProtocolOrResolve(originalHREF);
      if (typeof integrity !== 'undefined') {
        debug('Manifest contains integrity for scope %s', originalHREF);
        if (integrity === true) {
          scopeIntegrities.set(href, true);
        } else {
          throw new ERR_MANIFEST_INVALID_RESOURCE_FIELD(href, 'integrity');
        }
      } else {
        scopeIntegrities.set(href, cascade === true ? kCascade : false);
      }
      insertDependencyMap(href, dependencies, cascade, scopes);
    }

    ObjectFreeze(this);
  }

  /**
   * @param {string} requester
   * @returns {{resolve: any, reaction: (err: any) => void}}
   */
  getDependencyMapper(requester) {
    const requesterHREF = `${requester}`;
    const dependencies = this.#resourceDependencies;
    /**
     * @type {DependencyMapperInstance | null}
     */
    const instance = dependencies.has(requesterHREF)
      ? dependencies.get(requesterHREF) ?? null
      : this.getScopeDependencyMapper(requesterHREF);
    return {
      resolve: (specifier, conditions) => {
        if (!instance) return null;
        const normalizedSpecifier = canonicalizeSpecifier(specifier, requesterHREF);
        const result = instance._resolveAlreadyNormalized(normalizedSpecifier, conditions, this);
        if (result === kFallThrough) return true;
        return result;
      },
      reaction: this.#reaction
    }
  }

  assertIntegrity(url, content) {
    const href = `${url}`;
    debug('Checking integrity of %s', href);
    const realIntegrities = new SafeMap();
    const integrities = this.#resourceIntegrities;
    function processEntry(href) {
      let integrityEntries = integrities.get(href);
      if (integrityEntries === true) return true;
      if (typeof integrityEntries === 'string') {
        const sri = ObjectFreeze(SRI.parse(integrityEntries));
        integrities.set(href, sri);
        integrityEntries = sri;
      }
      return integrityEntries;
    }
    if (integrities.has(href)) {
      const integrityEntries = processEntry(href);
      if (integrityEntries === true) return true;
      if (ArrayIsArray(integrityEntries)) {
        // Avoid clobbered Symbol.iterator
        for (let i = 0; i < integrityEntries.length; i++) {
          const { algorithm, value: expected } = integrityEntries[i];
          const hash = createHash(algorithm);
          HashUpdate(hash, content);
          const digest = HashDigest(hash);
          if (
            digest.length === expected.length &&
            timingSafeEqual(digest, expected)
          ) {
            return true;
          }
          realIntegrities.set(algorithm, BufferToString(digest, 'base64'));
        }
      }

      if (integrityEntries !== kCascade) {
        const error = new ERR_MANIFEST_ASSERT_INTEGRITY(url, realIntegrities);
        this.#reaction(error);
      }
    }
    let scope = findScopeHREF(href, this.#scopeIntegrities);
    while (scope !== null) {
      if (this.#scopeIntegrities.has(scope)) {
        const entry = this.#scopeIntegrities.get(scope);
        if (entry === true) {
          return true;
        } else if (entry === kCascade) {
        } else {
          break;
        }
      }
      const nextScope = findScopeHREF(
        new URL('..', scope),
        this.#scopeDependencies
      );
      if (!nextScope || nextScope === scope) {
        break;
      }
      scope = nextScope;
    }
    const error = new ERR_MANIFEST_ASSERT_INTEGRITY(url, realIntegrities);
    this.#reaction(error);
  }
  /**
   * @param {string} parentHREF
   * @returns {DependencyMapperInstance | null}
   */
  getScopeDependencyMapper(parentHREF) {
    let scopes = this.#scopeDependencies;
    /** @type {string | null} */
    let scopeHREF = parentHREF;
    do {
      scopeHREF = findScopeHREF(scopeHREF, this.#scopeDependencies);
      if (scopeHREF === null) break;
      if (scopeHREF === parentHREF) {
        scopeHREF = null;
        break;
      }
      if (scopes.has(scopeHREF)) {
        break;
      }
    } while (true);
    if (scopeHREF === null) return null;
    return this.#scopeDependencies.get(scopeHREF);
  }
}

// Lock everything down to avoid problems even if reference is leaked somehow
ObjectSetPrototypeOf(Manifest, null);
ObjectSetPrototypeOf(Manifest.prototype, null);
ObjectFreeze(Manifest);
ObjectFreeze(Manifest.prototype);
module.exports = ObjectFreeze({ Manifest });

//#region DependencyMapperInstance
class DependencyMapperInstance {
  /**
   * @type {string}
   */
  href;
  /**
   * @type {DependencyMap | undefined}
   */
  #dependencies;
  /**
   * @type {DependencyMapperInstance | null | undefined}
   */
  #parentDependencyMapper;
  /**
   * @type {boolean}
   */
  #normalized = false;
  /**
   * @type {boolean}
   */
  cascade;
  constructor(parentHREF, dependencies, cascade = false) {
    this.href = parentHREF;
    this.#dependencies = dependencies;
    this.cascade = cascade;
    ObjectFreeze(this);
  }
  /**
   *
   * @param {string} normalizedSpecifier
   * @param {Set<string>} conditions
   * @param {Manifest} manifest
   * @returns {URL | typeof kFallThrough | null}
   */
  _resolveAlreadyNormalized(normalizedSpecifier, conditions, manifest) {
    let dependencies = this.#dependencies;
    if (dependencies === kFallThrough) return kFallThrough;
    if (dependencies !== undefined && typeof dependencies === 'object') {
      const normalized = this.#normalized;
      if (normalized !== true) {
        /**
         * @type {Record<string, string>}
         */
        const normalizedDependencyMap = ObjectCreate(null);
        for (let specifier in dependencies) {
          const target = dependencies[specifier];
          specifier = canonicalizeSpecifier(specifier, manifest.href);
          normalizedDependencyMap[specifier] = target;
        }
        ObjectFreeze(normalizedDependencyMap);
        dependencies = normalizedDependencyMap;
        this.#dependencies = normalizedDependencyMap;
        this.#normalized = true;
      }
      if (normalizedSpecifier in dependencies === true) {
        let to = searchDependencies(
          this.href,
          dependencies[normalizedSpecifier],
          conditions
        );
        if (to === true) {
          return kFallThrough;
        }
        let ret;
        if (parsedURLs && parsedURLs.has(to)) {
          ret = parsedURLs.get(to);
        } else if (RegExpPrototypeTest(kRelativeURLStringPattern, to)) {
          ret = resolve(to, manifest.href);
        } else {
          ret = resolve(to);
        }
        return ret;
      }
    }
    const { cascade } = this;
    if (cascade !== true) {
      return null;
    }
    let parentDependencyMapper = this.#parentDependencyMapper;
    if (parentDependencyMapper === undefined) {
      parentDependencyMapper = manifest.getScopeDependencyMapper(this.href);
      this.#parentDependencyMapper = parentDependencyMapper;
    }
    if (parentDependencyMapper === null) {
      return null;
    }
    return parentDependencyMapper._resolveAlreadyNormalized(
      normalizedSpecifier,
      conditions,
      manifest
    );
  }
}

const kArbitraryDependencies = new DependencyMapperInstance(
  'arbitrary dependencies',
  kFallThrough,
  false
);
const kNoDependencies = new DependencyMapperInstance('no dependencies', null, false);
/**
 * @param {string} href
 * @param {JSONDependencyMap} dependencies
 * @param {boolean} cascade
 * @param {Map<string | null | undefined, DependencyMapperInstance>} store
 */
const insertDependencyMap = (href, dependencies, cascade, store) => {
  if (cascade !== undefined && typeof cascade !== 'boolean') {
    throw new ERR_MANIFEST_INVALID_RESOURCE_FIELD(href, 'cascade');
  }
  if (dependencies === true) {
    store.set(href, kArbitraryDependencies);
    return;
  }
  if (dependencies === null || dependencies === undefined) {
    store.set(href, kNoDependencies);
    return;
  }
  if (objectButNotArray(dependencies)) {
    store.set(href, new DependencyMapperInstance(href, dependencies, cascade));
    return;
  }
  throw new ERR_MANIFEST_INVALID_RESOURCE_FIELD(href, 'dependencies');
};
/**
 * Finds the longest key within `this.#scopeDependencies` that covers a
 * specific HREF
 * @param {string} href
 * @param {ScopeStore} scopeStore
 * @returns {null | string}
 */
function findScopeHREF(href, scopeStore) {
  let currentURL = new URL(href);
  let protocol = currentURL.protocol;
  // Non-opaque blobs adopt origins
  if (protocol === 'blob:' && currentURL.origin !== 'null') {
    currentURL = new URL(currentURL.origin);
    protocol = currentURL.protocol;
  }
  // Only a few schemes are hierarchical
  if (kSpecialSchemes.has(currentURL.protocol)) {
    // Make first '..' act like '.'
    if (!StringPrototypeEndsWith(currentURL.pathname, '/')) {
      currentURL.pathname += '/';
    }
    let lastHREF;
    let currentHREF = currentURL.href;
    do {
      if (scopeStore.has(currentHREF)) {
        return currentHREF;
      }
      lastHREF = currentHREF;
      currentURL = new URL('..', currentURL);
      currentHREF = currentURL.href;
    } while (lastHREF !== currentHREF);
  }
  if (scopeStore.has(protocol)) {
    return protocol;
  }
  if (scopeStore.has('')) {
    return '';
  }
  return null;
}

//#endregion

//#region URL utils

/**
 * Attempts to canonicalize relative URL strings against a base URL string
 * Does not perform I/O
 * If not able to canonicalize, returns the original specifier
 *
 * This effectively removes the possibility of the return value being a relative
 * URL string
 * @param {string} specifier
 * @param {string} base
 * @returns {string}
 */
function canonicalizeSpecifier(specifier, base) {
  try {
    if (RegExpPrototypeTest(kRelativeURLStringPattern, specifier)) {
      return resolve(specifier, base).href;
    } else {
      return resolve(specifier).href;
    }
  } catch {}
  return specifier;
}

/**
 * Does a special allowance for scopes to be non-valid URLs
 * that are only protocol strings or the empty string
 * @param {string} resourceHREF
 * @returns {string}
 */
const emptyOrProtocolOrResolve = (resourceHREF) => {
  if (StringPrototypeEndsWith(resourceHREF, ':')) {
    // URL parse will trim these anyway, save the compute
    resourceHREF = StringPrototypeReplace(
      resourceHREF,
      // eslint-disable-next-line
      /^[\x00-\x1F\x20]|\x09\x0A\x0D|[\x00-\x1F\x20]$/g,
      ''
    );
    if (RegExpPrototypeTest(/^[a-zA-Z][a-zA-Z+\-.]*:$/, resourceHREF)) {
      return resourceHREF;
    }
  }
  return resolve(resourceHREF);
};

/**
 * @type {Map<string, URL>}
 */
let parsedURLs;
/**
 * Resolves a valid url string against the manifest
 * @param {string} originalHREF
 * @param {string} [base]
 * @returns {URL}
 */
const resolve = (originalHREF, base) => {
  parsedURLs = parsedURLs ?? new SafeMap();
  if (parsedURLs.has(originalHREF)) {
    return parsedURLs.get(originalHREF);
  } else if (RegExpPrototypeTest(kRelativeURLStringPattern, originalHREF)) {
    const resourceURL = new URL(originalHREF, base);
    parsedURLs.set(resourceURL.href, resourceURL);
    return resourceURL;
  }
  const resourceURL = new URL(originalHREF);
  parsedURLs.set(originalHREF, resourceURL);
  return resourceURL;
};

//#endregion

/**
 * @param {any} o
 * @returns {o is object}
 */
function objectButNotArray(o) {
  return o && typeof o === 'object' && !ArrayIsArray(o);
}

function searchDependencies(href, target, conditions) {
  if (objectButNotArray(target)) {
    const keys = ObjectKeys(target);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (conditions.has(key)) {
        const ret = searchDependencies(href, target[key], conditions);
        if (ret != null) {
          return ret;
        }
      }
    }
  } else if (typeof target === 'string') {
    return target;
  } else if (target === true) {
    return target;
  } else {
    throw new ERR_MANIFEST_INVALID_RESOURCE_FIELD(href, 'dependencies');
  }
  return null;
}
