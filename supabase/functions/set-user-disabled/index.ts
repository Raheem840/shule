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

    const { authUserId, disabled, schoolId } = await req.json() as { authUserId: string; disabled: boolean; schoolId: string }

    if (!authUserId || typeof disabled !== 'boolean' || !schoolId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: authUserId, disabled, schoolId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Verify caller is it_admin or principal via staff table
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

    // Re-verify against the live staff table (is_active required) — a token
    // issued before the caller was deactivated stays valid until it expires,
    // and trusting a stale role claim would let a deactivated admin keep
    // banning/unbanning accounts. Also confirm the caller's own school here
    // so it can be cross-checked against the target below.
    const { data: callerStaff } = await adminClient
      .from('staff')
      .select('role, school_id')
      .eq('auth_user_id', caller.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!callerStaff || callerStaff.school_id !== schoolId || !['it_admin', 'principal'].includes(callerStaff.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden — only IT Admin or Principal can manage access' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the target account actually belongs to the caller's school —
    // Supabase Auth's admin API has no per-school concept, so without this
    // check any it_admin/principal could ban/unban a user in another school
    // by supplying their auth_user_id. The target may be staff, a student,
    // or a parent — check all three.
    const [{ data: targetStaff }, { data: targetStudent }, { data: targetParent }] = await Promise.all([
      adminClient.from('staff').select('id').eq('auth_user_id', authUserId).eq('school_id', schoolId).maybeSingle(),
      adminClient.from('students').select('id').eq('auth_user_id', authUserId).eq('school_id', schoolId).maybeSingle(),
      adminClient.from('parent_accounts').select('id').eq('auth_user_id', authUserId).eq('school_id', schoolId).maybeSingle(),
    ])

    if (!targetStaff && !targetStudent && !targetParent) {
      return new Response(JSON.stringify({ error: 'Target account not found in your school' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Apply ban (876600h ≈ 100 years) or lift it
    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
      ban_duration: disabled ? '876600h' : 'none',
    })

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, disabled }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
