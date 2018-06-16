self.onresolve = async (event) => {
  event.respondWith(((async () => {
    //
    const resolved = await parent.resolve(event.request);
    // this could be used to dump a cache to disk
    // the cache would likely only be useful if resolve takes significant time
    // or the cache could be loaded extremely quickly
    console.log('RESOLVE: %o became %o', event.request, resolved);
    return resolved;
  })()))
};
