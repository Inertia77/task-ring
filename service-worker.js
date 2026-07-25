const CACHE_NAME = "taskring-shell-20260725-1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icons/favicon.svg",
  "./assets/icons/favicon.png",
  "./assets/icons/app-icon-192.png",
  "./assets/icons/app-icon-512.png",
  "./assets/icons/app-icon-maskable-512.png",
  "./assets/css/main.css",
  "./assets/css/tokens.css",
  "./assets/css/base.css",
  "./assets/css/layout.css",
  "./assets/css/components.css",
  "./assets/css/daily.css",
  "./assets/css/weekly.css",
  "./assets/css/fitness.css",
  "./assets/css/game.css",
  "./assets/css/time.css",
  "./assets/css/library.css",
  "./assets/css/editors.css",
  "./assets/css/effects.css",
  "./assets/css/responsive.css",
  "./assets/js/data/default-data.js",
  "./assets/js/app.js",
  "./assets/js/views/completion-effects.js",
  "./assets/js/views/time-ledger-view.js",
  "./assets/js/views/editor-ux.js",
  "./assets/js/views/fitness-view.js",
  "./assets/js/views/product-ui.js",
  "./assets/js/pwa.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if(event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if(request.method !== "GET") return;

  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  if(request.mode === "navigate"){
    event.respondWith(networkFirstPage(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, request));
});

async function networkFirstPage(request){
  const cache = await caches.open(CACHE_NAME);
  try{
    const response = await fetch(request);
    if(response.ok) await cache.put("./index.html", response.clone());
    return response;
  }catch(_){
    return (await cache.match("./index.html")) || Response.error();
  }
}

async function staleWhileRevalidate(event, request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, {ignoreSearch:true});
  const cacheKey = new Request(new URL(request.url).origin + new URL(request.url).pathname);
  const network = fetch(request).then(async response => {
    if(response.ok && response.type === "basic") await cache.put(cacheKey, response.clone());
    return response;
  });

  if(cached){
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }

  try{
    return await network;
  }catch(_){
    return Response.error();
  }
}
