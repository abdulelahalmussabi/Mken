/**
 * Admin Web Push only. No fetch handler and no HTML cache — the legacy
 * cache-first worker is still killed from the root layout.
 */
"use strict";

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var data = { title: "مكّن", body: "", url: "/admin" };
  try {
    if (event.data) {
      var parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        data.title = parsed.title || data.title;
        data.body = parsed.body || "";
        data.url = parsed.url || data.url;
      }
    }
  } catch (_err) {
    /* empty or non-JSON payload */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      dir: "rtl",
      lang: "ar",
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(self.clients.openWindow(target));
});
