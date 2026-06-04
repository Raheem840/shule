/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Skip waiting so new SW activates immediately
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

// Navigation fallback → index.html
registerRoute(
  new NavigationRoute(
    new NetworkFirst({ networkTimeoutSeconds: 3, cacheName: 'navigation' }),
    { denylist: [/^\/api/] }
  )
)

// Supabase REST: NetworkFirst
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.startsWith('/rest'),
  new NetworkFirst({
    networkTimeoutSeconds: 5,
    cacheName: 'supabase-rest',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 })],
  })
)

// Supabase auth: NetworkFirst (no cache for auth)
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.startsWith('/auth'),
  new NetworkFirst({ networkTimeoutSeconds: 3, cacheName: 'supabase-auth' })
)

// Supabase storage: CacheFirst
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.startsWith('/storage'),
  new CacheFirst({
    cacheName: 'supabase-storage',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 })],
  })
)

// ── Background Push Notification Handler ──────────────────────────────────
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; tag?: string; url?: string } = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data?.text() ?? 'New notification from Shule' }
  }

  const title   = data.title ?? 'Shule'
  const options: NotificationOptions = {
    body:    data.body ?? 'You have a new notification',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag ?? 'shule-notification',
    vibrate: [200, 100, 200],
    data:    { url: data.url ?? '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// When user clicks the notification, open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})

// ── Push subscription management ─────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
