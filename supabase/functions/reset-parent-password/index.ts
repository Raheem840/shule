import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES = ['secretary', 'it_admin', 'principal']

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

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

    // Role resolution — always re-verify against the live staff table
    // (is_active required). A JWT/app_metadata role claim is NOT trusted on
    // its own: a token issued before the caller was deactivated stays valid
    // until it expires, and trusting the stale claim would let a deactivated
    // admin keep resetting parent passwords.
    const { data: callerStaff } = await serviceClient
      .from('staff')
      .select('role')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    const userRole = (callerStaff?.role as string | undefined) ?? ''

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — Secretary, IT Admin, or Principal required' }, 403)
    }

    const body = await req.json() as { userId?: string; newPassword?: string; schoolId?: string }
    const { userId, newPassword, schoolId } = body

    if (!userId || !newPassword || !schoolId) {
      return json({ error: 'userId, newPassword and schoolId are required' }, 400)
    }
    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // Fetch parent's school_id for app_metadata
    const { data: parentRow } = await serviceClient
      .from('parent_accounts')
      .select('school_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    const effectiveSchoolId = parentRow?.school_id ?? schoolId

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: {
        user_role: 'parent',
        school_id: effectiveSchoolId,
      },
    })

    if (updateError) {
      return json({ error: 'Failed to reset password', detail: updateError.message }, 500)
    }

    // Persist new temp_password on parent_accounts so IT admin credentials page stays accurate
    await serviceClient
      .from('parent_accounts')
      .update({ temp_password: newPassword })
      .eq('auth_user_id', userId)
      .eq('school_id', effectiveSchoolId)

    return json({ success: true })

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
