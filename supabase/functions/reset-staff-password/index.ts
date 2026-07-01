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

// Sends the staff member a password-reset EMAIL — the same "Forgot password"
// mechanism used on the login page. IT admin / principal can no longer set or
// see a staff member's password directly; they can only trigger this email.
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
        .eq('is_active', true)
        .maybeSingle()
      userRole = (callerStaff?.role as string | undefined) ?? userRole
    }

    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — IT Admin or Principal required', resolvedRole: userRole }, 403)
    }

    const body = await req.json() as { userId?: string; redirectTo?: string }
    const { userId, redirectTo } = body

    if (!userId) {
      return json({ error: 'userId is required' }, 400)
    }

    // Look up the target's email server-side (authoritative — never trust a
    // client-supplied email for this).
    const { data: targetUser, error: getUserErr } = await serviceClient.auth.admin.getUserById(userId)
    if (getUserErr || !targetUser?.user?.email) {
      return json({ error: 'Could not resolve an email address for this account' }, 400)
    }

    const { error: resetErr } = await anonClient.auth.resetPasswordForEmail(targetUser.user.email, {
      redirectTo: redirectTo || undefined,
    })

    if (resetErr) {
      return json({ error: 'Failed to send reset email', detail: resetErr.message }, 500)
    }

    return json({ success: true, email: targetUser.user.email })

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
