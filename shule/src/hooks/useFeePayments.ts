import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { FeePayment, FeeStatus } from '../types/app'

type AnyRow = Record<string, unknown>

// ── UGX currency formatter ─────────────────────────────────────
// Use everywhere money appears in the Bursar module.
export const ugx = (amount: number) =>
  new Intl.NumberFormat('en-UG', {
    style:                 'currency',
    currency:              'UGX',
    minimumFractionDigits: 0,
  }).format(amount)

// ── Fee status from amounts ────────────────────────────────────
export function calcFeeStatus(amountPaid: number, balance: number): FeeStatus {
  if (balance <= 0) return 'paid'
  if (amountPaid > 0) return 'partial'
  return 'unpaid'
}

// ── Bursar dashboard KPIs ──────────────────────────────────────
// Reads fee_summary_for_principal view (set up in Supabase).
// Assumed columns: expected, collected, outstanding, unpaid_count.
export type BursarKpis = {
  expected:    number
  collected:   number
  outstanding: number
  unpaidCount: number
}

export function useBursarKpis(term: number, year: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['bursar-kpis', user?.schoolId, term, year],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_summary_for_principal')
        .select('total_expected, total_collected, total_outstanding, fully_unpaid_count')
        .eq('school_id', user!.schoolId)
        .eq('term', term)
        .eq('year', year)
        .maybeSingle()

      if (error) throw error
      if (!data) return { expected: 0, collected: 0, outstanding: 0, unpaidCount: 0 }

      const r = data as AnyRow
      return {
        expected:    Number(r.total_expected)     || 0,
        collected:   Number(r.total_collected)    || 0,
        outstanding: Number(r.total_outstanding)  || 0,
        unpaidCount: Number(r.fully_unpaid_count) || 0,
      } satisfies BursarKpis
    },
  })
}

// ── SMS reminders count ────────────────────────────────────────
export function useSmsCount() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['sms-count', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('sms_reminders')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return count ?? 0
    },
  })
}

// ── Fee collection by class (bar chart data) ───────────────────
export type ClassFeeData = {
  className:   string
  collected:   number
  outstanding: number
}

export function useFeeCollectionByClass(term: number, year: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['fee-by-class', user?.schoolId, term, year],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const [paymentsRes, studentsRes, classesRes] = await Promise.all([
        supabase
          .from('fee_payments')
          .select('student_id, amount_paid, balance')
          .eq('school_id', user!.schoolId)
          .eq('term', term)
          .eq('year', year),
        supabase
          .from('students')
          .select('id, class_id')
          .eq('school_id', user!.schoolId),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', user!.schoolId)
          .order('name', { ascending: true }),
      ])

      if (paymentsRes.error) throw paymentsRes.error
      if (studentsRes.error) throw studentsRes.error
      if (classesRes.error)  throw classesRes.error

      const studentClass = new Map<string, string>()
      for (const s of studentsRes.data ?? []) {
        if (s.class_id) studentClass.set(s.id as string, s.class_id as string)
      }

      const classNames = new Map<string, string>()
      for (const c of classesRes.data ?? []) classNames.set(c.id as string, c.name as string)

      const byClass = new Map<string, { collected: number; outstanding: number }>()
      for (const p of paymentsRes.data ?? []) {
        const cid  = studentClass.get(p.student_id as string)
        if (!cid) continue
        const curr = byClass.get(cid) ?? { collected: 0, outstanding: 0 }
        curr.collected   += Number(p.amount_paid) || 0
        curr.outstanding += Math.max(0, Number(p.balance) || 0)
        byClass.set(cid, curr)
      }

      return Array.from(byClass.entries()).map(([cid, vals]) => ({
        className:   classNames.get(cid) ?? cid,
        collected:   vals.collected,
        outstanding: vals.outstanding,
      } satisfies ClassFeeData))
    },
  })
}

// ── Recent payments (dashboard table) ─────────────────────────
export type RecentPayment = {
  id:            string
  firstName:     string
  lastName:      string
  className:     string
  amountPaid:    number
  paymentDate:   string | null
  receiptNumber: string | null
}

