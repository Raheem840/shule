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

    const { recipients, schoolId } = await req.json()

    if (!recipients?.length || !schoolId) {
      return new Response(JSON.stringify({ error: 'Missing recipients or schoolId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the caller is a real, active staff member of this school —
    // previously this function had no authentication check at all: anyone
    // with the project URL and public anon key could send unlimited
    // messages billed to the school's live WhatsApp account.
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
      .select('school_id, is_active')
      .eq('auth_user_id', caller.id)
      .single()

    if (!callerStaff || callerStaff.is_active === false || callerStaff.school_id !== schoolId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: school } = await adminClient
      .from('school_profile')
      .select('wa_phone_number_id, wa_access_token')
      .eq('id', schoolId)
      .single()

    if (!school?.wa_access_token) {
      return new Response(JSON.stringify({ error: 'WhatsApp API not configured for this school' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Normalise to international format WITHOUT + (WhatsApp Cloud API requirement)
    function normPhone(raw: string): string {
      const digits = raw.replace(/\D/g, '')
      if (digits.startsWith('256')) return digits
      if (digits.startsWith('0'))   return '256' + digits.slice(1)
      if (digits.length === 9)      return '256' + digits
      return digits
    }

    const results = []

    for (const recipient of recipients) {
      try {
        const phone = normPhone(recipient.phone)
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${school.wa_phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${school.wa_access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'text',
              text: { body: recipient.message }
            })
          }
        )

        const result = await response.json()
        const success = !!result?.messages?.[0]?.id

        if (recipient.queueId) {
          await adminClient
            .from('send_queue')
            .update({
              status: success ? 'sent' : 'failed',
              sent_at: new Date().toISOString()
            })
            .eq('id', recipient.queueId)
        }

        await adminClient.from('sms_reminders').insert({
          school_id: schoolId,
          student_id: recipient.studentId,
          parent_phone: recipient.phone,
          channel: 'whatsapp',
          message: recipient.message,
          status: success ? 'sent' : 'failed',
          sent_at: new Date().toISOString()
        })

        results.push({ phone, success, result })
      } catch (err) {
        results.push({ phone: recipient.phone, success: false, error: err.message })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})