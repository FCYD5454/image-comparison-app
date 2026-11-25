const CACHE_NAME = 'image-comparison-v1';
const URLS_TO_CACHE = [
  './',
  './index.html'
];

// 安裝階段 - 快取資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch((error) => {
        console.error('Failed to cache during install:', error);
      })
  );
  self.skipWaiting();
});

// 啟動階段 - 清理舊快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch 階段 - 優先使用快取
self.addEventListener('fetch', (event) => {
  // 只處理同源請求
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // 不快取 blob: 和 data: URLs
  if (event.request.url.startsWith('blob:') || event.request.url.startsWith('data:')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果在快取中找到，直接返回
        if (response) {
          return response;
        }
        
        // 否則發起網路請求
        return fetch(event.request)
          .then((response) => {
            // 檢查是否為有效回應
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 複製回應並存入快取
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // 網路請求失敗，返回離線頁面或預設內容
            console.log('Fetch failed; returning offline page instead.');
          });
      })
  );
});
