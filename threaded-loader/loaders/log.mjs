self.onresolve = async (event) => {
  event.respondWith(((async () => {
    const resolved = await parent.resolve(event.request);
    console.log('RESOLVE: %o became %o', event.request, resolved);
    return resolved;
  })()))
};
