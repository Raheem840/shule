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

// Sets the staff member's password directly, server-side, and stores it as
// temp_password for IT admin/principal to view and share — the same pattern
// already used by reset-student-password/reset-parent-password. This used to
// send a Supabase Auth "reset password" EMAIL instead, which depends on the
// project having a verified sending domain / configured SMTP — undocumented
// and not true for most school deployments, so every reset silently failed
// with a generic non-2xx error and no way to actually recover the account.
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
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    // Role resolution — always re-verify against the live staff table (is_active
    // required). A JWT/app_metadata role claim is NOT trusted on its own: a token
    // issued before the caller was deactivated stays valid until it expires, and
    // trusting the stale claim would let a deactivated admin keep resetting
    // passwords — the exact gap migration 20260701_000001 was meant to close.
    const { data: callerStaff } = await serviceClient
      .from('staff')
      .select('role, school_id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    const userRole = (callerStaff?.role as string | undefined) ?? ''
    const callerSchoolId = (callerStaff?.school_id as string | undefined) ?? ''

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — IT Admin or Principal required' }, 403)
    }

    const body = await req.json() as { userId?: string; newPassword?: string; staffId?: string }
    const { userId, newPassword, staffId } = body

    if (!userId || !newPassword || !staffId) {
      return json({ error: 'userId, staffId and newPassword are required' }, 400)
    }
    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // Verify the target staff row belongs to the caller's own school AND
    // that its auth_user_id actually matches the supplied userId — without
    // this, any it_admin/principal could pass an arbitrary auth.users id
    // (e.g. another school's staff member) and change that account's
    // password, since Supabase Auth's admin API has no per-school concept.
    const { data: targetStaff } = await serviceClient
      .from('staff')
      .select('auth_user_id')
      .eq('id', staffId)
      .eq('school_id', callerSchoolId)
      .maybeSingle()

    if (!targetStaff || targetStaff.auth_user_id !== userId) {
      return json({ error: 'Staff member not found in your school' }, 404)
    }

    // Look up the target's email server-side (authoritative — never trust a
    // client-supplied email for this) for the confirmation response only.
    const { data: targetUser, error: getUserErr } = await serviceClient.auth.admin.getUserById(userId)
    if (getUserErr || !targetUser?.user?.email) {
      return json({ error: 'Could not resolve an email address for this account' }, 400)
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      return json({ error: 'Failed to update password', detail: updateError.message }, 500)
    }

    // Persist new temp_password on the staff row for IT admin credential retrieval.
    await serviceClient
      .from('staff')
      .update({ temp_password: newPassword })
      .eq('id', staffId)
      .eq('school_id', callerSchoolId)

    return json({ success: true, email: targetUser.user.email })

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
