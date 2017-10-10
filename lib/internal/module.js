'use strict';

// Invoke with makeRequireFunction(module) where |module| is the Module object
// to use as the context for the require() function.
function makeRequireFunction(mod) {
  const Module = mod.constructor;

  function require(path) {
    try {
      exports.requireDepth += 1;
      return mod.require(path);
    } finally {
      exports.requireDepth -= 1;
    }
  }

  function resolve(request) {
    return Module._resolveFilename(request, mod);
  }

  require.resolve = resolve;

  require.main = process.mainModule;

  // Enable support to add extra extension types.
  require.extensions = Module._extensions;

  require.cache = Module._cache;

  return require;
}

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 * because the buffer-to-string conversion in `fs.readFileSync()`
 * translates it to FEFF, the UTF-16 BOM.
 */
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

/**
 * Find end of shebang line and slice it off
 */
function stripShebang(content) {
  // Remove shebang
  var contLen = content.length;
  if (contLen >= 2) {
    if (content.charCodeAt(0) === 35/*#*/ &&
        content.charCodeAt(1) === 33/*!*/) {
      if (contLen === 2) {
        // Exact match
        content = '';
      } else {
        // Find end of shebang line and slice it off
        var i = 2;
        for (; i < contLen; ++i) {
          var code = content.charCodeAt(i);
          if (code === 10/*\n*/ || code === 13/*\r*/)
            break;
        }
        if (i === contLen)
          content = '';
        else {
          // Note that this actually includes the newline character(s) in the
          // new output. This duplicates the behavior of the regular expression
          // that was previously used to replace the shebang line
          content = content.slice(i);
        }
      }
    }
  }
  return content;
}

const builtinLibs = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'crypto',
  'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https', 'net',
  'os', 'path', 'perf_hooks', 'punycode', 'querystring', 'readline', 'repl',
  'stream', 'string_decoder', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'zlib'
];

if (typeof process.binding('inspector').connect === 'function') {
  builtinLibs.push('inspector');
  builtinLibs.sort();
}

function addBuiltinLibsToObject(object) {
  // Make built-in modules available directly (loaded lazily).
  builtinLibs.forEach((name) => {
    // Goals of this mechanism are:
    // - Lazy loading of built-in modules
    // - Having all built-in modules available as non-enumerable properties
    // - Allowing the user to re-assign these variables as if there were no
    //   pre-existing globals with the same name.

    const setReal = (val) => {
      // Deleting the property before re-assigning it disables the
      // getter/setter mechanism.
      delete object[name];
      object[name] = val;
    };

    Object.defineProperty(object, name, {
      get: () => {
        const lib = require('module')._load(name);

        // Disable the current getter/setter and set up a new
        // non-enumerable property.
        delete object[name];
        Object.defineProperty(object, name, {
          get: () => lib,
          set: setReal,
          configurable: true,
          enumerable: false
        });

        return lib;
      },
      set: setReal,
      configurable: true,
      enumerable: false
    });
  });
}

const STRING_PATTERN = /((?:'(\\[^\r\n]|[^'])*')|(?:"(\\[^\r\n]|[^"])*"));?/g;
const SKIP = /(?:(?:\/\/[^\r\n]*(?:\r?\n|$)*?|\/\*[\s\S]*?\*\/)|[\s\r\n]+)+/g;
const EXPORT_PROLOGUE = /^.use exports \{((?:\s*[^\s,]+\s*(?=[,\}]),?)*)\s*\}.$/;
function getExportPrologueNames(src) {
  for (let i = 0; i < src.length;) {
    SKIP.lastIndex = i;
    let toSkip = SKIP.exec(src);
    if (toSkip && toSkip.index === i) {
      i = SKIP.lastIndex;
      continue;
    }
    STRING_PATTERN.lastIndex = i;
    let string = STRING_PATTERN.exec(src);
    if (string && string.index === i) {
      let prologue = EXPORT_PROLOGUE.exec(string[1]);
      if (prologue) {
        return new Set(prologue[1].split(',').map(s => s.trim()).filter(Boolean));
      }
      else {
        i = STRING_PATTERN.lastIndex;
        continue;
      }
    }
    break;
  }
  return undefined;
}
const nativeProxies = new Map();

module.exports = exports = {
  addBuiltinLibsToObject,
  builtinLibs,
  getExportPrologueNames,
  makeRequireFunction,
  requireDepth: 0,
  stripBOM,
  stripShebang,
  nativeProxies,
  getOrInsertNativeProxy: filename => {
    if (nativeProxies.has(filename)) {
      return nativeProxies.get(filename);
    }
    const content = require('fs').readFileSync(filename, 'utf8');
    const src = stripBOM(content);
    const exportNames = getExportPrologueNames(src);
    let reflect;
    const url = require('internal/url').getURLFromFilePath(filename);
    if (!exportNames) {
      const module = require('internal/loader/ModuleWrap').createDynamicModule(['default'], url, (reflect) => {
        //debug(`Loading CJSModule ${this.pathname}`);
        const CJSModule = require('module');
        CJSModule._load(filename);
      });
      reflect = {
        module: module.module,
        setupExports(module) {
          module.exports = {};
        },
        finish() {
          module.reflect.exports.default.set(module.exports);
        }
      }
    }
    else {
      const {module, target} = require('internal/loader/ModuleWrap').createInvariantModule(
        exports,
        exportNames,
        url,
        () => {
          const CJSModule = require('module');
          CJSModule._load(filename);
        }
      );
      reflect = {
        module,
        setupExports(module) {
          Object.defineProperty(module, 'exports', {
            value: target,
            writable: false,
            enumerable: true,
            configurable: false
          })
        },
        finish() {}
      }
    }
    nativeProxies.set(filename, reflect);
    return reflect;
  }
};
