// test with:
// ./node --experimental-worker --experimental-modules ./threaded-loader/main.mjs

import worker_threads from 'worker_threads';
import {createRPC, bootstrappedWorker} from './helper.mjs';
const { MessageChannel } = worker_threads;

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
        parentSink = await bootstrappedWorker(url, parentSink);
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
  const babelLoaderURL = new URL('./loaders/babel-loader.mjs', import.meta.url);
  const scaledBabelLoaderURL = new URL('./loaders/scaled-loader.mjs', import.meta.url);
  scaledBabelLoaderURL.searchParams.set('loader', babelLoaderURL);
  const chain = await new LoaderChain([
    scaledBabelLoaderURL.href,
  ], async (out) => {
    const body = new Blob('<x></x>', {type: 'text/javascript'});
    return {
      key: '/test-babel.mjs',
      buffer: await (new Response(body).arrayBuffer()),
      type: 'text/javascript',
    };
  });
  const final = await chain.resolve({
    specifier: 'fs',
    referrer: import.meta.url,
  });
  if (final.buffer) {
    final.buffer = await new Response(new Blob([final.buffer])).text();
  }
  console.log('final', final);
})().catch(console.dir);
