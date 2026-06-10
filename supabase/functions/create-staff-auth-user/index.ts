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

    const { email, staffId, schoolId, password } = await req.json()

    if (!email || !staffId || !schoolId || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Verify caller is secretary / principal / it_admin via staff table
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
      .maybeSingle()

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

    // Fetch target staff role for app_metadata
    const { data: targetStaff } = await adminClient
      .from('staff')
      .select('role')
      .eq('id', staffId)
      .eq('school_id', schoolId)
      .maybeSingle()

    const staffRole = (targetStaff?.role as string | undefined) ?? 'teacher'

    // Helper: find a user by email across all pages (handles > 50 users)
    async function findUserByEmail(emailToFind: string) {
      let page = 1
      while (true) {
        const { data } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
        const found = (data?.users ?? []).find((u) => u.email === emailToFind)
        if (found) return found
        if ((data?.users ?? []).length < 1000) return null
        page++
      }
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { user_role: staffRole, school_id: schoolId },
    })

    if (createError) {
      // Auth user already exists — update password + app_metadata and re-link
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        const existing = await findUserByEmail(email)
        if (!existing) {
          return new Response(JSON.stringify({ error: 'User exists but could not be located' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Update password AND app_metadata so shown credentials match Supabase
        const { error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
          password,
          app_metadata: { user_role: staffRole, school_id: schoolId },
        })
        if (updateErr) {
          return new Response(JSON.stringify({ error: 'Failed to update existing user', detail: updateErr.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        await adminClient
          .from('staff')
          .update({ auth_user_id: existing.id, temp_password: password })
          .eq('id', staffId)
          .eq('school_id', schoolId)

        return new Response(
          JSON.stringify({ success: true, authUserId: existing.id, alreadyExisted: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      throw createError
    }

    await adminClient
      .from('staff')
      .update({ auth_user_id: newUser.user.id, temp_password: password })
      .eq('id', staffId)
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
