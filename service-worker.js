const CACHE_NAME = "taskring-shell-20260908-6";
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
  "./assets/css/ux-efficiency.css",
  "./assets/css/visual-polish.css",
  "./assets/css/weekly-polish.css",
  "./assets/css/mobile-weekly-polish.css",
  "./assets/css/game-mode-contrast.css",
  "./assets/css/zone-card-art.css",
  "./assets/css/zone-identity-v2.css",
  "./assets/css/userfriend-polish.css",
  "./assets/css/library-density-polish.css",
  "./assets/css/game-note-density.css",
  "./assets/css/daily-density.css",
  "./assets/css/lane-density.css",
  "./assets/js/data/default-data.js",
  "./assets/js/app.js",
  "./assets/js/data/integrity-core.js",
  "./assets/js/data-integrity.js",
  "./assets/js/views/completion-effects.js",
  "./assets/js/views/time-ledger-view.js",
  "./assets/js/views/editor-ux.js",
  "./assets/js/views/fitness-view.js",
  "./assets/js/views/product-ui.js",
  "./assets/js/game-disclosure.js",
  "./assets/js/ux-efficiency.js",
  "./assets/js/private-restructure.js",
  "./assets/js/pwa.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key=>cache=>(cache, null))))
  );
});
