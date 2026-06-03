import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Secretary, IT Admin, and Principal can reset student passwords
const ALLOWED_ROLES = ['secretary', 'it_admin', 'principal']

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    // Verify JWT with anon client
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    // Role check via JWT app_metadata
    const userRole = (user.app_metadata?.user_role ?? '') as string
    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — Secretary, IT Admin, or Principal required' }, 403)
    }

    const body = await req.json() as { userId?: string; newPassword?: string }
    const { userId, newPassword } = body

    if (!userId || !newPassword) {
      return json({ error: 'userId and newPassword are required' }, 400)
    }
    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch the student's school_id to patch app_metadata
    const { data: studentRow } = await serviceClient
      .from('students')
      .select('school_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: {
        user_role: 'student',
        school_id: studentRow?.school_id ?? null,
      },
    })

    if (updateError) {
      return json({ error: 'Failed to update password', detail: updateError.message }, 500)
    }

    return json({ success: true })

  } catch (err) {
    return json({ error: 'Internal server error' }, 500)
  }
})
