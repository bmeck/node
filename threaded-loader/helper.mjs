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
