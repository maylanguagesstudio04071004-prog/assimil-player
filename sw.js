const CACHE = 'assimil-player-v8';
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
  // 別オリジンへの要求(翻訳API など)には一切さわらない(2026-08-23)。
  // ここで respondWith すると、SW内の fetch が失敗したときに
  // "FetchEvent.respondWith received an error: TypeError: Load failed" になり、
  // ページ側からは原因の分からない通信エラーとして見える。実際にAtlasの自動翻訳が
  // これで動かなくなっていた。キャッシュ用のSWが外部APIを仲介する理由はない。
  if (new URL(req.url).origin !== self.location.origin) return;
  const accept = req.headers.get('accept') || '';
  // HTML/画面: ネットワーク優先(最新を取得) → オフライン時のみキャッシュ
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    // ブラウザの控え(HTTPキャッシュ)も使わずに取りに行く(2026-09-24)。
    // GitHub Pages は max-age=600 を付けて返すので、ふつうの fetch だと最大10分は古い画面が出ていた
    // (プレーヤーの区間リピートを外したのに、Mayの端末に残って見えた)。
    // 転送(リダイレクト)がかかったときは、画面の読み込みで失敗しないよう元の要求で取り直す
    const fresh = fetch(new Request(req.url, { cache: 'no-store', credentials: 'same-origin' }))
      .then(r => r.redirected ? fetch(req) : r);
    e.respondWith(
      fresh
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
