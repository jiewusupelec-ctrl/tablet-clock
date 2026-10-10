// Offline support: page is network-first, photos and fonts are cache-first.
var CACHE = "tablet-clock-v8";
// Photos change hourly; ~a day's worth lets the clock ride out a long Wi-Fi outage.
var MAX_PHOTOS = 30;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(["./"]); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function trimPhotos(cache) {
  return cache.keys().then(function (keys) {
    var photos = keys.filter(function (k) { return k.url.indexOf("images.unsplash.com") >= 0; });
    return Promise.all(photos.slice(0, Math.max(0, photos.length - MAX_PHOTOS)).map(function (k) { return cache.delete(k); }));
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = req.url;
  var isAsset = url.indexOf("images.unsplash.com") >= 0 || url.indexOf("fonts.googleapis.com") >= 0 || url.indexOf("fonts.gstatic.com") >= 0;
  if (isAsset) {
    e.respondWith(caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res.ok || res.type === "opaque") cache.put(req, res.clone()).then(function () { return trimPhotos(cache); });
          return res;
        });
      });
    }));
  } else if (req.mode === "navigate") {
    e.respondWith(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put("./", copy); });
      return res;
    }).catch(function () { return caches.match("./"); }));
  }
});