export function useRecentPayments(limit = 10) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['recent-payments', user?.schoolId, limit],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const [paymentsRes, studentsRes, classesRes] = await Promise.all([
        supabase
          .from('fee_payments')
          .select('id, student_id, amount_paid, payment_date, receipt_number')
          .eq('school_id', user!.schoolId)
          .order('payment_date', { ascending: false })
          .limit(limit),
        supabase
          .from('students')
          .select('id, first_name, last_name, class_id')
          .eq('school_id', user!.schoolId),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', user!.schoolId),
      ])

      if (paymentsRes.error) throw paymentsRes.error
      if (studentsRes.error) throw studentsRes.error
      if (classesRes.error)  throw classesRes.error

      const studentMap = new Map<string, { firstName: string; lastName: string; classId: string | null }>()
      for (const s of studentsRes.data ?? []) {
        studentMap.set(s.id as string, {
          firstName: s.first_name as string,
          lastName:  s.last_name as string,
          classId:   (s.class_id as string) ?? null,
        })
      }
      const classMap = new Map<string, string>()
      for (const c of classesRes.data ?? []) classMap.set(c.id as string, c.name as string)

      return (paymentsRes.data ?? []).map(r => {
        const s = studentMap.get(r.student_id as string)
        return {
          id:            r.id as string,
          firstName:     s?.firstName ?? '',
          lastName:      s?.lastName ?? '',
          className:     classMap.get(s?.classId ?? '') ?? '—',
          amountPaid:    Number(r.amount_paid) || 0,
          paymentDate:   (r.payment_date as string) ?? null,
          receiptNumber: (r.receipt_number as string) ?? null,
        } satisfies RecentPayment
      })
    },
  })
}

// ── Fee ledger (full list with filters) ───────────────────────
export type LedgerRow = FeePayment & {
  admissionNumber: string
  firstName:       string
  lastName:        string
  className:       string
  streamName:      string
  status:          FeeStatus
}

export type FeeFilters = {
  classId?:  string
  streamId?: string
  term?:     number
  year?:     number
  status?:   FeeStatus
  search?:   string
}

export function useFeePayments(filters: FeeFilters = {}) {
  const { user } = useAuth()
  const term = filters.term ?? 1
  const year = filters.year ?? new Date().getFullYear()

  return useQuery({
    queryKey: ['fee-payments', user?.schoolId, filters],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const [paymentsRes, studentsRes, classesRes, streamsRes] = await Promise.all([
        supabase
          .from('fee_payments')
          .select('id, school_id, student_id, fee_type_id, amount_due, amount_paid, balance, payment_date, receipt_number, term, year, notes, imported')
          .eq('school_id', user!.schoolId)
          .eq('term', term)
          .eq('year', year)
          .order('payment_date', { ascending: false }),
        supabase
          .from('students')
          .select('id, admission_number, first_name, last_name, class_id, stream_id')
          .eq('school_id', user!.schoolId),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', user!.schoolId),
        supabase
          .from('streams')
          .select('id, name')
          .eq('school_id', user!.schoolId),
      ])

      if (paymentsRes.error) throw paymentsRes.error
      if (studentsRes.error) throw studentsRes.error
      if (classesRes.error)  throw classesRes.error
      if (streamsRes.error)  throw streamsRes.error

      type StudentInfo = {
        admissionNumber: string
        firstName:  string
        lastName:   string
        classId:    string | null
        streamId:   string | null
      }
      const studentMap = new Map<string, StudentInfo>()
      for (const s of studentsRes.data ?? []) {
        studentMap.set(s.id as string, {
          admissionNumber: s.admission_number as string,
          firstName:  s.first_name as string,
          lastName:   s.last_name as string,
          classId:    (s.class_id as string)  ?? null,
          streamId:   (s.stream_id as string) ?? null,
        })
      }
      const classMap  = new Map<string, string>()
      for (const c of classesRes.data ?? []) classMap.set(c.id as string, c.name as string)
      const streamMap = new Map<string, string>()
      for (const s of streamsRes.data ?? []) streamMap.set(s.id as string, s.name as string)

      let rows: LedgerRow[] = (paymentsRes.data ?? []).map(r => {
        const stu       = studentMap.get(r.student_id as string)
        const amtPaid   = Number(r.amount_paid) || 0
        const amtDue    = Number(r.amount_due)  || 0
        const balance   = Number(r.balance) ?? (amtDue - amtPaid)
        return {
          id:             r.id as string,
          schoolId:       r.school_id as string,
          studentId:      r.student_id as string,
          feeTypeId:      (r.fee_type_id as string) ?? null,
          amountDue:      amtDue,
          amountPaid:     amtPaid,
          balance,
          paymentDate:    (r.payment_date as string)   ?? null,
          receiptNumber:  (r.receipt_number as string) ?? null,
          term:           Number(r.term) || 1,
          year:           Number(r.year) || year,
          notes:          (r.notes as string) ?? null,
          imported:       (r.imported as boolean) ?? false,
          admissionNumber: stu?.admissionNumber ?? '—',
          firstName:      stu?.firstName ?? '',
          lastName:       stu?.lastName  ?? '',
          className:      classMap.get(stu?.classId  ?? '') ?? '—',
          streamName:     streamMap.get(stu?.streamId ?? '') ?? '—',
          status:         calcFeeStatus(amtPaid, balance),
        }
      })

      // Client-side filters for class/stream/status/search
      if (filters.classId) {
        const ok = new Set(
          [...studentMap.entries()]
            .filter(([, s]) => s.classId === filters.classId)
            .map(([id]) => id)
        )
        rows = rows.filter(r => ok.has(r.studentId))
      }
      if (filters.streamId) {
        const ok = new Set(
          [...studentMap.entries()]
            .filter(([, s]) => s.streamId === filters.streamId)
            .map(([id]) => id)
        )
        rows = rows.filter(r => ok.has(r.studentId))
      }
      if (filters.status) rows = rows.filter(r => r.status === filters.status)
      if (filters.search) {
        const q = filters.search.toLowerCase()
        rows = rows.filter(r =>
          r.firstName.toLowerCase().includes(q) ||
          r.lastName.toLowerCase().includes(q)  ||
          r.admissionNumber.toLowerCase().includes(q)
        )
      }

      return rows
    },
  })
}

