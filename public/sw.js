// SoNovel Service Worker — cache-first for static, network-first for API
const CACHE_VERSION = 'sonovel-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`
const IMAGE_CACHE = `${CACHE_VERSION}-images`
const IMAGE_CACHE_MAX = 100

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET
  if (request.method !== 'GET') return

  // Skip chrome-extension, blob, data
  if (!url.protocol.startsWith('http')) return

  // Ảnh minh họa/bìa (imgBB + covers + R2): cache-first, cap số file để không phình.
  // Ảnh đã tải thì mở lại hiện ngay kể cả mạng yếu/mất mạng.
  const isImageHost = url.hostname === 'i.ibb.co'
    || url.pathname.startsWith('/covers/')
    || /\.(png|jpe?g|gif|webp|bmp|avif)(\?|$)/i.test(url.pathname)
  if (isImageHost) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(IMAGE_CACHE).then(async (cache) => {
              try {
                const keys = await cache.keys()
                if (keys.length >= IMAGE_CACHE_MAX) await cache.delete(keys[0])
                await cache.put(request, clone)
              } catch {}
            }).catch(() => {})
          }
          return response
        }).catch(() => caches.match(request).then((r) => r || new Response('Offline', { status: 503 })))
      })
    )
    return
  }

  // API requests — network-first, fallback cache (stale-while-revalidate)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // cache successful GET API responses
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then((cache) => cache.put(request, clone)).catch(() => {})
          }
          return response
        })
        .catch(() => caches.match(request).then((r) => r || new Response('Offline', { status: 503 })))
    )
    return
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone)).catch(() => {})
        }
        return response
      })
    })
  )
})
