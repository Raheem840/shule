import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

// ── useRequestStaffPassword ────────────────────────────────────────────────
// Public flow — no session required. A staff member identifies themselves
// with email + staff_number and submits the password they want, whether
// they've never had an account (activation) or already have one (reset).
// Replaces the email-invite/reset-link model, which is blocked until the
// school owns a verified sending domain for SMTP.
export function useRequestStaffPassword() {
  return useMutation({
    mutationFn: async (input: { email: string; staffNumber: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke('request-staff-password', {
        body: input,
      })
      if (error) {
        const detail = (data as { error?: string } | null)?.error ?? error.message
        throw new Error(detail)
      }
      return data as { success: true; message: string }
    },
  })
}

// ── PendingPasswordRequest ─────────────────────────────────────────────────
export type PendingPasswordRequest = {
  id:           string
  staffId:      string
  kind:         'activation' | 'reset'
  status:       'pending' | 'approved' | 'rejected'
  requestedAt:  string
  staffName:    string
  staffNumber:  string
  staffRole:    string
}

// ── usePendingStaffPasswordRequests ────────────────────────────────────────
// IT admin / principal only — new_password is never selected here; the DB
// also enforces this with a column-level REVOKE, so even a `select('*')`
// mistake would fail loudly instead of leaking the plaintext password.
export function usePendingStaffPasswordRequests() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['staff-password-requests', user?.schoolId],
    enabled:  !!user?.schoolId && (user?.role === 'it_admin' || user?.role === 'principal'),
    queryFn: async (): Promise<PendingPasswordRequest[]> => {
      const { data: requests, error } = await supabase
        .from('staff_password_requests')
        .select('id, staff_id, kind, status, requested_at')
        .eq('school_id', user!.schoolId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })

      if (error) throw error
      if (!requests || requests.length === 0) return []

      const staffIds = requests.map((r: any) => r.staff_id as string)
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, first_name, last_name, staff_number, role')
        .eq('school_id', user!.schoolId)
        .in('id', staffIds)

      const staffMap = new Map((staffRows ?? []).map((s: any) => [s.id as string, s]))

      return requests.map((r: any) => {
        const staff = staffMap.get(r.staff_id as string)
        return {
          id:          r.id as string,
          staffId:     r.staff_id as string,
          kind:        r.kind as 'activation' | 'reset',
          status:      r.status as 'pending' | 'approved' | 'rejected',
          requestedAt: r.requested_at as string,
          staffName:   staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown staff',
          staffNumber: staff?.staff_number ?? '—',
          staffRole:   staff?.role ?? '—',
        }
      })
    },
  })
}

// ── useResolveStaffPasswordRequest ─────────────────────────────────────────
export function useResolveStaffPasswordRequest() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.functions.invoke('resolve-staff-password-request', {
        body: { requestId, action },
      })

      if (error) {
        const detail = (data as { error?: string } | null)?.error ?? error.message
        throw new Error(detail)
      }
      return data as { success: true; action: 'approved' | 'rejected' }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-password-requests', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
    },
  })
}
