import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// Public — no session required. A staff member (whether they already have an
// account or never had one) identifies themselves with email + staff_number
// and submits the password they want. This is queued for IT admin approval
// instead of emailing an invite/reset link (blocked — no verified sending
// domain yet). IT admin sees WHO is requesting, never the password itself —
// enforced at the DB layer via a column-level REVOKE, not just by omitting it
// from any query here.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json() as { email?: string; staffNumber?: string; newPassword?: string }
    const email       = body.email?.trim().toLowerCase()
    const staffNumber = body.staffNumber?.trim()
    const newPassword = body.newPassword

    if (!email || !staffNumber || !newPassword || newPassword.length < 8) {
      return json({ error: 'Email, staff number, and a password of at least 8 characters are required' }, 400)
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Single-tenant per deployment — one school_profile row per installed school.
    const { data: school } = await serviceClient
      .from('school_profile')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (!school) {
      return json({ error: 'School not found' }, 404)
    }

    // Match on email AND staff_number together — harder to spam/guess than
    // email alone, and gives IT admin a fast identity check on the approval screen.
    const { data: staffRow } = await serviceClient
      .from('staff')
      .select('id, auth_user_id, is_active')
      .eq('school_id', school.id)
      .eq('staff_number', staffNumber)
      .ilike('email', email)
      .maybeSingle()

    // Same generic response whether or not a match was found — avoids leaking
    // which email/staff-number combinations are valid.
    const genericResponse = { success: true, message: 'If your details match a staff record, your request has been submitted for IT admin approval.' }

    if (!staffRow || !staffRow.is_active) {
      return json(genericResponse)
    }

    const kind: 'activation' | 'reset' = staffRow.auth_user_id ? 'reset' : 'activation'

    // One pending request per staff member — replace rather than pile up if
    // they submit again (e.g. correcting a typo'd password).
    const { data: existingPending } = await serviceClient
      .from('staff_password_requests')
      .select('id')
      .eq('staff_id', staffRow.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPending) {
      await serviceClient
        .from('staff_password_requests')
        .update({ new_password: newPassword, kind, requested_at: new Date().toISOString() })
        .eq('id', existingPending.id)
    } else {
      await serviceClient
        .from('staff_password_requests')
        .insert({
          school_id:    school.id,
          staff_id:     staffRow.id,
          kind,
          new_password: newPassword,
          status:       'pending',
        })
    }

    // Notify every active IT admin at this school (best-effort — a missing
    // notification shouldn't fail the request itself).
    try {
      const { data: itAdmins } = await serviceClient
        .from('staff')
        .select('auth_user_id')
        .eq('school_id', school.id)
        .eq('role', 'it_admin')
        .eq('is_active', true)
        .not('auth_user_id', 'is', null)

      const recipients = (itAdmins ?? []).map((a: any) => a.auth_user_id as string)
      if (recipients.length > 0) {
        const { data: requesterName } = await serviceClient
          .from('staff')
          .select('first_name, last_name')
          .eq('id', staffRow.id)
          .maybeSingle()
        const name = requesterName ? `${requesterName.first_name} ${requesterName.last_name}` : 'A staff member'

        await serviceClient.from('notifications').insert(
          recipients.map((uid: string) => ({
            school_id: school.id,
            user_id:   uid,
            type:      'general',
            title:     'Password request',
            body:      `${name} requested a ${kind === 'activation' ? 'new account password' : 'password reset'}. Review and approve in Credentials.`,
            link:      '/admin/credentials',
            from_user: null,
            read:      false,
            read_at:   null,
          }))
        )
      }
    } catch { /* best-effort */ }

    return json(genericResponse)

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
