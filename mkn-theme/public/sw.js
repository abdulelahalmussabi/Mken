/**
 * Kill-switch: the legacy static site cached "./" and index.html
 * (cache-first), so demo.mken.live kept showing "اسم منشأتك" until
 * a hard refresh. This worker deletes every cache, unregisters, and
 * reloads clients so the Next.js tenant UI loads from the network.
 *
 * Do not add a fetch handler. Do not reintroduce cache-first for HTML.
 */
'use strict';

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(function (clients) {
        return Promise.all(
          clients.map(function (client) {
            if (client && typeof client.navigate === 'function') {
              return client.navigate(client.url);
            }
            return null;
          })
        );
      })
  );
});
