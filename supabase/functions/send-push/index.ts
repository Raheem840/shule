import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webPush from 'npm:web-push@3.6.7'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { userId, schoolId, title, body, url } = await req.json() as {
      userId:   string
      schoolId: string
      title:    string
      body:     string
      url?:     string
    }

    if (!userId || !schoolId || !title || !body) {
      return new Response(JSON.stringify({ error: 'userId, schoolId, title, body required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidContact = Deno.env.get('VAPID_CONTACT_EMAIL') ?? 'mailto:admin@shule.app'

    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    webPush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate)

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: subs } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('auth_user_id', userId)
      .eq('school_id',    schoolId)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({ title, body, url: url ?? '/', tag: `shule-${Date.now()}` })
    let sent = 0
    const expired: string[] = []

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          sent++
        } catch (err: unknown) {
          // 410 Gone = subscription expired — clean it up
          if ((err as { statusCode?: number }).statusCode === 410) {
            expired.push(sub.endpoint)
          }
        }
      })
    )

    // Remove expired subscriptions
    if (expired.length > 0) {
      await adminClient
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired)
        .eq('auth_user_id', userId)
    }

    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
