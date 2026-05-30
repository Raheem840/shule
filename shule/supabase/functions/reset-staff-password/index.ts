import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Only IT Admin and Principal can reset passwords
const ALLOWED_ROLES = ['it_admin', 'principal']

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

serve(async (req) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 2. Extract Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    // 3. Verify JWT with anon client — NEVER service role for this step
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    // 4. Extract role from JWT app_metadata (set by custom access token hook)
    const userRole = (user.app_metadata?.user_role ?? '') as string

    // 5. Role check — must be IT Admin or Principal
    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — IT Admin or Principal required' }, 403)
    }

    // 6. Validate request body
    const body = await req.json() as { userId?: string; newPassword?: string }
    const { userId, newPassword } = body

    if (!userId || !newPassword) {
      return json({ error: 'userId and newPassword are required' }, 400)
    }
    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // 7. Service role client — created ONLY after all checks pass
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 8. Update the target user's password
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return json({ error: 'Failed to update password', detail: updateError.message }, 500)
    }

    // 9. Return success — no password echoed back
    return json({ success: true })

  } catch (err) {
    console.error('Unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
