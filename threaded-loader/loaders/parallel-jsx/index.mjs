import {createRPC} from '../../helper.mjs';
import {MIME} from 'mime';
const pool = Array.from({
  length: 3
}, () => {
  return createRPC(new Worker(new URL('./worker.mjs', import.meta.url).pathname))
});
const queue = [];
async function flush() {
  if (queue.length === 0) return;
  if (pool.length === 0) return;
  const {data, f, r} = queue.shift();
  const post = pool.shift();
  try {
    f(post(data));
  } catch (e) {
    r(e);
  } finally {
    flush();
  }
}
self.onresolve = async (event) => {
  event.respondWith(((async () => {
    const resolved = await parent.resolve(event.request);
    if (resolved.body) {
      let mime = new MIME(resolved.body.type);
      let handling = false;
      let options = {
        parserOpts: {},
        plugins: ['transform-react-jsx'],
        filename: resolved.key,
      };
      if (mime.type === 'text' && mime.subtype === 'javascript') {
        handling = true;
        if (mime.params.has('goal')) {
          options.sourceType = mime.params.get('goal').toLowerCase();
        } else {
          options.sourceType = 'module';
        }
      } else if (mime.type === 'application' && mime.subtype === 'node') {
        handling = true;
        options.sourceType = 'script';
        options.parserOpts.allowReturnOutsideFunction = true;
      }
      if (handling) {
        const params = {
          sourceText: await (new Response(resolved.body).text()),
          options,
        };
        return {
          key: resolved.key,
          body: new Blob([await new Promise(async (f, r) => {
            queue.push({
              data: {
                method: 'transform',
                params: params
              },
              f,
              r
            });
            flush();
          })], {
            type: resolved.body.type
          })
        };
      }
    }
    return resolved;
  })()))
};
