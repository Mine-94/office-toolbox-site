// 최소 서비스 워커 — "홈 화면에 추가"(PWA 설치)를 위한 최소 요건만 충족한다.
// 파일 업로드·변환 등 실시간 처리 특성상 별도 캐싱은 하지 않고 항상 네트워크로 통과시킨다.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
