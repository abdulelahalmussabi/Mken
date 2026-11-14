/**
 * sw.js — خادم الخدمة المقاوم لانقطاع الشبكة (Offline PWA Service Worker)
 * منصة مكّن (mken.live) — الإصدار الإنتاجي v3.2.0
 * متوافق مع: Safari iOS، Chrome Android، وضوابط تجربة المستخدم دون اتصال
 */
'use strict';

var CACHE_VERSION = 'mken-pwa-v3.2.0';
var STATIC_CACHE = 'static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'dynamic-' + CACHE_VERSION;

// قائمة الأصول الأساسية لهيكل التطبيق (App Shell)
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/order.html',
  '/book.html',
  '/order-status.html',
  '/css/style.css',
  '/css/platform.css',
  '/css/booking.css',
  '/css/order.css',
  '/css/themes.css',
  '/js/main.js',
  '/js/site.js',
  '/js/theme-early.js',
  '/js/brand-logo.js',
  '/js/services-store.js',
  '/js/order-store.js',
  '/js/offline-store.js',
  '/js/pwa.js',
  '/assets/logo.svg',
  '/manifest.webmanifest'
];

// 1. مرحلة التثبيت: حفظ الأصول الأساسية في الكاش
self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).catch(function (err) {
      console.warn('[SW] Cache addAll warning (will continue):', err);
    })
  );
});

// 2. مرحلة التفعيل: مسح الكاش القديم فورياً والتحكم في العملاء
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 3. معالجة طلبات الجلب (Fetch Event Handling)
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // استبعاد نقاط النهاية الحساسة للدفع والمصادقة والويب هوك من الكاش نهائياً
  if (
    url.pathname.indexOf('/api/moyasar') !== -1 ||
    url.pathname.indexOf('/api/v1/auth') !== -1 ||
    url.pathname.indexOf('/api/v1/checkout') !== -1 ||
    url.pathname.indexOf('/api/webhook') !== -1
  ) {
    return;
  }

  // أ) الأصول الثابتة (CSS, JS, Fonts, Images) -> Cache-First
  var dest = request.destination;
  if (dest === 'style' || dest === 'script' || dest === 'image' || dest === 'font') {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then(function (networkResponse) {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;
          var clone = networkResponse.clone();
          caches.open(STATIC_CACHE).then(function (cache) {
            cache.put(request, clone);
          });
          return networkResponse;
        }).catch(function () {
          return caches.match('/assets/logo.svg');
        });
      })
    );
    return;
  }

  // ب) صفحات التصفح (HTML Navigation) -> Network-First مع مهلة سقوط 2.0 ثانية
  var acceptHeader = request.headers.get('accept') || '';
  if (request.mode === 'navigate' || acceptHeader.indexOf('text/html') !== -1) {
    event.respondWith(
      networkFirstWithTimeout(request, 2000)
    );
    return;
  }

  // ج) الاستعلامات العامة (General API or JSON Content)
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (networkRes) {
        if (networkRes && networkRes.status === 200) {
          var clone = networkRes.clone();
          caches.open(DYNAMIC_CACHE).then(function (cache) {
            cache.put(request, clone);
          });
        }
        return networkRes;
      });
    }).catch(function () {
      return caches.match('/index.html');
    })
  );
});

/**
 * استراتيجية Network-First مع مهلة زمنية ذكية لمنع تعليق الصفحة
 */
function networkFirstWithTimeout(request, timeoutMs) {
  return new Promise(function (resolve) {
    var hasResolved = false;

    var timer = setTimeout(function () {
      if (!hasResolved) {
        hasResolved = true;
        caches.match(request).then(function (cached) {
          if (cached) {
            resolve(cached);
          } else {
            caches.match('/index.html').then(function (fallback) {
              resolve(fallback);
            });
          }
        });
      }
    }, timeoutMs);

    fetch(request)
      .then(function (networkResponse) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timer);
          if (networkResponse && networkResponse.status === 200) {
            var clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then(function (cache) {
              cache.put(request, clone);
            });
          }
          resolve(networkResponse);
        }
      })
      .catch(function () {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timer);
          caches.match(request).then(function (cached) {
            if (cached) resolve(cached);
            else caches.match('/index.html').then(function (fallback) { resolve(fallback); });
          });
        }
      });
  });
}
