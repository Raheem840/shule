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

    if (!parentAccountId || !email || !schoolId || !password) {
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

    // maybeSingle — returns null instead of throwing when staff row not found
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

    // Helper: find user by email across all pages (handles > 50 users)
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

    // Fetch parent account to include full_name and student_ids in JWT claims
    const { data: parentRow } = await adminClient
      .from('parent_accounts')
      .select('full_name, student_ids')
      .eq('id', parentAccountId)
      .eq('school_id', schoolId)
      .maybeSingle()

    const fullName   = (parentRow as any)?.full_name   ?? null
    const studentIds = (parentRow as any)?.student_ids ?? []

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        user_role:   'parent',
        school_id:   schoolId,
        full_name:   fullName,
        student_ids: studentIds,
      },
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

        // Update password AND app_metadata so shown credentials actually work
        const { error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
          password,
          app_metadata: { user_role: 'parent', school_id: schoolId },
        })
        if (updateErr) {
          return new Response(JSON.stringify({ error: 'Failed to update existing user', detail: updateErr.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Re-fetch parent row (may not have been fetched yet if createError path hit first)
        const { data: parentRowExist } = await adminClient
          .from('parent_accounts')
          .select('full_name, student_ids')
          .eq('id', parentAccountId)
          .eq('school_id', schoolId)
          .maybeSingle()

        await adminClient.auth.admin.updateUserById(existing.id, {
          app_metadata: {
            user_role:   'parent',
            school_id:   schoolId,
            full_name:   (parentRowExist as any)?.full_name   ?? null,
            student_ids: (parentRowExist as any)?.student_ids ?? [],
          },
        })

        await adminClient
          .from('parent_accounts')
          .update({ auth_user_id: existing.id, temp_password: password })
          .eq('id', parentAccountId)
          .eq('school_id', schoolId)

        return new Response(
          JSON.stringify({ success: true, authUserId: existing.id, alreadyExisted: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      throw createError
    }

    await adminClient
      .from('parent_accounts')
      .update({ auth_user_id: newUser.user.id, temp_password: password })
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
