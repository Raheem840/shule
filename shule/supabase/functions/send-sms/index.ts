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

    // Get API credentials from school_profile
    const { data: school } = await adminClient
      .from('school_profile')
      .select('at_api_key, at_username, at_sender_id')
      .eq('id', schoolId)
      .single()

    if (!school?.at_api_key) {
      return new Response(JSON.stringify({ error: 'SMS API not configured for this school' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = []

    for (const recipient of recipients) {
      try {
        const formData = new URLSearchParams()
        formData.append('username', school.at_username)
        formData.append('to', recipient.phone)
        formData.append('message', recipient.message)
        if (school.at_sender_id) {
          formData.append('from', school.at_sender_id)
        }

        const response = await fetch(
          'https://api.africastalking.com/version1/messaging',
          {
            method: 'POST',
            headers: {
              'apiKey': school.at_api_key,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            body: formData.toString()
          }
        )

        const result = await response.json()
        const success = result?.SMSMessageData?.Recipients?.[0]?.status === 'Success'

        // Update send_queue
        if (recipient.queueId) {
          await adminClient
            .from('send_queue')
            .update({
              status: success ? 'sent' : 'failed',
              sent_at: new Date().toISOString()
            })
            .eq('id', recipient.queueId)
        }

        // Insert to sms_reminders
        await adminClient.from('sms_reminders').insert({
          school_id: schoolId,
          student_id: recipient.studentId,
          parent_phone: recipient.phone,
          channel: 'sms',
          message: recipient.message,
          status: success ? 'sent' : 'failed',
          sent_at: new Date().toISOString()
        })

        results.push({ phone: recipient.phone, success, result })
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