import worker from 'worker_threads';
const {Worker} = worker;
export const bootstrappedWorker = async (url, parentSink) => {
  const bootstrapURL = new URL('./bootstrap.mjs', import.meta.url);
  const worker = new Worker(bootstrapURL.pathname, {
    workerData: {
      url
    },
  });
  worker.unref();
  // bootstrap should immediately spew out a sink that you can talk to it over
  const workerSink = await new Promise((f,r) => {
    function cleanup() {
      worker.removeListener('message', getPort);
      worker.removeListener('error', bail);
      worker.removeListener('exit', bail);
    }
    let port;
    async function getPort(gotPort) {
      if (!port) {
        port = gotPort;
        worker.postMessage(parentSink, [parentSink]);
        return;
      }
      cleanup();
      f(port);
    }
    function bail(e) {
      cleanup();
      r(new Error(`Failed to initialize Loader ${url} : ${e}`));
    }
    worker.on('message', getPort);
    worker.on('error', bail);
    worker.on('exit', bail);
  });
  return workerSink;
}
export const setupWorkerGlobals = (global, workerModule) => {
  const {process} = global;
  const {
    parentPort,
    workerData: {url}
  } = workerModule;
  workerModule.parentPort = null;
  workerModule.workerData = null;
  const {
    port1: selfSource,
    port2: selfSink,
  } = new workerModule.MessageChannel();
  const HANDLERS = {
    __proto__: null,
    async onresolve(request) {
      let ret = await new Promise(async (respondWith, r) => {
        try {
          self.onresolve({
            request,
            respondWith
          });
          r(new Error('not declared handled synchronously'));
        } catch (e) {
          r(e);
        }
      });
      if (!ret.body) {
        return {key: ret.key};
      }
      if (ret.body instanceof Blob) {
        return {
          key: ret.key,
          buffer: await (new Response(ret.body).arrayBuffer()),
          type: ret.body.type,
        };
      }
      throw new Error('invalid result');
    }
  };
  createRPC(selfSource, ({
    method,
    params
  }) => {
    return HANDLERS[method](params);
  });
  let postToParent;
  const gotParentPort = new Promise(f => {
    parentPort.on('message', async function init(parentSink) {
      parentPort.removeListener('message', init);
      postToParent = createRPC(parentSink, () => {
        throw Error('PARENT SHOULD NEVER DIRECTLY TALK TO CHILD');
      });
      f();
    });
  });
  (async () => {
    parentPort.postMessage(selfSink, [selfSink]);
    // this must occur before initializing the loader
    await gotParentPort;
    await import(url);
    parentPort.postMessage(null);
    parentPort.close();
  })().catch(e => {
    console.error(e)
    process.exit();
  });
  
  delete global.process;
  delete global.Buffer;
  delete global.DTRACE_NET_SERVER_CONNECTION;
  delete global.DTRACE_NET_STREAM_END;
  delete global.DTRACE_HTTP_SERVER_REQUEST;
  delete global.DTRACE_HTTP_SERVER_RESPONSE;
  delete global.DTRACE_HTTP_CLIENT_REQUEST;
  delete global.DTRACE_HTTP_CLIENT_RESPONSE;
  const self = global.self = global;
  delete self.global;
  self.Worker = workerModule.Worker;
  self.parent = {
    async resolve(request) {
      const {key, buffer, type} = await postToParent({
        method: 'onresolve',
        params: request
      });
      if (!buffer) {
        return {key};
      } else {
        return {
          key,
          // TODO: not reconstruct this / let blobs be sent across threads
          // not the most costly operation, but... unnecessary
          body: new Blob([buffer], {type})
        }
      }
    }
  };
}
export const createRPC = (messenger, handle) => {
  let unique = 1;
  const pending = new Map();
  const post = ({method, params}) => {
    return new Promise((f, r) => {
      const id = unique++;
      messenger.postMessage({
        id,
        method,
        params,
      });
      pending.set(id, {f,r});
    });
  };
  messenger.on('message', async (inc) => {
    const {id} = inc;
    if ('method' in inc) {
      let ret;
      try {
        ret = {
          id,
          result: await handle(inc)
        };
      } catch (e) {
        console.error(e)
        ret = {
          id,
          error: {
            code: -32000,
            message: `${e}`,
            data: null
          }
        };
      }
      messenger.postMessage(ret);
    } else if (pending.has(id)) {
      if ('result' in inc) {
        pending.get(id).f(inc.result);
      } else if ('error' in inc) {
        pending.get(id).r(inc.error);
      }
      pending.delete(id);
    }
  });
  return post;
};
