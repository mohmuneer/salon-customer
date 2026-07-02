const CACHE        = 'glamour-v3'
const OFFLINE_URL  = '/offline'
const PRECACHE     = ['/', '/offline', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

/* ── Install: precache core pages ── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // don't block install on cache failure
  )
})

/* ── Activate: clean old caches ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

/* ── Helper: always return a usable offline Response ── */
function offlinePage() {
  return caches.match(OFFLINE_URL).then(
    (r) => r || new Response('<h1>أنت غير متصل بالإنترنت</h1>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  )
}

function offlineJson() {
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

/* ── Fetch handler ── */
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Only handle http(s)
  if (!url.protocol.startsWith('http')) return

  // Skip the offline page itself to avoid loops
  if (url.pathname === OFFLINE_URL) return

  /* 1. Navigation (page loads) — network first, fallback to offline page */
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => offlinePage())
    )
    return
  }

  /* 2. API calls */
  if (url.pathname.startsWith('/api/')) {
    // Non-GET: pass through, return offline JSON on failure
    if (request.method !== 'GET') {
      e.respondWith(fetch(request).catch(() => offlineJson()))
      return
    }
    // GET: network first, cache on HTTPS, fallback to cache then offline JSON
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !isDev) {
            try {
              const cacheClone = res.clone()
              caches.open(CACHE).then((c) => c.put(request, cacheClone))
            } catch (_) { /* clone may fail for streaming responses — skip cache */ }
          }
          return res
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || offlineJson())
        )
    )
    return
  }

  /* 3. Other non-GET requests: pass through */
  if (request.method !== 'GET') {
    e.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })))
    return
  }

  /* 4. Static assets
     - localhost/dev: network only (skip cache to avoid stale assets during dev)
     - production (HTTPS): cache first, then network → cache, fallback offline */
  if (isDev) {
    e.respondWith(fetch(request).catch(() => offlinePage()))
    return
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((res) => {
          if (res.ok) {
            try {
              const cacheClone = res.clone()
              caches.open(CACHE).then((c) => c.put(request, cacheClone))
            } catch (_) { /* clone may fail for streaming responses — skip cache */ }
          }
          return res
        })
        .catch(() => offlinePage())
    })
  )
})
