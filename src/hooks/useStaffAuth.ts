import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { getFunctionErrorMessage } from '../lib/functionsError'
import { generateTempPassword } from '../lib/passwords'

// ── useActivateStaffLogin ──────────────────────────────────────────────────
// Calls 'create-staff-auth-user' Edge Function which:
//   - Creates a Supabase Auth user and emails them an invite link to set
//     their own password (or, if the auth account already exists, emails a
//     password-reset link) — the same "Forgot password" mechanism used on
//     the login page. Nobody but the staff member ever sees their password.
//   - Updates staff.auth_user_id with the new auth user's UUID
export function useActivateStaffLogin() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, emailOverride }: { staffId: string; emailOverride?: string }): Promise<{ email: string; emailSent: boolean }> => {
      if (!user) throw new Error('Not authenticated')

      const { data: staff, error: staffErr } = await supabase
        .from('staff')
        .select('id, email, staff_number, first_name, last_name, auth_user_id')
        .eq('id', staffId)
        .eq('school_id', user.schoolId)
        .maybeSingle()

      if (staffErr) throw new Error(staffErr.message)
      if (!staff)   throw new Error('Staff member not found')
      if ((staff as any).auth_user_id) throw new Error('Login already activated for this staff member')

      // Resolve email: caller override → profile email → auto-generated from staff number
      let email = emailOverride?.trim() || ((staff as any).email as string | null) || null
      if (!email) {
        const { data: school } = await supabase
          .from('school_profile')
          .select('short_name, school_name')
          .eq('id', user.schoolId)
          .maybeSingle()
        const rawDomain = (school?.short_name as string | null)
          || (school?.school_name as string | null)
          || 'school'
        const shortName = rawDomain.toLowerCase().replace(/[^a-z0-9]/g, '')
        const staffNum  = ((staff as any).staff_number as string ?? '').toLowerCase().replace(/[^a-z0-9]/g, '-')
        email = `staff.${staffNum}@${shortName}.ug`
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-staff-auth-user', {
        body: {
          staffId, email, schoolId: user.schoolId,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      })

      if (fnError) {
        throw new Error(`Failed to activate login: ${fnError.message}`)
      }
      if (!(fnData as any)?.success) {
        const detail = (fnData as { error?: string } | null)?.error ?? 'Unknown error'
        throw new Error(`Failed to activate login: ${detail}`)
      }

      return { email, emailSent: (fnData as any)?.emailSent !== false }
    },
    onSuccess: (_data, { staffId }) => {
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['staff-member', user?.schoolId, staffId] })
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}

// ── useLinkAuthUser ────────────────────────────────────────────────────────
// Manually links an existing Supabase auth user UUID to a staff record.
export function useLinkAuthUser() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, authUserId }: { staffId: string; authUserId: string }) => {
      if (!user) throw new Error('Not authenticated')

      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRe.test(authUserId.trim())) {
        throw new Error('Invalid UUID — copy it from Supabase Dashboard → Authentication → Users')
      }

      const { error } = await supabase
        .from('staff')
        .update({ auth_user_id: authUserId.trim() })
        .eq('id', staffId)
        .eq('school_id', user.schoolId)

      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, { staffId }) => {
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['staff-member', user?.schoolId, staffId] })
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}

// ── useResetStaffPassword ──────────────────────────────────────────────────
// Sets the staff member's password directly via the reset-staff-password Edge
// Function and returns the new temp password for the IT admin/principal to
// share — the same pattern as useResetStudentPassword. This previously sent
// a Supabase Auth reset EMAIL instead, which depends on the project having a
// verified sending domain/SMTP configured — not true for most deployments,
// so every reset failed with a generic "non-2xx" error and no way to recover
// the account at all.
export function useResetStaffPassword() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ authUserId, staffId, name }: {
      authUserId: string; staffId: string; email?: string; name: string
    }): Promise<{ email: string; tempPassword: string }> => {
      if (!user) throw new Error('Not authenticated')

      const tempPassword = generateTempPassword()

      const { data, error: fnError } = await supabase.functions.invoke('reset-staff-password', {
        body: { userId: authUserId, staffId, newPassword: tempPassword },
      })

      // Record in audit_log regardless of success/failure
      await supabase.from('audit_log').insert({
        school_id:   user!.schoolId,
        user_id:     user!.id,
        role:        user!.role,
        action:      'PASSWORD_RESET',
        table_name:  'staff',
        record_id:   staffId,
        entity_name: name,
        new_value:   { reset_by: user!.email, method: 'direct', timestamp: new Date().toISOString() },
      })

      if (fnError) throw new Error(`Password reset failed: ${await getFunctionErrorMessage(fnError)}`)
      return { email: (data as { email?: string } | null)?.email ?? '', tempPassword }
    },
    onSuccess: (_data, { staffId }) => {
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['staff-member', user?.schoolId, staffId] })
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}

// ── useSendCredentialsSms ─────────────────────────────────────────────────
// Sends login info to a staff/student member via Africa's Talking SMS.
// Staff no longer have a password to send — omit `password` and they're told
// to check their email for the invite/reset link instead. Students still use
// the temp-password model (unchanged by this staff-password-model change),
// so `password` stays supported for that caller.
// The send-sms Edge Function takes { recipients: [{phone, message}], schoolId }.
export function useSendCredentialsSms() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ phone, name, email, password }: {
      phone: string; name: string; email: string; password?: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      const loginUrl = window.location.origin
      const message  = password
        ? [
            `Hi ${name},`,
            `Your Shule school system login has been activated.`,
            `Email: ${email}`,
            `Password: ${password}`,
            `Login at: ${loginUrl}`,
            `Please change your password after first login.`,
          ].join('\n')
        : [
            `Hi ${name},`,
            `Your Shule school system login has been activated.`,
            `Email: ${email}`,
            `Check your email for a link to set your password, then log in at: ${loginUrl}`,
          ].join('\n')

      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          recipients: [{ phone, message }],
          schoolId: user.schoolId,
        },
      })

      if (error) throw new Error('SMS delivery failed — check Africa\'s Talking config in School Settings')
    },
  })
}
