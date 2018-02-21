import assert from 'assert';

// a loader that asserts that the defaultResolve will throw "not found"
// (skipping the top-level main of course)
let mainLoad = true;
export default ({ resolve: parentResolve }) => {
  return {
    async resolve (specifier, base) {
      if (mainLoad) {
        mainLoad = false;
        return parentResolve(specifier, base);
      }
      try {
        await parentResolve(specifier, base);
      }
      catch (e) {
        assert.strictEqual(e.code, 'MODULE_NOT_FOUND');
        return {
          format: 'builtin',
          url: 'fs'
        };
      }
      assert.fail(`Module resolution for ${specifier} should be throw MODULE_NOT_FOUND`);
    }
  };
}
