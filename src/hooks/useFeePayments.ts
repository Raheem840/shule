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

const FIN_ROLES = ['bursar', 'principal'] as const
const isFinanceRole = (role?: string) => FIN_ROLES.includes(role as typeof FIN_ROLES[number])

export function useBursarKpis(term: number, academicYearId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['bursar-kpis', user?.schoolId, term, academicYearId],
    enabled:  !!user?.schoolId && isFinanceRole(user?.role),
    queryFn: async () => {
      let q = supabase
        .from('fee_payments')
        .select('student_id, amount_due, amount_paid')
        .eq('school_id', user!.schoolId)
        .eq('term', term)

      if (academicYearId) {
        q = q.eq('academic_year_id', academicYearId)
      }

      const { data, error } = await q

      if (error) throw error

      const rows = (data ?? []) as AnyRow[]
      let expected = 0, collected = 0, outstanding = 0
      const unpaidByStudent = new Map<string, boolean>()
      for (const r of rows) {
        const due  = Number(r.amount_due)  || 0
        const paid = Number(r.amount_paid) || 0
        const bal  = Math.max(0, due - paid)
        expected    += due
        collected   += paid
        outstanding += bal
        const sid = r.student_id as string
        const prev = unpaidByStudent.get(sid)
        const fullyUnpaid = paid <= 0 && due > 0
        unpaidByStudent.set(sid, prev === undefined ? fullyUnpaid : (prev && fullyUnpaid))
      }
      let unpaidCount = 0
      for (const v of unpaidByStudent.values()) if (v) unpaidCount++

      return { expected, collected, outstanding, unpaidCount } satisfies BursarKpis
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

export function useFeeCollectionByClass(term: number, academicYearId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['fee-by-class', user?.schoolId, term, academicYearId],
    enabled:  !!user?.schoolId && isFinanceRole(user?.role),
    queryFn: async () => {
      let feeQ = supabase
        .from('fee_payments')
        .select('student_id, amount_paid, balance')
        .eq('school_id', user!.schoolId)
        .eq('term', term)
      if (academicYearId) feeQ = feeQ.eq('academic_year_id', academicYearId)

      const [paymentsRes, studentsRes, classesRes] = await Promise.all([
        feeQ,
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
    enabled:  !!user?.schoolId && isFinanceRole(user?.role),
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

// ── Fee collection over time — monthly by class ───────────────
export type MonthlyClassPoint = {
  month:   string   // e.g. "Jan 26"
  [cls: string]: number | string
}

export function useFeeCollectionOverTime(term: number, academicYearId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['fee-over-time', user?.schoolId, term, academicYearId],
    enabled:  !!user?.schoolId && isFinanceRole(user?.role),
    staleTime: 60_000,
    queryFn: async () => {
      let payQ = supabase
        .from('fee_payments')
        .select('student_id, amount_paid, payment_date')
        .eq('school_id', user!.schoolId)
        .eq('term', term)
        .not('payment_date', 'is', null)
        .order('payment_date', { ascending: true })
      if (academicYearId) payQ = payQ.eq('academic_year_id', academicYearId)

      const [paymentsRes, studentsRes, classesRes] = await Promise.all([
        payQ,
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
      const allClasses: string[] = []
      for (const c of classesRes.data ?? []) {
        classNames.set(c.id as string, c.name as string)
        allClasses.push(c.name as string)
      }

      // Bucket: monthKey → classId → amount
      const bucket = new Map<string, Map<string, number>>()

      for (const p of paymentsRes.data ?? []) {
        const cid = studentClass.get(p.student_id as string)
        if (!cid) continue
        const date = new Date(p.payment_date as string)
        if (isNaN(date.getTime())) continue
        const monthKey = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        if (!bucket.has(monthKey)) bucket.set(monthKey, new Map())
        const m = bucket.get(monthKey)!
        m.set(cid, (m.get(cid) ?? 0) + (Number(p.amount_paid) || 0))
      }

      // Build sorted month series
      const points: MonthlyClassPoint[] = Array.from(bucket.entries()).map(([month, classMap]) => {
        const point: MonthlyClassPoint = { month }
        for (const [cid, amount] of classMap.entries()) {
          const name = classNames.get(cid) ?? cid
          point[name] = amount
        }
        // Zero-fill missing classes
        for (const name of allClasses) {
          if (!(name in point)) point[name] = 0
        }
        return point
      })

      return { points, classes: allClasses }
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
    enabled:  !!user?.schoolId && isFinanceRole(user?.role),
    queryFn: async () => {
      // Resolve active academic year to scope data (fee_payments has no 'year' int column)
      const { data: activeYearData } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .maybeSingle()

      let feeQ = supabase
        .from('fee_payments')
        .select('id, school_id, student_id, fee_structure_id, academic_year_id, amount_due, amount_paid, balance, payment_date, receipt_number, term, notes, imported, created_by')
        .eq('school_id', user!.schoolId)
        .eq('term', term)
        .order('payment_date', { ascending: false })
      if (activeYearData?.id) feeQ = feeQ.eq('academic_year_id', activeYearData.id)

      const [paymentsRes, studentsRes, classesRes, streamsRes] = await Promise.all([
        feeQ,
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
        const balance   = r.balance != null ? Number(r.balance) : (amtDue - amtPaid)
        return {
          id:             r.id as string,
          schoolId:       r.school_id as string,
          studentId:      r.student_id as string,
          feeStructureId:  (r.fee_structure_id as string) ?? null,
          academicYearId:  (r.academic_year_id as string) ?? null,
          createdBy:       (r.created_by as string) ?? null,
          amountDue:      amtDue,
          amountPaid:     amtPaid,
          balance,
          paymentDate:    (r.payment_date as string)   ?? null,
          receiptNumber:  (r.receipt_number as string) ?? null,
          term:           Number(r.term) || 1,
          year:           year,
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
  studentId:      string
  feeStructureId: string | null
  academicYearId: string | null
  amountDue:      number
  amountPaid:     number
  paymentDate:    string
  receiptNumber:  string | null
  notes:          string | null
  term:           number
}

export function useAddPayment() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: AddPaymentInput) => {
      if (!isFinanceRole(user?.role)) throw new Error('Forbidden')
      const { data, error } = await supabase
        .from('fee_payments')
        .insert({
          school_id:        user!.schoolId,
          student_id:       input.studentId,
          fee_structure_id: input.feeStructureId,
          academic_year_id: input.academicYearId,
          amount_due:       input.amountDue,
          amount_paid:      input.amountPaid,
          balance:          Math.max(0, input.amountDue - input.amountPaid),
          payment_date:     input.paymentDate || null,
          receipt_number:   input.receiptNumber || null,
          notes:            input.notes || null,
          term:             input.term,
          imported:         false,
          created_by:       user!.staffId ?? null,
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
      qc.invalidateQueries({ queryKey: ['fee-over-time',   user?.schoolId] })
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
      if (!isFinanceRole(user?.role)) throw new Error('Forbidden')
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
      qc.invalidateQueries({ queryKey: ['fee-over-time',   user?.schoolId] })
    },
  })
}

// ── useStudentFeeRows ─────────────────────────────────────────
// Loads ALL fee_payments rows for a specific student + term.
// Used by AddPaymentPage to show existing charges and allow the
// bursar to pick which row to apply a payment to.
export type StudentFeeRow = {
  id:             string
  feeStructureId: string | null
  feeName:        string          // resolved from fee_structure.name or placeholder
  amountDue:      number
  amountPaid:     number
  balance:        number
  term:           number
  paymentDate:    string | null
  receiptNumber:  string | null
  notes:          string | null
  academicYearId: string | null
}

export function useStudentFeeRows(studentId: string | null, term: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-fee-rows', user?.schoolId, studentId, term],
    enabled:  !!user?.schoolId && !!studentId && isFinanceRole(user?.role),
    queryFn: async () => {
      const [paymentsRes, feeStructureRes] = await Promise.all([
        supabase
          .from('fee_payments')
          .select('id, fee_structure_id, amount_due, amount_paid, balance, term, payment_date, receipt_number, notes, academic_year_id')
          .eq('school_id', user!.schoolId)
          .eq('student_id', studentId!)
          .eq('term', term)
          .order('payment_date', { ascending: false }),
        supabase
          .from('fee_structure')
          .select('id, name')
          .eq('school_id', user!.schoolId),
      ])

      if (paymentsRes.error) throw paymentsRes.error

      const feeNames = new Map<string, string>()
      for (const f of feeStructureRes.data ?? []) {
        feeNames.set(f.id as string, f.name as string)
      }

      return (paymentsRes.data ?? []).map(r => {
        const due  = Number(r.amount_due)  || 0
        const paid = Number(r.amount_paid) || 0
        const bal  = Number(r.balance) ?? (due - paid)
        const fsId = (r.fee_structure_id as string) ?? null
        return {
          id:             r.id as string,
          feeStructureId: fsId,
          feeName:        fsId ? (feeNames.get(fsId) ?? 'Fee Item') : 'Manual Entry',
          amountDue:      due,
          amountPaid:     paid,
          balance:        Math.max(0, bal),
          term:           Number(r.term) || term,
          paymentDate:    (r.payment_date as string)   ?? null,
          receiptNumber:  (r.receipt_number as string) ?? null,
          notes:          (r.notes as string)          ?? null,
          academicYearId: (r.academic_year_id as string) ?? null,
        } satisfies StudentFeeRow
      })
    },
  })
}

// ── useApplyPayment ───────────────────────────────────────────
// Updates amount_paid + balance + receipt_number + payment_date on an existing row.
export type ApplyPaymentInput = {
  id:            string
  amountDue:     number
  amountPaid:    number
  paymentDate:   string
  receiptNumber: string | null
  notes:         string | null
}

export function useApplyPayment() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: ApplyPaymentInput) => {
      if (!isFinanceRole(user?.role)) throw new Error('Forbidden')
      const { error } = await supabase
        .from('fee_payments')
        .update({
          amount_paid:    input.amountPaid,
          balance:        Math.max(0, input.amountDue - input.amountPaid),
          payment_date:   input.paymentDate || null,
          receipt_number: input.receiptNumber || null,
          notes:          input.notes || null,
        })
        .eq('id', input.id)
        .eq('school_id', user!.schoolId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-fee-rows', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['fee-payments',    user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['bursar-kpis',     user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['fee-by-class',    user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['recent-payments', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['bursar-student-fees', user?.schoolId] })
    },
  })
}
