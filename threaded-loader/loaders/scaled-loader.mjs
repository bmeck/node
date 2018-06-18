import { createRPC, bootstrappedWorker } from '../helper.mjs';
import { MessageChannel } from 'worker_threads';
const pool = Promise.all(Array.from({
  length: 1
}, async () => {
  const {
    port1: parentSource,
    port2: parentSink,
  } = new MessageChannel();
  const workerSink = await bootstrappedWorker(
    new URL(import.meta.url).searchParams.get('loader'),
    parentSink,
  );
  createRPC(parentSource, async ({
    method, params
  }) => {
    if (method === 'onresolve') {
      const ret = await parent.resolve(params);
      if (!ret.body) return {key: ret.key};
      return {
        key: ret.key,
        buffer: await (new Response(ret.body).arrayBuffer()),
        type: ret.body.type,
      };
    }
    throw new Error('unknown request');
  })
  return createRPC(workerSink, (o) => {
    throw new Error('children should not directly talk to parent');
  });
}));
const queue = [];
async function flush() {
  if (queue.length === 0) return;
  const workers = await pool;
  if (workers.length === 0) return;
  const {data, fulfill, reject} = queue.shift();
  const post = workers.shift();
  try {
    let resolved = await post(data);
    if (resolved.buffer) {
      resolved = {
        key: resolved.key,
        body: new Blob([resolved.buffer], {
          type: resolved.type
        })
      }
    }
    fulfill(resolved);
  } catch (e) {
    reject(e);
  } finally {
    flush();
  }
}
self.onresolve = async (event) => {
  event.respondWith(new Promise(async (fulfill, reject) => {
    queue.push({
      data: {
        method: 'onresolve',
        params: event.request
      },
      fulfill,
      reject,
    });
    flush();
  }));
};
