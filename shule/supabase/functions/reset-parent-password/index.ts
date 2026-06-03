import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    const userRole = (user.app_metadata?.user_role ?? '') as string
    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions' }, 403)
    }

    const body = await req.json() as { authUserId?: string; parentAccountId?: string; schoolId?: string }
    const { authUserId, parentAccountId, schoolId } = body

    if (!authUserId || !schoolId) {
      return json({ error: 'authUserId and schoolId are required' }, 400)
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const newPassword = generatePassword()

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    })

    if (updateError) {
      return json({ error: 'Failed to reset password', detail: updateError.message }, 500)
    }

    // Store new temp_password in parent_accounts if we have the ID
    if (parentAccountId) {
      await serviceClient
        .from('parent_accounts')
        .update({ temp_password: newPassword })
        .eq('id', parentAccountId)
        .eq('school_id', schoolId)
    }

    return json({ success: true, tempPassword: newPassword })

  } catch (err) {
    return json({ error: 'Internal server error' }, 500)
  }
})
