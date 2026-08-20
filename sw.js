/* Service worker: rende l'app apribile senza rete.
   Tutti i dati stanno in localStorage, quindi qui basta conservare i file. */

/* Alzare questo numero a ogni pubblicazione: le cache vecchie vengono buttate. */
const VER = 'forma-2026.08.20.8';
const SHELL = VER + '-shell';

const FILES = [
  './',
  './index.html',
  './app.css',
  './data.js',
  './importa.js',
  './app.js',
  './sync.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/logo-lockup.png',
  './icons/logo-full.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => !k.startsWith(VER)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Le chiamate a Supabase non si mettono mai in cache: una risposta vecchia
  // farebbe credere all'app di essere allineata quando non lo è.
  if (/supabase\.(co|in)$/.test(url.hostname)) return;

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(SHELL).then(async cache => {
        const dallaCache = async () =>
          (await cache.match(req, { ignoreSearch: true })) ||
          (await cache.match('./index.html'));

        try {
          const res = await fetch(req);
          if (res.ok) {
            cache.put(req, res.clone());
            return res;
          }
          // Una risposta 404 o 500 non è un errore di rete: senza questo
          // controllo l'app mostrerebbe la pagina d'errore del server al posto
          // della copia funzionante che ha già in cache.
          return (await dallaCache()) || res;
        } catch (err) {
          return (await dallaCache()) ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })
    );
  }
});
