/* eslint-disable node-core/required-modules */
import url from 'url';

export default ({
  resolve: parentResolve
}) => ({
  async resolve(specifier, parentModuleURL) {
    const parentResolved = await parentResolve(specifier, parentModuleURL);
    const request = new url.URL(parentResolved.url);
    request.search = '';
    request.hash = '';
    return {
      url: request.href,
      format: parentResolved.format
    };
  }
});
