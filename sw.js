/**
 * Kill-switch: the previous worker cached "./" + index.html with
 * cache-first, so tenant origins kept serving the old terracotta shell
 * until Ctrl+Shift+R. Delete every cache, unregister, reload.
 *
 * Do not add a fetch handler. Do not cache HTML or "/".
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
