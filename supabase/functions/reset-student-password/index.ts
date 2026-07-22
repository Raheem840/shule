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

    // Verify caller JWT (validates signature server-side)
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
    // admin keep resetting student passwords.
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

    const body = await req.json() as {
      userId?: string; newPassword?: string; schoolId?: string; studentId?: string
    }
    const { userId, newPassword, schoolId: callerSchoolId, studentId } = body

    if (!userId || !newPassword) {
      return json({ error: 'userId and newPassword are required' }, 400)
    }
    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // Resolve school_id: try DB lookup first, fall back to caller-supplied value
    const { data: studentRow } = await serviceClient
      .from('students')
      .select('school_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    const schoolId = studentRow?.school_id ?? callerSchoolId ?? null

    if (!schoolId) {
      return json({ error: 'Could not resolve school for this student' }, 400)
    }

    // If studentId provided and auth_user_id isn't linked yet, fix the link now
    // so the DB JWT hook can find this student on next sign-in
    if (studentId && !studentRow) {
      await serviceClient
        .from('students')
        .update({ auth_user_id: userId })
        .eq('id', studentId)
        .eq('school_id', schoolId)
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: {
        user_role: 'student',
        school_id: schoolId,
      },
    })

    if (updateError) {
      return json({ error: 'Failed to update password', detail: updateError.message }, 500)
    }

    // Persist new temp_password on the student row for IT admin credential retrieval
    if (studentId) {
      await serviceClient
        .from('students')
        .update({ temp_password: newPassword })
        .eq('id', studentId)
        .eq('school_id', schoolId)
    }

    return json({ success: true })

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
