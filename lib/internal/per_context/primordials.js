'use strict';

/* eslint-disable no-restricted-globals */

// This file subclasses and stores the JS builtins that come from the VM
// so that Node.js's builtin modules do not need to later look these up from
// the global proxy, which can be mutated by users.

// TODO(joyeecheung): we can restrict access to these globals in builtin
// modules through the JS linter, for example: ban access such as `Object`
// (which falls back to a lookup in the global proxy) in favor of
// `primordials.Object` where `primordials` is a lexical variable passed
// by the native module compiler.

const ReflectApply = Reflect.apply;

// This function is borrowed from the function with the same name on V8 Extras'
// `utils` object. V8 implements Reflect.apply very efficiently in conjunction
// with the spread syntax, such that no additional special case is needed for
// function calls w/o arguments.
// Refs: https://github.com/v8/v8/blob/d6ead37d265d7215cf9c5f768f279e21bd170212/src/js/prologue.js#L152-L156
function uncurryThis(func) {
  return (thisArg, ...args) => ReflectApply(func, thisArg, args);
}

primordials.uncurryThis = uncurryThis;

function copyProps(src, dest) {
  for (const key of Reflect.ownKeys(src)) {
    if (!Reflect.getOwnPropertyDescriptor(dest, key)) {
      Reflect.defineProperty(
        dest,
        key,
        Reflect.getOwnPropertyDescriptor(src, key));
    }
  }
}

function capitalize(str) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function copyPropsRenamed(src, dest, prefix) {
  for (const key of Reflect.ownKeys(src)) {
    if (typeof key === 'string') {
      Reflect.defineProperty(
        dest,
        `${prefix}${capitalize(key)}`,
        Reflect.getOwnPropertyDescriptor(src, key));
    }
  }
}

function copyPropsRenamedBound(src, dest, prefix) {
  for (const key of Reflect.ownKeys(src)) {
    if (typeof key === 'string') {
      const desc = Reflect.getOwnPropertyDescriptor(src, key);
      if (typeof desc.value === 'function') {
        desc.value = desc.value.bind(src);
      }
      Reflect.defineProperty(
        dest,
        `${prefix}${capitalize(key)}`,
        desc
      );
    }
  }
}

function copyPrototype(src, dest, prefix) {
  for (const key of Reflect.ownKeys(src)) {
    if (typeof key === 'string') {
      const desc = Reflect.getOwnPropertyDescriptor(src, key);
      if (typeof desc.value === 'function') {
        desc.value = uncurryThis(desc.value);
      }
      Reflect.defineProperty(
        dest,
        `${prefix}${capitalize(key)}`,
        desc);
    }
  }
}

// /**
//  * @param {[string, string[]]} globals
//  * @param {[string, [string, string[]][]]} builtins
//  */
// const runtimePickers = [];
// primordials.runtimeMappings = Object.create(null);
// primordials.initRuntimeMappings = (require) => {
//   for (const picker of runtimePickers) {
//     picker(require);
//   }
// };
// function pushPropertyPicker(id, base, path) {
//   runtimePickers.push(() => {
//     let ret = base;
//     for (let i = 0; i < path.length; i++) {
//       ret = ret[path[i]];
//       // this will make `in` false
//       if (!ret) return;
//     }
//     primordials.runtimeMappings[id] = ret;
//   });
// }
// function pushModulePicker(id, module, path) {
//   runtimePickers.push((require) => {
//     let ret = require(module);
//     for (let i = 0; i < path.length; i++) {
//       ret = ret[path[i]];
//       // this will make `in` false
//       if (!ret) return;
//     }
//     primordials.runtimeMappings[id] = ret;
//   });
// }
// {
//   const {
//     savePropertyPath,
//     saveModulePaths
//   } = (function () {
//     const knownIds = new Map();
//     /**
//      * @type {Map<any, Map<string, string>>}
//      */
//     const knownPaths = new Map();
//     const knownModules = new Map();
//     const knownSymbols = [];
//     function createPathKey(path) {
//       return JSON.stringify(path.map(
//         (k) => {
//           if (typeof k === 'string') return `string:${k}`;
//           if (typeof k === 'symbol') {
//             let symbolIndex = knownSymbols.indexOf(k);
//             if (symbolIndex === -1) {
//               symbolIndex = knownSymbols.length;
//               knownSymbols.push(k);
//             }
//             return `symbol:${symbolIndex}`;
//           }
//           // eslint-disable-next-line no-restricted-syntax
//           throw new Error('unknown path segment: ' + k);
//         }
//       ));
//     }

