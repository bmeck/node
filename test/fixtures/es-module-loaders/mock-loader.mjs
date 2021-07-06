import {receiveMessageOnPort} from 'worker_threads';
const mockedModuleExports = new Map();
let currentMockVersion = 0;

/**
 * FIXME: this is a hack to workaround loaders being
 * single threaded for now
 */
function doDrainPort() {
  let msg;
  while (msg = receiveMessageOnPort(preloadPort)) {
    onPreloadPortMessage(msg.message);
  }
}
function onPreloadPortMessage({
  mockVersion, resolved, exports
}) {
  currentMockVersion = mockVersion;
  mockedModuleExports.set(resolved, exports);
}
let preloadPort;
export function getGlobalPreloadCode({port}) {
  preloadPort = port;
  port.on('message', onPreloadPortMessage);
  port.unref();
  return `(${()=>{
    let mockedModules = new Map();
    let mockVersion = 0;
    globalThis.mock = (resolved, replacementProperties) => {
      let exports = Object.keys(replacementProperties);
      let shadow = Object.create(null);
      let namespace = Object.create(null);
      for (const name of exports) {
        Object.defineProperty(namespace, name, {
          get() {
            return shadow[name];
          },
          set(v) {
            shadow[name] = v;
          }
        });
      }
      mockedModules.set(resolved, replacementProperties);
      mockVersion++;
      port.postMessage({mockVersion, resolved, exports });
      return namespace;
    }
    setImportMetaCallback((meta, context, parent) => {
      if (context.url.startsWith('mock:')) {
        let [proto, version, encodedTargetURL] = context.url.split(':');
        let decodedTargetURL = decodeURIComponent(encodedTargetURL);
        if (mockedModules.has(decodedTargetURL)) {
          meta.mock = mockedModules.get(decodedTargetURL);
          return;
        }
      }
      parent(meta, context);
    });
    globalThis.mock.map = mockedModules;
  }})()`;
}


// rewrites node: loading to node-custom: so that it can be intercepted
export function resolve(specifier, context, defaultResolve) {
  doDrainPort();
  const def = defaultResolve(specifier, context);
  if (context.parentURL?.startsWith('mock:')) {
    // do nothing, let it get the "real" module
  } else if (mockedModuleExports.has(def.url)) {
    return {
      url: `mock:${currentMockVersion}:${encodeURIComponent(def.url)}`
    };
  };
  return {
    url: `${def.url}`
  };
}

export function getSource(url, context, defaultGetSource) {
  doDrainPort();
  if (url.startsWith('mock:')) {
    let [proto, version, encodedTargetURL] = url.split(':');
    let ret = generateModule(mockedModuleExports.get(
      decodeURIComponent(encodedTargetURL)
    ));
    return {source: ret};
  }
  return defaultGetSource(url, context);
}

export function getFormat(url, context, defaultGetFormat) {
  if (url.startsWith('mock:')) {
    return { format: 'module' };
  }
  return defaultGetFormat(url, context, defaultGetFormat);
}

function generateModule(exports) {
  let body = 'export {};'
  for (const [i, name] of Object.entries(exports)) {
    let key = JSON.stringify(name);
    body += `var _${i} = import.meta.mock[${key}];`
    body += `export {_${i} as ${name}};`;
  }
  return body;
}
