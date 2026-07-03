import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES = ['it_admin', 'principal']

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

// IT admin (or principal) approves or rejects a pending staff_password_requests
// row. Approval reads the plaintext new_password server-side only (service_role
// — the caller's own JWT can never SELECT this column, enforced at the DB layer)
// and either creates a brand-new Supabase Auth user (activation) or updates an
// existing one's password (reset). The password is cleared from the row
// immediately after use either way.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !caller) return json({ error: 'Invalid session' }, 401)

    // Always re-verify against the live staff table (is_active required) —
    // never trust a JWT role claim alone, since a token issued before
    // deactivation stays valid until it expires.
    const { data: callerStaff } = await serviceClient
      .from('staff')
      .select('id, role, school_id')
      .eq('auth_user_id', caller.id)
      .eq('is_active', true)
      .maybeSingle()

    const callerRole = (callerStaff?.role as string | undefined) ?? ''
    if (!callerStaff || !ALLOWED_ROLES.includes(callerRole)) {
      return json({ error: 'Insufficient permissions — IT Admin or Principal required' }, 403)
    }

    const body = await req.json() as { requestId?: string; action?: 'approve' | 'reject' }
    const { requestId, action } = body

    if (!requestId || (action !== 'approve' && action !== 'reject')) {
      return json({ error: 'requestId and a valid action are required' }, 400)
    }

    const { data: reqRow, error: reqErr } = await serviceClient
      .from('staff_password_requests')
      .select('id, school_id, staff_id, kind, new_password, status')
      .eq('id', requestId)
      .eq('school_id', callerStaff.school_id)
      .maybeSingle()

    if (reqErr || !reqRow) {
      return json({ error: 'Request not found' }, 404)
    }
    if (reqRow.status !== 'pending') {
      return json({ error: `Request already ${reqRow.status}` }, 409)
    }

    const { data: staffRow } = await serviceClient
      .from('staff')
      .select('id, auth_user_id, email, staff_number, first_name, last_name, school_id')
      .eq('id', reqRow.staff_id)
      .maybeSingle()

    if (!staffRow) {
      return json({ error: 'Staff record not found' }, 404)
    }

    if (action === 'reject') {
      await serviceClient
        .from('staff_password_requests')
        .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: callerStaff.id, new_password: null })
        .eq('id', requestId)

      // Only notify if they already have a working account (an activation
      // request has no auth_user_id yet — no in-app channel to reach them).
      if (staffRow.auth_user_id) {
        await serviceClient.from('notifications').insert({
          school_id: staffRow.school_id,
          user_id:   staffRow.auth_user_id,
          type:      'general',
          title:     'Password request declined',
          body:      'Your password request was declined. Contact your IT admin for details.',
          link:      '/profile',
          from_user: caller.id,
          read:      false,
          read_at:   null,
        })
      }

      return json({ success: true, action: 'rejected' })
    }

    // ── Approve ──────────────────────────────────────────────
    const newPassword = reqRow.new_password as string

    let targetAuthUserId = staffRow.auth_user_id as string | null

    if (reqRow.kind === 'activation') {
      if (targetAuthUserId) {
        return json({ error: 'Staff member already has an account — this was a stale activation request' }, 409)
      }

      const { data: schoolRow } = await serviceClient
        .from('school_profile')
        .select('short_name, school_name')
        .eq('id', staffRow.school_id)
        .maybeSingle()

      const email = (staffRow.email as string | null) ?? (() => {
        const num    = (staffRow.staff_number as string).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        const domain = ((schoolRow as any)?.short_name ?? (schoolRow as any)?.school_name ?? 'school')
          .toLowerCase().replace(/[^a-z0-9]/g, '')
        return `staff.${num}@${domain}.ug`
      })()

      const { data: newUser, error: createErr } = await serviceClient.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
      })

      if (createErr) {
        return json({ error: 'Failed to create account', detail: createErr.message }, 500)
      }

      targetAuthUserId = newUser.user.id

      await serviceClient
        .from('staff')
        .update({ auth_user_id: targetAuthUserId, email: staffRow.email ?? email })
        .eq('id', staffRow.id)
        .eq('school_id', staffRow.school_id)
    } else {
      if (!targetAuthUserId) {
        return json({ error: 'Staff member has no account to reset — this was a stale reset request' }, 409)
      }
      // email_confirm: true also covers a staff member whose account was
      // previously created via the old email-invite flow and never confirmed
      // (no working SMTP to deliver that invite) — approving a reset here
      // guarantees they can log in regardless of that stuck prior state.
      const { error: updateErr } = await serviceClient.auth.admin.updateUserById(targetAuthUserId, { password: newPassword, email_confirm: true })
      if (updateErr) {
        return json({ error: 'Failed to update password', detail: updateErr.message }, 500)
      }
    }

    await serviceClient
      .from('staff_password_requests')
      .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: callerStaff.id, new_password: null })
      .eq('id', requestId)

    await serviceClient.from('audit_log').insert({
      school_id:   staffRow.school_id,
      user_id:     caller.id,
      role:        callerRole,
      action:      reqRow.kind === 'activation' ? 'STAFF_PASSWORD_ACTIVATED' : 'PASSWORD_RESET',
      table_name:  'staff',
      record_id:   staffRow.id,
      entity_name: `${staffRow.first_name} ${staffRow.last_name}`,
    })

    await serviceClient.from('notifications').insert({
      school_id: staffRow.school_id,
      user_id:   targetAuthUserId,
      type:      'general',
      title:     'Password approved',
      body:      'Your password request was approved. You can now log in with your new password.',
      link:      '/login',
      from_user: caller.id,
      read:      false,
      read_at:   null,
    })

    return json({ success: true, action: 'approved', kind: reqRow.kind })

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
