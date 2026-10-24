const CACHE = 'scripture-v3'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(Promise.resolve())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  )
})

function shellRequest(request, url) {
  return request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/sw.js' || url.pathname === '/boot.js'
}

async function fromNetwork(cache, request) {
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/esv-api') || url.pathname.startsWith('/api')) return
  if (shellRequest(request, url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          return await fromNetwork(cache, request)
        } catch {
          const hit = await cache.match(request)
          if (hit) return hit
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        }
      }),
    )
    return
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request)
      const network = fromNetwork(cache, request).catch(() => hit)
      if (hit) {
        event.waitUntil(network.then(() => undefined, () => undefined))
        return hit
      }
      const response = await network
      if (response) return response
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    }),
  )
})