//     /**
//      * @param {{module: string, id: string, path: string[]}[]} mappings
//      */
//     function saveModulePaths(mappings) {
//       for (const { module: moduleSpecifier, id, path } of mappings) {
//         if (knownIds.has(id)) {
//           // eslint-disable-next-line no-restricted-syntax
//           throw new Error(`already have runtime id of: ${
//             id
//           } in ${moduleSpecifier} path ${path}`);
//         }
//         knownIds.set(id, { module: moduleSpecifier, path });
//         if (!knownModules.has(moduleSpecifier)) {
//           knownModules.set(moduleSpecifier, new Map());
//         }
//         const pathKey = createPathKey(path);
//         const basePaths = knownModules.get(moduleSpecifier);
//         if (basePaths.has(pathKey)) {
//           // eslint-disable-next-line no-restricted-syntax
//           throw new Error(`already have runtime id of: ${
//             basePaths.get(pathKey)
//           } for ${moduleSpecifier} path ${path}`);
//         }
//         basePaths.set(pathKey, id);
//         pushModulePicker(id, moduleSpecifier, path);
//       }
//     }
//     /**
//      * @param {{base: any, id: string, path: string[]}[]} mappings
//      */
//     function savePropertyPath(mappings) {
//       for (const { base, id, path } of mappings) {
//         if (knownIds.has(id)) {
//           // eslint-disable-next-line no-restricted-syntax
//           throw new Error(`already have runtime id of: ${
//             id
//           } in ${base} path ${path}`);
//         }
//         knownIds.set(id, { base, path });
//         if (!knownPaths.has(base)) {
//           knownPaths.set(base, new Map());
//         }
//         const pathKey = createPathKey(path);
//         const basePaths = knownPaths.get(base);
//         if (basePaths.has(pathKey)) {
//           // eslint-disable-next-line no-restricted-syntax
//           throw new Error(`already have runtime id of: ${
//             basePaths.get(pathKey)
//           } for ${base} path ${path}`);
//         }
//         basePaths.set(pathKey, id);
//         pushPropertyPicker(id, base, path);
//       }
//     }

//     return {
//       savePropertyPath,
//       saveModulePaths
//     };
//   })();
//   savePropertyPath([
//     { id: 'WebAssemblyCompile', base: globalThis, path: ['WebAssembly', 'compile'] }
//   ]);
//   saveModulePaths([
//     { id: 'FSReadFile', module: 'fs', path: ['readFile'], }
//   ]);
// }

function makeSafe(unsafe, safe) {
  copyProps(unsafe.prototype, safe.prototype);
  copyProps(unsafe, safe);
  Object.setPrototypeOf(safe.prototype, null);
  Object.freeze(safe.prototype);
  Object.freeze(safe);
  return safe;
}

// Subclass the constructors because we need to use their prototype
// methods later.
primordials.SafeMap = makeSafe(
  Map,
  class SafeMap extends Map {}
);
primordials.SafeWeakMap = makeSafe(
  WeakMap,
  class SafeWeakMap extends WeakMap {}
);
primordials.SafeSet = makeSafe(
  Set,
  class SafeSet extends Set {}
);
primordials.SafePromise = makeSafe(
  Promise,
  class SafePromise extends Promise {}
);

// Create copies of the namespace objects
[
  'JSON',
  'Math',
  'Reflect'
].forEach((name) => {
  copyPropsRenamed(global[name], primordials, name);
});

// Create copies of intrinsic objects
[
  'Array',
  'ArrayBuffer',
  'BigInt',
  'BigInt64Array',
  'BigUint64Array',
  'Boolean',
  'Date',
  'Error',
  'Float32Array',
  'Float64Array',
  'Function',
  'Int16Array',
  'Int32Array',
  'Int8Array',
  'Map',
  'Number',
  'Object',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'Uint16Array',
  'Uint32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'WeakMap',
  'WeakSet',
].forEach((name) => {
  const original = global[name];
  primordials[name] = original;
  copyPropsRenamed(original, primordials, name);
  copyPrototype(original.prototype, primordials, `${name}Prototype`);
});

// Create copies of intrinsic objects that require a valid `this` to call
// static methods.
// Refs: https://www.ecma-international.org/ecma-262/#sec-promise.all
[
  'Promise',
].forEach((name) => {
  const original = global[name];
  primordials[name] = original;
  copyPropsRenamedBound(original, primordials, name);
  copyPrototype(original.prototype, primordials, `${name}Prototype`);
});

Object.setPrototypeOf(primordials, null);
Object.freeze(primordials);
