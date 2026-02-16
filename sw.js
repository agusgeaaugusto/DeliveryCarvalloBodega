const CACHE = 'cb-app-v1';
const ASSETS = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/config.js',
  './assets/app.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  // Solo cachear assets estáticos del propio sitio
  if(url.origin === location.origin){
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request))
    );
  }
});
