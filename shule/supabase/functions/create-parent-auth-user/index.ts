import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { parentAccountId, email, schoolId, password } = await req.json()

    if (!parentAccountId || !email || !schoolId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role to create auth user — bypasses RLS intentionally
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Verify the caller is secretary, principal, or it_admin
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerStaff } = await adminClient
      .from('staff')
      .select('role, school_id')
      .eq('auth_user_id', caller.id)
      .single()

    if (
      !callerStaff ||
      callerStaff.school_id !== schoolId ||
      !['secretary', 'principal', 'it_admin'].includes(callerStaff.role)
    ) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the auth user — use caller-provided password or fall back to default
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: password ?? 'Parent@2025',
      email_confirm: true,
      app_metadata: { user_role: 'parent', school_id: schoolId },
    })

    if (createError) {
      // If user already exists, link the existing auth user
      if (createError.message.includes('already been registered')) {
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const existing = existingUsers?.users.find((u) => u.email === email)
        if (existing) {
          await adminClient
            .from('parent_accounts')
            .update({ auth_user_id: existing.id })
            .eq('id', parentAccountId)
            .eq('school_id', schoolId)

          await adminClient.auth.admin.updateUserById(existing.id, {
            app_metadata: { user_role: 'parent', school_id: schoolId },
          })

          return new Response(
            JSON.stringify({ success: true, authUserId: existing.id, alreadyExisted: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }
      throw createError
    }

    // Link auth user to parent_accounts row
    await adminClient
      .from('parent_accounts')
      .update({ auth_user_id: newUser.user.id })
      .eq('id', parentAccountId)
      .eq('school_id', schoolId)

    return new Response(
      JSON.stringify({ success: true, authUserId: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
