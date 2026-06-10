/* Secretária | Service worker
   Guarda a casca do app para abrir rápido e funcionar offline.
   Chamadas ao Google (login e agenda) nunca passam pelo cache. */

var CACHE = 'secretaria-v1';
var ARQUIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './parser.js',
  './manifest.json',
  './icon-192.png',
  './logo.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (chaves) {
      return Promise.all(chaves.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Nunca interceptar Google APIs, login ou fontes externas em POST
  if (url.hostname.indexOf('googleapis.com') >= 0 ||
      url.hostname.indexOf('accounts.google.com') >= 0 ||
      e.request.method !== 'GET') {
    return;
  }

  // Casca do app: cache primeiro, rede como reserva
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(function (resp) {
        return resp || fetch(e.request).then(function (r) {
          var copia = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
          return r;
        });
      })
    );
    return;
  }

  // Fontes do Google Fonts: rede primeiro, cache como reserva
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copia = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
      return r;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
