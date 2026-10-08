// Offline support: keeps the built app in a cache so it runs in school without WLAN.
// Hand-written instead of vite-plugin-pwa: the build is just index.html, one JS and one CSS file.
const CACHE = "fahrrad";
const SHELL = new URL("./", self.registration.scope).href;

/** Like cache.add, but SPA hosts (vite preview, Cloudflare Pages) answer a missing file with index.html and 200. */
async function fetchAsset(u) {
  const res = await fetch(u, { cache: "no-cache" });
  if (!res.ok || res.headers.get("content-type")?.includes("text/html")) throw new Error(`not cacheable: ${u}`);
  return res;
}

/** Cache a fresh index.html plus everything it links to, and drop assets of older builds. */
async function store(res) {
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  const keep = new Set(
    [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => new URL(m[1], SHELL).href)
      .filter((u) => u.startsWith(self.location.origin)),
  );
  // Assets before the shell: if a download fails halfway (flaky WLAN, tab closed), the old shell
  // and its assets stay intact instead of a new shell pointing at a missing script.
  // Hashed files (/assets/) never change content, so only fetch those if missing; icons and manifest always.
  for (const u of keep)
    if (!u.includes("/assets/") || !(await cache.match(u, { ignoreVary: true }))) await cache.put(u, await fetchAsset(u));
  await cache.put(SHELL, res);
  for (const req of await cache.keys()) if (req.url !== SHELL && !keep.has(req.url)) await cache.delete(req);
}

// Precache on install: on the first visit the page loads before this worker controls it,
// so caching only what passes through fetch would leave the first offline start empty.
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(fetch(SHELL, { cache: "reload" }).then(store));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return; // StVO links stay online-only
  if (req.mode === "navigate") {
    // Network first, so a new build shows up on the next reload. Every ?s=… task is the same page.
    // ponytail: no timeout, flaky WLAN waits for the browser to give up; add one if that bites.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) e.waitUntil(store(res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(SHELL)) ?? Response.error()),
    );
    return;
  }
  // ignoreVary: servers send "Vary: Origin", and the crossorigin script tags send an Origin header
  // that the precache requests lacked, so without it nothing would match.
  e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit ?? fetch(req)));
});
