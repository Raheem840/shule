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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { schoolId, body, postedBy } = await req.json()

    if (!schoolId || !body || !postedBy) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify caller is allowed to post announcements
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: callerStaff } = await adminClient
      .from('staff')
      .select('role, school_id')
      .eq('auth_user_id', caller.id)
      .single()

    const allowedRoles = ['principal','deputy','dos','secretary','bursar','it_admin']
    if (!callerStaff || !allowedRoles.includes(callerStaff.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden — teachers cannot post announcements' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch all student auth_user_ids for the school
    const { data: students } = await adminClient
      .from('students')
      .select('auth_user_id')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .not('auth_user_id', 'is', null)

    // Fetch all parent account user_ids
    const { data: parents } = await adminClient
      .from('parent_accounts')
      .select('id')
      .eq('school_id', schoolId)

    const notifications = [
      ...(students ?? []).map(s => ({
        school_id: schoolId,
        user_id: s.auth_user_id,
        type: 'announcement',
        body,
        read: false
      })),
      ...(parents ?? []).map(p => ({
        school_id: schoolId,
        user_id: p.id,
        type: 'announcement',
        body,
        read: false
      }))
    ]

    // Batch insert 50 at a time
    let totalInserted = 0
    for (let i = 0; i < notifications.length; i += 50) {
      const batch = notifications.slice(i, i + 50)
      const { error } = await adminClient
        .from('notifications')
        .insert(batch)
      if (!error) totalInserted += batch.length
    }

    return new Response(JSON.stringify({
      success: true,
      notificationsSent: totalInserted
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})