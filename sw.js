const CACHE = 'assimil-player-v6';
const ASSETS = ['./', './index.html', './assimil-phrasebook.html', './manifest.json', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  // 1ファイルでも取得に失敗すると install ごと失敗するので、個別に入れる
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    ASSETS.map(a => c.add(a).catch(() => null))
  )));
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
          // 取得したHTMLは「そのURL」のキーで保存する。
          // 以前は全てのHTMLを './index.html' に上書きしていたため、
          // Player と Atlas がオフライン時に入れ替わることがあった。
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(r => r || caches.match('./index.html'))
          .then(r => r || caches.match('./')))
    );
    return;
  }
  // その他(icon/manifest等): キャッシュ優先
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
