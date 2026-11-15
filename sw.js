/**
 * sw.js — خادم الإلغاء الفوري والتطهير الشامل (Global PWA Kill-Switch)
 * منصة مكّن (mken.live)
 *
 * يقوم بمسح وحذف كافة قواعد التخزين المؤقت (CacheStorage) محلياً من جميع أجهزة
 * الهواتف، ويلغي تسجيل عامل الخدمة القديم نهائياً، ويعيد تحميل الصفحة فوراً
 * لضمان تحميل واجهات Next.js الحديثة من الشبكة بدون أي واجهات ميتة.
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
        return Promise.all(
          keys.map(function (key) {
            console.log('[SW-KillSwitch] Deleting cache:', key);
            return caches.delete(key);
          })
        );
      })
      .then(function () {
        console.log('[SW-KillSwitch] Unregistering service worker...');
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

// اعتراض أي طلب معلق وتمريره مباشرة للشبكة بدون أي كاش نهائياً
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
