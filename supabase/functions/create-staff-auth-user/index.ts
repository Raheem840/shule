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

    // No password field — staff set their own password via an emailed invite
    // link, the same way "Forgot password" works on the login page. IT admin
    // / secretary never see or choose a password for someone else.
    const { email, staffId, schoolId, redirectTo } = await req.json()

    if (!email || !staffId || !schoolId) {
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
    // Separate anonymous client for resetPasswordForEmail — that call is a
    // public/unauthenticated mailer trigger and shouldn't run under the
    // caller's own session.
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
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
      .eq('is_active', true)
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

    // Optimistic path: try to invite as a brand-new auth user first (the vast
    // majority of calls — a fresh staff record with no auth account yet).
    // Only fall back to a full-directory email search if that fails with
    // "already registered", instead of paging through every auth user (which
    // could number in the thousands once students/parents/staff share
    // auth.users) on every single call.
    const { data: newUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || undefined,
    })

    if (!inviteError) {
      await adminClient
        .from('staff')
        .update({ auth_user_id: newUser.user.id })
        .eq('id', staffId)
        .eq('school_id', schoolId)

      return new Response(
        JSON.stringify({ success: true, authUserId: newUser.user.id, invited: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!inviteError.message.includes('already registered') && !inviteError.message.includes('already exists')) {
      return new Response(JSON.stringify({ error: 'Failed to invite staff member', detail: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Already has an auth account (e.g. re-linking after Unlink) — find it,
    // link it, and send a reset email so they can set/regain access themselves.
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

    const existing = await findUserByEmail(email)
    if (!existing) {
      return new Response(JSON.stringify({ error: 'User exists but could not be located' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminClient
      .from('staff')
      .update({ auth_user_id: existing.id })
      .eq('id', staffId)
      .eq('school_id', schoolId)

    const { error: resetErr } = await anonClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || undefined,
    })

    return new Response(
      JSON.stringify({ success: true, authUserId: existing.id, alreadyExisted: true, emailSent: !resetErr }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
