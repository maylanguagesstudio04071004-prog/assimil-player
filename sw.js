const CACHE = 'assimil-player-v5';
const ASSETS = ['./', './index.html', './manifest.json', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const accept = req.headers.get('accept') || '';
  // HTML/画面: ネットワーク優先(最新を取得) → オフライン時のみキャッシュ
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  // その他(icon/manifest等): キャッシュ優先
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
