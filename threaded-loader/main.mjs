// test with:
// ./node --experimental-worker --experimental-modules ./threaded-loader/main.mjs

import worker_threads from 'worker_threads';
import {createRPC} from './helper.mjs';
const { Worker, MessageChannel } = worker_threads;

class LoaderChain {
  constructor([...urls], top) {
    const init = async () => {
      const {
        port1: topSource,
        port2: topSink,
      } = new MessageChannel();
      createRPC(topSource, top);
      let parentSink = topSink;
      for (const url of urls) {
        const bootstrapURL = new URL('./bootstrap.mjs', import.meta.url);
        const worker = new Worker(bootstrapURL.pathname, {
          workerData: {
            url
          },
        });
        worker.unref();
        // bootstrap should immediately spew out a sink that you can talk to it over
        const workerSink = await new Promise((f,r) => {
          worker.postMessage(parentSink, [parentSink]);
          function cleanup() {
            worker.removeListener('message', getPort);
            worker.removeListener('error', bail);
            worker.removeListener('exit', bail);
          }
          function getPort(port) {
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
        parentSink = workerSink;
      }
      this.post = createRPC(parentSink, ()=>{
        throw Error('LOADERS CANNOT REQUEST DATA FROM MAIN');
      });
      return this;
    };
    return init();
  }
  resolve({
    specifier,
    referrer,
    data
  }) {
    return this.post({
      method: 'onresolve',
      params: {
        specifier: `${specifier}`,
        referrer: `${referrer}`,
        data,
      }
    });
  }
}
;(async function () {
  const chain = await new LoaderChain([
    new URL('./loaders/log.mjs', import.meta.url).href,
    new URL('./loaders/blacklist.mjs?fs', import.meta.url).href
  ], (o) => {
    return {key: o.params.specifier};
  });
  const final = await chain.resolve({
    specifier: 'fs',
    referrer: import.meta.url,
  });
  console.log('final', final);
})().catch(console.dir);
