// Push notification permission + subscription management.
// Background push requires a VAPID public key configured in the server.
// Set VITE_VAPID_PUBLIC_KEY in .env.local once you generate VAPID keys.
// To generate: `npx web-push generate-vapid-keys`

import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// Convert VAPID base64 key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// Request permission and subscribe to push — call after user logs in.
export async function requestPushPermission(authUserId: string, schoolId: string): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  if (Notification.permission === 'denied') return false

  let permission: string = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return false

  // Try to set up push subscription if VAPID key is configured
  if (!VAPID_PUBLIC_KEY) {
    // No VAPID key yet — in-app notifications still work (foreground only)
    return true
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      // Already subscribed — upsert to DB in case user logged in on new device
      await storePushSubscription(authUserId, schoolId, existing)
      return true
    }

    const vapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey.buffer as ArrayBuffer,
    })

    await storePushSubscription(authUserId, schoolId, subscription)
    return true
  } catch (err) {
    console.warn('[Push] Subscription failed:', err)
    return false
  }
}

async function storePushSubscription(authUserId: string, schoolId: string, sub: PushSubscription) {
  const json = sub.toJSON()
  await supabase.from('push_subscriptions').upsert({
    auth_user_id: authUserId,
    school_id:    schoolId,
    endpoint:     json.endpoint,
    p256dh:       json.keys?.p256dh,
    auth:         json.keys?.auth,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'auth_user_id,endpoint' })
}

// Unsubscribe when user logs out
export async function unsubscribeFromPush(authUserId: string) {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('auth_user_id', authUserId).eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    // Non-critical
  }
}

// Show a local notification (works even without push subscription, foreground only)
export function showLocalNotification(title: string, body: string, url?: string) {
  if (Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `shule-${Date.now()}`,
  })
  if (url) n.onclick = () => { window.focus(); window.location.href = url }
}
