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

    const { studentId, email, schoolId, password } = await req.json()

    if (!studentId || !email || !schoolId || !password) {
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

    // Helper: find a user by email across all pages
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

    // Try to create a fresh auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { user_role: 'student', school_id: schoolId },
    })

    if (createError) {
      // Auth user already exists — DO NOT reset their password.
      // Just fix the link and preserve the password already stored in the students row.
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        const existing = await findUserByEmail(email)
        if (!existing) {
          return new Response(JSON.stringify({ error: 'User exists but could not be located' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Only update app_metadata — never touch the password here to avoid mismatch
        await adminClient.auth.admin.updateUserById(existing.id, {
          app_metadata: { user_role: 'student', school_id: schoolId },
        })

        // Fetch the temp_password already stored in the students row (if any)
        const { data: existingRow } = await adminClient
          .from('students')
          .select('temp_password')
          .eq('id', studentId)
          .eq('school_id', schoolId)
          .maybeSingle()

        const storedPassword = (existingRow as any)?.temp_password ?? null

        // Re-link auth_user_id only (keep existing temp_password — do NOT overwrite it)
        await adminClient
          .from('students')
          .update({ auth_user_id: existing.id, auth_email: email })
          .eq('id', studentId)
          .eq('school_id', schoolId)

        // If there was no stored password, store the new one so the admin has something to show
        if (!storedPassword) {
          await adminClient
            .from('students')
            .update({ temp_password: password })
            .eq('id', studentId)
            .eq('school_id', schoolId)

          // Also set the actual auth password so it matches what we'll display
          await adminClient.auth.admin.updateUserById(existing.id, { password })
        }

        return new Response(
          JSON.stringify({
            success: true,
            authUserId: existing.id,
            alreadyExisted: true,
            // Return the password that is actually in the DB so the caller can show it
            actualPassword: storedPassword ?? password,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      throw createError
    }

    // Fresh user created — store password and link
    await adminClient
      .from('students')
      .update({ auth_user_id: newUser.user.id, auth_email: email, temp_password: password })
      .eq('id', studentId)
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
