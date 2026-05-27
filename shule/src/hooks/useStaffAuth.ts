import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

// ── generateTempPassword ───────────────────────────────────────────────────
// Crypto-random password: 12 chars, avoids ambiguous characters (0/O, 1/I/l).
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

// ── ACTIVATION_KEY ────────────────────────────────────────────────────────
// localStorage key for pending activations (see Task 6 workaround).
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

function setPendingActivation(activation: PendingActivation): void {
  const existing = getPendingActivations()
  existing[activation.staffId] = activation
  localStorage.setItem(ACTIVATION_KEY, JSON.stringify(existing))
}

export function clearPendingActivation(staffId: string): void {
  const existing = getPendingActivations()
  delete existing[staffId]
  localStorage.setItem(ACTIVATION_KEY, JSON.stringify(existing))
}

// ── useActivateStaffLogin ──────────────────────────────────────────────────
// Attempts to call the 'activate-staff-login' Edge Function (creates Supabase
// Auth user + updates staff.auth_user_id). If the Edge Function is not yet
// deployed, stores credentials in localStorage for manual completion by IT Admin.
//
// Edge Function contract (to be deployed separately):
//   POST /functions/v1/activate-staff-login
//   body: { staffId: string, email: string, tempPassword: string }
//   response: { authUserId: string }
export function useActivateStaffLogin() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (staffId: string): Promise<{ email: string; tempPassword: string; manual: boolean }> => {
      if (!user) throw new Error('Not authenticated')

      const { data: staff, error: staffErr } = await supabase
        .from('staff')
        .select('id, email, first_name, last_name, auth_user_id')
        .eq('id', staffId)
        .eq('school_id', user.schoolId)
        .maybeSingle()

      if (staffErr) throw new Error(staffErr.message)
      if (!staff)   throw new Error('Staff member not found')
      if ((staff as any).auth_user_id) throw new Error('Login is already activated for this staff member')
      if (!(staff as any).email) throw new Error('Staff member has no email address — update their profile first')

      const email       = (staff as any).email as string
      const name        = `${(staff as any).first_name} ${(staff as any).last_name}`
      const tempPassword = generateTempPassword()

      // Attempt Edge Function
      const { error: fnError } = await supabase.functions.invoke('activate-staff-login', {
        body: { staffId, email, tempPassword },
      })

      if (!fnError) {
        // Edge Function succeeded — auth user created
        return { email, tempPassword, manual: false }
      }

      // Edge Function not yet deployed — store credentials in localStorage
      // for the IT Admin to use manually in Supabase Dashboard
      setPendingActivation({ staffId, email, tempPassword, name, storedAt: new Date().toISOString() })
      return { email, tempPassword, manual: true }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}

// ── useLinkAuthUser ────────────────────────────────────────────────────────
// Manually links an existing Supabase auth user to a staff record.
// Used when IT Admin has created the account in the Supabase Dashboard
// and now needs to connect it to the staff row.
export function useLinkAuthUser() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, authUserId }: { staffId: string; authUserId: string }) => {
      if (!user) throw new Error('Not authenticated')

      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRe.test(authUserId.trim())) {
        throw new Error('Invalid UUID — copy it directly from Supabase Dashboard → Authentication → Users')
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
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}

// ── useResetStaffPassword ──────────────────────────────────────────────────
// Calls reset-staff-password Edge Function with a new random temp password.
// Falls back to localStorage storage if Edge Function not deployed.
export function useResetStaffPassword() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ authUserId, staffId, email, name }: {
      authUserId: string; staffId: string; email: string; name: string
    }): Promise<{ tempPassword: string; manual: boolean }> => {
      if (!user) throw new Error('Not authenticated')

      const tempPassword = generateTempPassword()

      const { error: fnError } = await supabase.functions.invoke('reset-staff-password', {
        body: { userId: authUserId, newPassword: tempPassword },
      })

      if (!fnError) return { tempPassword, manual: false }

      // Store in localStorage as fallback
      setPendingActivation({ staffId, email, tempPassword, name, storedAt: new Date().toISOString() })
      return { tempPassword, manual: true }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}
