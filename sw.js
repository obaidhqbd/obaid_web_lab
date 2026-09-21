const CACHE = 'obaidul-mentor-lab-v7';
const SHELL = ['./','./index.html','./styles.css','./app.js','./workspace-plus.js','./site.webmanifest','./assets/favicon.svg','./assets/vendor/jszip.min.js'];

self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('obaidul-mentor-lab-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) {
    event.respondWith(fetch(req, { cache: 'no-store' }).then(res => { const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); return res; }).catch(()=>caches.match(req)));
    return;
  }
  event.respondWith(fetch(req).then(res => { const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); return res; }).catch(()=>caches.match(req)));
});
