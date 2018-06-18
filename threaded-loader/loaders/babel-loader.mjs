import babel from '@babel/standalone';
import {MIME} from 'mime';
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
        const sourceText = await (new Response(resolved.body).text());
        return {
          key: resolved.key,
          body: new Blob([babel.transform(sourceText, options).code], {
            type: resolved.body.type
          })
        };
      }
    }
    return resolved;
  })()))
};
