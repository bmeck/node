import dep from './loader-dep.js';
export default ({ resolve: parentResolve }) => {
  return {
    async resolve(specifier, base, defaultResolve) {
      return {
        url: (await parentResolve(specifier, base)).url,
        format: dep.format
      };
    }
  };
}
