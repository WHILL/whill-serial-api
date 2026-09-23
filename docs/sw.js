/*
 * Service worker for the MRP Serial Tester (see mrp-tester/index.html).
 *
 * It lives at the site root only because it has to. A service worker cannot
 * control pages above its own path, GitHub Pages cannot send the
 * `Service-Worker-Allowed` header that would lift that restriction, and the
 * app has to keep `cr2/tester/` and `omni/tester/` working offline without
 * holding a second copy of them. So the script sits here and the app, one
 * directory down, registers it.
 *
 * It is registered from mrp-tester/index.html and from nowhere else, so a
 * visitor who never opens the app never installs it. For someone who has,
 * MANAGED keeps the blast radius to the files the app actually needs:
 * every other request returns without `respondWith`, which leaves the browser
 * to handle it exactly as it would with no service worker at all - the
 * specifications and the emulator are never intercepted, never cached and
 * never served stale.
 *
 * Strategy: network first, cache as fallback. Cache first would be faster, but
 * it pins the tools to whatever version was installed, and a stale test tool is
 * worse than a slow one. Network first means an online user always gets the
 * version currently published, and the cache only steps in when the network
 * does not answer - which is exactly the isolated-network case these tools are
 * built for.
 *
 * Bump CACHE whenever a tool is released, so the previous payload is dropped in
 * `activate` instead of lingering.
 */
const CACHE = 'whill-mrp-tester-v1.00';

/*
 * Precached on install. The testers are listed as directory URLs, not as
 * `index.html`, because that is the form the app links to and the form a
 * navigation request arrives as.
 */
const SHELL = [
  './mrp-tester/',
  './mrp-tester/manifest.webmanifest',
  './mrp-tester/icon.svg',
  './mrp-tester/icon-maskable.svg',
  './mrp-tester/icon-192.png',
  './mrp-tester/icon-512.png',
  './mrp-tester/icon-maskable-512.png',
  './images/whill_logo.svg',
  './cr2/tester/',
  './cr2/tester/inspection.js',
  './omni/tester/'
];

const MANAGED = new Set(SHELL.map((path) => new URL(path, self.location).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Anything outside the app falls through to the browser untouched.
  if (!MANAGED.has(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          // `?addon=inspection` must not create a second entry for the tester.
          caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
        }
        return response;
      })
      .catch(() => caches.match(url.pathname))
  );
});
