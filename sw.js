const CACHE_NAME = 'tactical-fdc-v2'; // バージョン名。大きく構成を変えた時はv3, v4と変えます
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// インストール処理：初回起動時に必要なファイルをすべてキャッシュに入れる
self.addEventListener('install', event => {
  self.skipWaiting(); // 新しいバージョンがあれば、待機せずにすぐインストールを強制する
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// アクティベート処理：古いキャッシュ（v1など）が残っていれば削除して容量を空ける
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // すぐにこのService Workerにページの制御を任せる
});

// 通信の割り込み処理（ここが「爆速起動＆裏でアップデート」の心臓部）
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      
      // 1. 裏でネットワークへ最新版を取りに行く（非同期通信）
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // 通信が成功し、正しいデータが取れた場合のみキャッシュを最新版に書き換える
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // オフライン時（圏外）はエラーを出さずに無視する
        console.log('[Service Worker] オフラインのためキャッシュのみを使用');
      });

      // 2. キャッシュがあれば「とりあえずそれを一瞬で返す（爆速起動）」。無ければネットワークの返事を待つ。
      return cachedResponse || fetchPromise;
    })
  );
});
