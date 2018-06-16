import babel from '@babel/standalone';
import {parentPort} from 'worker_threads';
import {createRPC} from '../../helper.mjs';
createRPC(parentPort, async ({params}) => {
  const result = babel.transform(params.sourceText, params.options);
  return result.code;
});
