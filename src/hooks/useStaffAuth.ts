import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

// ── generateTempPassword ───────────────────────────────────────────────────
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

// ── ACTIVATION_KEY ─────────────────────────────────────────────────────────
const ACTIVATION_KEY = 'shule_pending_activations'

export type PendingActivation = {
  staffId:      string
  email:        string
  tempPassword: string
  name:         string
  storedAt:     string
}

export function getPendingActivations(): Record<string, PendingActivation> {
  try {
    return JSON.parse(localStorage.getItem(ACTIVATION_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function clearPendingActivation(staffId: string): void {
  const existing = getPendingActivations()
  delete existing[staffId]
  localStorage.setItem(ACTIVATION_KEY, JSON.stringify(existing))
}

// ── useActivateStaffLogin ──────────────────────────────────────────────────
// Calls 'create-staff-auth-user' Edge Function which:
//   - Creates Supabase Auth user with email + default password
//   - Updates staff.auth_user_id with the new auth user's UUID
//   - Returns { success, authUserId }
// Falls back to localStorage if Edge Function not deployed.
export function useActivateStaffLogin() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, emailOverride }: { staffId: string; emailOverride?: string }): Promise<{ email: string; tempPassword: string; manual: boolean }> => {
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

      const tempPassword = generateTempPassword()

      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-staff-auth-user', {
        body: { staffId, email, schoolId: user.schoolId, password: tempPassword },
      })

      if (fnError) {
        // Edge function not deployed — persist credentials for manual setup
        const staffRec = staff as any
        await supabase
          .from('staff')
          .update({ temp_password: tempPassword })
          .eq('id', staffId)
          .eq('school_id', user.schoolId)
        const pending = getPendingActivations()
        pending[staffId] = {
          staffId,
          email,
          tempPassword,
          name: `${staffRec.first_name as string} ${staffRec.last_name as string}`,
          storedAt: new Date().toISOString(),
        }
        localStorage.setItem(ACTIVATION_KEY, JSON.stringify(pending))
        return { email, tempPassword, manual: true as const }
      }

      if (!(fnData as any)?.success) {
        const detail = (fnData as { error?: string } | null)?.error ?? 'Unknown error'
        throw new Error(`Failed to activate login: ${detail}`)
      }

      return { email, tempPassword, manual: false as const }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
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
      clearPendingActivation(staffId)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}

// ── useResetStaffPassword ──────────────────────────────────────────────────
// Calls reset-staff-password Edge Function with a new random temp password.
export function useResetStaffPassword() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ authUserId, staffId, name }: {
      authUserId: string; staffId: string; email?: string; name: string
    }): Promise<{ tempPassword: string; manual: boolean }> => {
      if (!user) throw new Error('Not authenticated')

      const tempPassword = generateTempPassword()

      const { error: fnError } = await supabase.functions.invoke('reset-staff-password', {
        body: { userId: authUserId, newPassword: tempPassword },
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
        new_value:   { reset_by: user!.email, method: fnError ? 'manual' : 'edge_function', timestamp: new Date().toISOString() },
      })

      if (!fnError) return { tempPassword, manual: false }

      // Surface the actual error — don't show credentials that won't work
      throw new Error(`Password reset failed: ${fnError.message}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}

// ── useSendCredentialsSms ─────────────────────────────────────────────────
// Sends login credentials to a staff member via Africa's Talking SMS.
// The send-sms Edge Function takes { recipients: [{phone, message}], schoolId }.
export function useSendCredentialsSms() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ phone, name, email, password }: {
      phone: string; name: string; email: string; password: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      const loginUrl = window.location.origin
      const message  = [
        `Hi ${name},`,
        `Your Shule school system login has been activated.`,
        `Email: ${email}`,
        `Password: ${password}`,
        `Login at: ${loginUrl}`,
        `Please change your password after first login.`,
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
