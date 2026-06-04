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

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1]
    const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
    return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
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

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    // Role resolution — JWT payload first, then app_metadata, then staff table
    const jwtPayload = decodeJwtPayload(token)
    let userRole =
      (jwtPayload.user_role as string | undefined) ??
      (user.app_metadata?.user_role as string | undefined) ??
      ''

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      const { data: callerStaff } = await serviceClient
        .from('staff')
        .select('role')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      userRole = (callerStaff?.role as string | undefined) ?? userRole
    }

    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — IT Admin or Principal required', resolvedRole: userRole }, 403)
    }

    const body = await req.json() as { userId?: string; newPassword?: string }
    const { userId, newPassword } = body

    if (!userId || !newPassword) {
      return json({ error: 'userId and newPassword are required' }, 400)
    }
    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // Fetch target staff role + school to patch app_metadata
    const { data: targetStaff } = await serviceClient
      .from('staff')
      .select('role, school_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    // Require staff record — can't set correct role/school in app_metadata without it
    if (!targetStaff) {
      return json({ error: 'Staff record not found for this auth user — cannot verify role. Use Unlink + Re-activate to fix.' }, 400)
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: {
        user_role: targetStaff.role,
        school_id: targetStaff.school_id,
      },
    })

    if (updateError) {
      return json({ error: 'Failed to update password', detail: updateError.message }, 500)
    }

    // Persist new temp_password on the staff row for IT admin credential retrieval
    await serviceClient
      .from('staff')
      .update({ temp_password: newPassword })
      .eq('auth_user_id', userId)
      .eq('school_id', targetStaff.school_id)

    return json({ success: true })

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