// ── useAddPayment ─────────────────────────────────────────────
export type AddPaymentInput = {
  studentId:     string
  feeTypeId:     string | null
  amountDue:     number
  amountPaid:    number
  paymentDate:   string
  receiptNumber: string | null
  notes:         string | null
  term:          number
  year:          number
}

export function useAddPayment() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: AddPaymentInput) => {
      const balance = input.amountDue - input.amountPaid
      const { data, error } = await supabase
        .from('fee_payments')
        .insert({
          school_id:      user!.schoolId,
          student_id:     input.studentId,
          fee_type_id:    input.feeTypeId,
          amount_due:     input.amountDue,
          amount_paid:    input.amountPaid,
          balance,
          payment_date:   input.paymentDate || null,
          receipt_number: input.receiptNumber || null,
          notes:          input.notes || null,
          term:           input.term,
          year:           input.year,
          imported:       false,
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-payments',    user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['bursar-kpis',     user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['fee-by-class',    user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['recent-payments', user?.schoolId] })
    },
  })
}

// ── useUpdatePayment ──────────────────────────────────────────
// Used for inline cell editing in the ledger. Writes audit_log.
export type UpdatePaymentInput = {
  id:            string
  amountDue:     number
  amountPaid:    number
  oldAmountPaid: number
}

export function useUpdatePayment() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdatePaymentInput) => {
      const newBalance = input.amountDue - input.amountPaid
      const oldBalance = input.amountDue - input.oldAmountPaid

      const { error: updErr } = await supabase
        .from('fee_payments')
        .update({ amount_paid: input.amountPaid, balance: newBalance })
        .eq('id', input.id)
        .eq('school_id', user!.schoolId)

      if (updErr) throw updErr

      // Write audit trail — non-fatal if audit_log table schema differs
      await supabase
        .from('audit_log')
        .insert({
          school_id:  user!.schoolId,
          table_name: 'fee_payments',
          record_id:  input.id,
          action:     'UPDATE',
          old_value:  { amount_paid: input.oldAmountPaid, balance: oldBalance },
          new_value:  { amount_paid: input.amountPaid,    balance: newBalance },
          user_id:    user!.id,
          role:       user!.role,
        })
      // Intentionally not throwing on audit error — payment is already saved.
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-payments',    user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['bursar-kpis',     user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['fee-by-class',    user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['recent-payments', user?.schoolId] })
    },
  })
}
