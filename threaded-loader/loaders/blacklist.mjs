const params = new URL(import.meta.url).searchParams;
self.onresolve = (event) => {
  event.respondWith((async () => {
    const resolved = await parent.resolve(event.request);
    if (params.has(resolved.key)) {
      throw new Error(`not allowed to load ${resolved.key}`);
    }
    return resolved;
  })());
};
