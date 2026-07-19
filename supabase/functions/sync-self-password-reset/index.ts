import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// Called by the user THEMSELVES right after they complete a Supabase Auth
// password-recovery flow (ResetPasswordPage.tsx) or an in-session change on
// /profile (useChangePassword) — never by an admin acting on someone else,
// so there's no target-id param; everything is resolved from the caller's
// own authenticated session.
//
// Student/parent: temp_password is cleared and password_reset_at stamped so
// CredentialsMgmtPage.tsx can show "Self-reset on <date>" instead of a now-
// stale admin-issued password — this needs a service-role write because
// students/parent_accounts UPDATE RLS only allows secretary/principal/
// it_admin/class_teacher, not the student/parent themselves.
//
// Everyone else (staff): audit_log + notify every active IT admin. RLS
// already lets any authenticated user insert into audit_log/notifications
// for their own school, so this branch doesn't strictly need service role,
// but it stays here so both call sites (ResetPasswordPage, useChangePassword)
// share one implementation instead of duplicating the audit/notify logic.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    // Resolve which of the three tables this authenticated caller belongs
    // to, purely from their own auth_user_id — never trust a client-supplied
    // role/table, this call only ever acts on the caller's own row.
    const [staffRow, studentRow, parentRow] = await Promise.all([
      serviceClient.from('staff').select('id, school_id, role, first_name, last_name')
        .eq('auth_user_id', user.id).eq('is_active', true).maybeSingle(),
      serviceClient.from('students').select('id, school_id, first_name, last_name')
        .eq('auth_user_id', user.id).maybeSingle(),
      serviceClient.from('parent_accounts').select('id, school_id, full_name')
        .eq('auth_user_id', user.id).maybeSingle(),
    ])

    if (studentRow.data) {
      const s = studentRow.data
      await serviceClient
        .from('students')
        .update({ temp_password: null, password_reset_at: new Date().toISOString() })
        .eq('id', s.id)
        .eq('school_id', s.school_id)
      return json({ success: true, kind: 'student' })
    }

    if (parentRow.data) {
      const p = parentRow.data
      await serviceClient
        .from('parent_accounts')
        .update({ temp_password: null, password_reset_at: new Date().toISOString() })
        .eq('id', p.id)
        .eq('school_id', p.school_id)
      return json({ success: true, kind: 'parent' })
    }

    if (staffRow.data) {
      const st = staffRow.data
      const name = `${st.first_name} ${st.last_name}`

      await serviceClient.from('audit_log').insert({
        school_id:   st.school_id,
        user_id:     user.id,
        role:        st.role,
        action:      'PASSWORD_RESET',
        table_name:  'staff',
        record_id:   st.id,
        entity_name: name,
        new_value:   { method: 'self-service', timestamp: new Date().toISOString() },
      })

      const { data: itAdmins } = await serviceClient
        .from('staff')
        .select('auth_user_id')
        .eq('school_id', st.school_id)
        .eq('role', 'it_admin')
        .eq('is_active', true)
        .not('auth_user_id', 'is', null)

      const recipientIds = (itAdmins ?? [])
        .map(r => r.auth_user_id as string | null)
        .filter((id): id is string => !!id)

      if (recipientIds.length > 0) {
        await serviceClient.from('notifications').insert(
          recipientIds.map(uid => ({
            school_id: st.school_id,
            user_id:   uid,
            type:      'security',
            title:     'Staff password changed',
            body:      `${name} changed their own password.`,
            link:      '/admin/credentials',
            from_user: user.id,
            read:      false,
            read_at:   null,
          }))
        )
      }

      return json({ success: true, kind: 'staff' })
    }

    return json({ error: 'No matching account found for this session' }, 404)

  } catch (err) {
    return json({ error: 'Internal server error', detail: String(err) }, 500)
  }
})
