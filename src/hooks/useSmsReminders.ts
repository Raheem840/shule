import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { SmsReminder, SmsChannel, FeeStatus } from '../types/app'
import { calcFeeStatus } from './useFeePayments'


// ── Student row for SMS preview table ─────────────────────────
export type SmsStudentRow = {
  studentId:       string
  firstName:       string
  lastName:        string
  admissionNumber: string
  classId:         string | null
  className:       string
  streamId:        string | null
  streamName:      string
  guardianName:    string
  guardianPhone:   string
  balance:         number
  amountDue:       number
  amountPaid:      number
  status:          FeeStatus
}

export type SmsFilters = {
  classId?:    string
  streamId?:   string
  balanceStatus: 'unpaid' | 'partial' | 'both' | 'all'
  minBalance:  number
  term:        number
  year:        number
}

const SMS_ROLES = ['bursar', 'principal'] as const
const isSmsRole = (role?: string) => SMS_ROLES.includes(role as typeof SMS_ROLES[number])

// ── useSmsStudents ────────────────────────────────────────────
// Returns active students with a contactable guardian and outstanding balance.
export function useSmsStudents(filters: SmsFilters) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['sms-students', user?.schoolId, filters],
    enabled:  !!user?.schoolId && isSmsRole(user?.role),
    queryFn: async () => {
      const [studentsRes, guardiansRes, paymentsRes, classesRes, streamsRes, activeYearsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, first_name, last_name, admission_number, class_id, stream_id')
          .eq('school_id', user!.schoolId)
          .eq('status', 'active'),
        supabase
          .from('student_guardians')
          .select('student_id, full_name, phone, do_not_contact, is_primary')
          .eq('school_id', user!.schoolId)
          .eq('do_not_contact', false),
        supabase
          .from('fee_payments')
          .select('student_id, amount_due, amount_paid, balance, academic_year_id')
          .eq('school_id', user!.schoolId)
          .eq('term', filters.term),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', user!.schoolId),
        supabase
          .from('streams')
          .select('id, name')
          .eq('school_id', user!.schoolId),
        supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', user!.schoolId)
          .eq('is_active', true),
      ])

      if (studentsRes.error)   throw studentsRes.error
      if (guardiansRes.error)  throw guardiansRes.error
      if (paymentsRes.error)   throw paymentsRes.error
      if (classesRes.error)    throw classesRes.error
      if (streamsRes.error)    throw streamsRes.error
      if (activeYearsRes.error) throw activeYearsRes.error

      // Limit to the active academic year to avoid cross-year fee data.
      // Throw when no active year exists so the page can show a specific reason
      // rather than an empty list that looks like "all fees paid".
      const activeYearIds = new Set((activeYearsRes.data ?? []).map((y: any) => y.id as string))
      if (activeYearIds.size === 0) throw new Error('No active academic year. Activate one in Principal → Academic Years before sending reminders.')

      // Build guardian map — prefer primary guardian
      const anyGuardian     = new Map<string, { name: string; phone: string }>()
      const primaryGuardian = new Map<string, { name: string; phone: string }>()
      for (const g of guardiansRes.data ?? []) {
        const sid = g.student_id as string
        if (!anyGuardian.has(sid)) {
          anyGuardian.set(sid, { name: g.full_name as string, phone: g.phone as string })
        }
        if (g.is_primary) {
          primaryGuardian.set(sid, { name: g.full_name as string, phone: g.phone as string })
        }
      }

      const classMap  = new Map<string, string>()
      for (const c of classesRes.data ?? []) classMap.set(c.id as string, c.name as string)
      const streamMap = new Map<string, string>()
      for (const s of streamsRes.data ?? []) streamMap.set(s.id as string, s.name as string)

      // Aggregate fee balances per student (active year only)
      const feeMap = new Map<string, { amountDue: number; amountPaid: number; balance: number }>()
      for (const p of paymentsRes.data ?? []) {
        // Skip payments not in the active academic year (always enforced — empty set → no payments)
        const pyid = (p as any).academic_year_id as string | null
        if (!pyid || !activeYearIds.has(pyid)) continue
        const sid  = p.student_id as string
        const curr = feeMap.get(sid) ?? { amountDue: 0, amountPaid: 0, balance: 0 }
        curr.amountDue  += Number(p.amount_due)  || 0
        curr.amountPaid += Number(p.amount_paid) || 0
        curr.balance    += Number(p.balance)     || 0
        feeMap.set(sid, curr)
      }

      let rows: SmsStudentRow[] = []
      for (const s of studentsRes.data ?? []) {
        const sid      = s.id as string
        // Students without a guardian phone cannot be contacted — skip
        const guardian = primaryGuardian.get(sid) ?? anyGuardian.get(sid)
        if (!guardian) continue

        // Students with no fee_payments row get zero amounts (they appear in "All Students")
        const fees = feeMap.get(sid) ?? { amountDue: 0, amountPaid: 0, balance: 0 }
        const status = calcFeeStatus(fees.amountPaid, fees.balance)

        rows.push({
          studentId:       sid,
          firstName:       s.first_name as string,
          lastName:        s.last_name as string,
          admissionNumber: s.admission_number as string,
          classId:         (s.class_id as string)  ?? null,
          className:       classMap.get((s.class_id as string)  ?? '') ?? '—',
          streamId:        (s.stream_id as string) ?? null,
          streamName:      streamMap.get((s.stream_id as string) ?? '') ?? '—',
          guardianName:    guardian.name,
          guardianPhone:   guardian.phone,
          balance:         fees.balance,
          amountDue:       fees.amountDue,
          amountPaid:      fees.amountPaid,
          status,
        })
      }

      // Apply filters
      if (filters.classId)  rows = rows.filter(r => r.classId === filters.classId)
      if (filters.streamId) rows = rows.filter(r => r.streamId === filters.streamId)

      if (filters.balanceStatus === 'unpaid')       rows = rows.filter(r => r.status === 'unpaid')
      else if (filters.balanceStatus === 'partial') rows = rows.filter(r => r.status === 'partial')
      else if (filters.balanceStatus === 'both')    rows = rows.filter(r => r.status !== 'paid')
      // 'all' — no balance filter: every student with a contactable guardian is shown

      if (filters.minBalance > 0) rows = rows.filter(r => r.balance >= filters.minBalance)

      return rows
    },
  })
}

