import dep from './loader-dep.js';
import assert from 'assert';

export default ({ resolve: parentResolve }) => {
  return {
    resolve(specifier, base, defaultResolve) {
      assert.strictEqual(dep.format, 'esm');
      return parentResolve(specifier, base);
    }
  };
}
