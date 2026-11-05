/* Service worker: guarda os arquivos do app para uso offline no campo. Não armazena dados de ocorrências. */
const CACHE = 'deleagro-campo-v4';
const ARQUIVOS = ['./', './index.html', './app.js', './data.js', './anexos.js', './lib/hashwasm-sha256.js', './manifest.json', './lib/jspdf.umd.min.js', './lib/exifr.lite.js', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './logo-deleagro.png', './logo-pcms.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ARQUIVOS.map(a => c.add(a)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