// ── Delivery log row ───────────────────────────────────────────
export type ReminderLogRow = SmsReminder & {
  firstName: string
  lastName:  string
}

export function useSmsReminderLog() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['sms-log', user?.schoolId],
    enabled:  !!user?.schoolId && isSmsRole(user?.role),
    queryFn: async () => {
      const remindersRes = await supabase
        .from('sms_reminders')
        .select('id, school_id, student_id, parent_phone, channel, message, status, sent_at, created_at')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false })
        .limit(500)
      if (remindersRes.error) throw remindersRes.error

      const studentIds = [...new Set((remindersRes.data ?? []).map(r => r.student_id as string).filter(Boolean))]
      const studentsRes = studentIds.length
        ? await supabase.from('students').select('id, first_name, last_name').eq('school_id', user!.schoolId).in('id', studentIds)
        : { data: [], error: null }

      if (studentsRes.error) throw studentsRes.error

      const studentMap = new Map<string, { firstName: string; lastName: string }>()
      for (const s of studentsRes.data ?? []) {
        studentMap.set(s.id as string, {
          firstName: s.first_name as string,
          lastName:  s.last_name as string,
        })
      }

      return (remindersRes.data ?? []).map(r => {
        const stu = studentMap.get(r.student_id as string)
        return {
          id:            r.id as string,
          schoolId:      r.school_id as string,
          studentId:     r.student_id as string,
          guardianPhone: (r as any).parent_phone as string,
          channel:       r.channel as SmsChannel,
          message:       r.message as string,
          status:        r.status as SmsReminder['status'],
          sentAt:        (r.sent_at as string) ?? null,
          createdAt:     r.created_at as string,
          firstName:     stu?.firstName ?? '',
          lastName:      stu?.lastName ?? '',
        } satisfies ReminderLogRow
      })
    },
  })
}

// ── useSendReminders ──────────────────────────────────────────
// Writes to send_queue (offline buffer), then calls the send-sms edge function.
// The edge function owns sms_reminders inserts (with final status from AT).
export type SendReminderInput = {
  studentId:     string
  guardianPhone: string
  channel:       SmsChannel
  message:       string
}

export function useSendReminders() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (reminders: SendReminderInput[]) => {
      if (!user) throw new Error('Not authenticated')
      if (!isSmsRole(user.role)) throw new Error('Forbidden')
      if (reminders.length === 0) return 0

      // Offline buffer — edge fn updates these rows when it processes them
      const queueRows = reminders.map(r => ({
        school_id: user!.schoolId,
        type:      r.channel,
        payload:   { to: r.guardianPhone, message: r.message, student_id: r.studentId },
        status:    'pending',
      }))

      const { error: queueErr } = await supabase.from('send_queue').insert(queueRows)
      if (queueErr) throw queueErr

      // Call AT via edge function — non-fatal if AT key not yet configured.
      // The edge function inserts its own sms_reminders rows with final status.
      const recipients = reminders.map(r => ({
        phone:     r.guardianPhone,
        message:   r.message,
        studentId: r.studentId,
        channel:   r.channel,
      }))
      const { error: fnErr } = await supabase.functions.invoke('send-sms', {
        body: { recipients, schoolId: user!.schoolId },
      })
      if (fnErr) {
        // Edge fn error is non-fatal: send_queue row ensures eventual delivery
        console.warn('[useSendReminders] edge fn error:', fnErr)
      }

      return reminders.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms-log',   user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['sms-count', user?.schoolId] })
    },
  })
}

// ── useRetryReminder ──────────────────────────────────────────
export function useRetryReminder() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (reminderId: string) => {
      if (!user) throw new Error('Not authenticated')
      if (!isSmsRole(user.role)) throw new Error('Forbidden')
      const { error } = await supabase
        .from('sms_reminders')
        .update({ status: 'pending' })
        .eq('id', reminderId)
        .eq('school_id', user!.schoolId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms-log', user?.schoolId] })
    },
  })
}
