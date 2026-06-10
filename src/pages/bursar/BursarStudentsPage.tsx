/**
 * BursarStudentsPage — Premium student fee-tracking view for the Bursar role.
 * Features: hero KPI band, filter bar, virtualized student cards,
 *           quick payment modal, payment history modal, Excel export.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Modal, ModalCancelButton } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useAcademicYears } from '../../hooks/useFeeStructure'
import { ugx } from '../../hooks/useFeePayments'
import ExcelJS from 'exceljs'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type FeeStatusEx = 'paid' | 'above60' | 'partial' | 'unpaid' | 'no_fees'

interface StudentFeeRow {
  id:              string
  admissionNumber: string
  firstName:       string
  lastName:        string
  gender:          string
  studentType:     'day' | 'boarder'
  classId:         string
  streamId:        string | null
  className:       string
  streamName:      string | null
  amountDue:       number
  amountPaid:      number
  balance:         number
  pct:             number
  status:          FeeStatusEx
  paymentRows:     PaymentDetailRow[]
}

interface PaymentDetailRow {
  id:              string
  feeStructureId:  string | null
  amountDue:       number
  amountPaid:      number
  balance:         number
  term:            number | null
  paymentDate:     string | null
  receiptNumber:   string | null
  notes:           string | null
  feeName?:        string
}

interface FeeStructureItem {
  id:       string
  name:     string
  amount:   number
  appliesTo: string
  term:     number
}

// ─────────────────────────────────────────────────────────────
// Data hooks
// ─────────────────────────────────────────────────────────────

function useBursarStudentFees(
  classId:        string | null,
  streamId:       string | null,
  term:           number,
  academicYearId: string | null,
) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['bursar-student-fees', user?.schoolId, classId, streamId, term, academicYearId],
    enabled:  !!user && !!classId,
    staleTime: 30_000,
    queryFn: async (): Promise<StudentFeeRow[]> => {
      // 1. Fetch students in class / stream
      type RawStudent = {
        id: string; admission_number: string; first_name: string; last_name: string
        gender: string; student_type: string | null; class_id: string; stream_id: string | null
        classes: { name: string } | null; streams: { name: string } | null
      }
      let q = supabase
        .from('students')
        .select('id, admission_number, first_name, last_name, gender, student_type, class_id, stream_id, classes(name), streams(name)')
        .eq('school_id', user!.schoolId)
        .eq('status', 'active')
      if (classId)  q = q.eq('class_id',  classId)
      if (streamId) q = q.eq('stream_id', streamId)
      const { data: students, error: stuErr } = await q.order('last_name')
      if (stuErr) throw stuErr

      const safeStudents = (students ?? []) as unknown as RawStudent[]
      const studentIds   = safeStudents.map(s => s.id)
      if (studentIds.length === 0) return []

      // 2. Fetch fee_payments for this term / academic year
      type RawPayment = {
        id: string; student_id: string; fee_structure_id: string | null
        amount_due: number; amount_paid: number; balance: number; term: number | null
        payment_date: string | null; receipt_number: string | null; notes: string | null
      }
      let payQ = supabase
        .from('fee_payments')
        .select('id, student_id, fee_structure_id, amount_due, amount_paid, balance, term, payment_date, receipt_number, notes')
        .eq('school_id', user!.schoolId)
        .eq('term', term)
        .in('student_id', studentIds)
      if (academicYearId) payQ = payQ.eq('academic_year_id', academicYearId)
      const { data: payments, error: payErr } = await payQ
      if (payErr) throw payErr

      // 3. Fetch fee structures so students with no payment rows show as "Unpaid"
      type RawFS = { id: string; name: string; amount: number; applies_to: string; class_id: string | null }
      let fsQ = supabase
        .from('fee_structure')
        .select('id, name, amount, applies_to, class_id')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .eq('term', term)
      if (academicYearId) fsQ = fsQ.eq('academic_year_id', academicYearId)
      const { data: feeStructures } = await fsQ
      const safeFS = (feeStructures ?? []) as unknown as RawFS[]

      // 4. Aggregate payments per student
      const payMap = new Map<string, { due: number; paid: number; bal: number; rows: PaymentDetailRow[] }>()
      for (const p of (payments ?? []) as unknown as RawPayment[]) {
        const sid  = p.student_id
        const curr = payMap.get(sid) ?? { due: 0, paid: 0, bal: 0, rows: [] }
        curr.due  += Number(p.amount_due)   || 0
        curr.paid += Number(p.amount_paid)  || 0
        curr.bal  += Number(p.balance)      || 0
        curr.rows.push({
          id:             p.id,
          feeStructureId: p.fee_structure_id,
          amountDue:      Number(p.amount_due)  || 0,
          amountPaid:     Number(p.amount_paid) || 0,
          balance:        Number(p.balance)     || 0,
          term:           p.term ?? null,
          paymentDate:    p.payment_date,
          receiptNumber:  p.receipt_number,
          notes:          p.notes,
        })
        payMap.set(sid, curr)
      }

      return safeStudents.map(s => {
        const fees = payMap.get(s.id)

        // If no payment rows exist, compute expected fee from structures → show as Unpaid
        if (!fees) {
          const studentType = s.student_type === 'boarder' ? 'boarder' : 'day'
          const applicable  = safeFS.filter(fs =>
            (fs.class_id === null || fs.class_id === s.class_id) &&
            (fs.applies_to === 'all' ||
             (fs.applies_to === 'day_scholars' && studentType === 'day') ||
             (fs.applies_to === 'boarders'     && studentType === 'boarder'))
          )
          const expectedDue = applicable.reduce((sum, fs) => sum + (Number(fs.amount) || 0), 0)
          return {
            id:              s.id,
            admissionNumber: s.admission_number,
            firstName:       s.first_name,
            lastName:        s.last_name,
            gender:          s.gender,
            studentType:     studentType as 'day' | 'boarder',
            classId:         s.class_id,
            streamId:        s.stream_id,
            className:       s.classes?.name ?? '',
            streamName:      s.streams?.name ?? null,
            amountDue:       expectedDue,
            amountPaid:      0,
            balance:         expectedDue,
            pct:             0,
            status:          expectedDue > 0 ? 'unpaid' : 'no_fees',
            paymentRows:     [],
          } satisfies StudentFeeRow
        }

        const pct    = fees.due > 0 ? Math.round((fees.paid / fees.due) * 100) : 0
        const status: FeeStatusEx =
          fees.due === 0    ? 'no_fees'
          : fees.bal <= 0   ? 'paid'
          : fees.paid > 0 && pct >= 60 ? 'above60'
          : fees.paid > 0   ? 'partial'
          :                   'unpaid'
        return {
          id:              s.id,
          admissionNumber: s.admission_number,
          firstName:       s.first_name,
          lastName:        s.last_name,
          gender:          s.gender,
          studentType:     (s.student_type === 'boarder' ? 'boarder' : 'day') as 'day' | 'boarder',
          classId:         s.class_id,
          streamId:        s.stream_id,
          className:       s.classes?.name ?? '',
          streamName:      s.streams?.name ?? null,
          amountDue:       fees.due,
          amountPaid:      fees.paid,
          balance:         fees.bal,
          pct,
          status,
          paymentRows:     fees.rows,
        } satisfies StudentFeeRow
      })
    },
  })
}

function useFeeStructures(term: number, academicYearId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['fee-structure-list', user?.schoolId, term, academicYearId],
    enabled:  !!user?.schoolId,
    staleTime: 60_000,
    queryFn: async (): Promise<FeeStructureItem[]> => {
      type RawFS = { id: string; name: string; amount: number; applies_to: string; term: number }
      let q = supabase
        .from('fee_structure')
        .select('id, name, amount, applies_to, term')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .order('name')
      if (academicYearId) q = q.eq('academic_year_id', academicYearId)
      const { data, error } = await q
      if (error) throw error
      return ((data ?? []) as unknown as RawFS[]).map(r => ({
        id:        r.id,
        name:      r.name,
        amount:    Number(r.amount) || 0,
        appliesTo: r.applies_to,
        term:      Number(r.term)  || term,
      }))
    },
  })
}

function useSchoolProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['school-profile', user?.schoolId],
    enabled:  !!user?.schoolId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('school_profile')
        .select('school_name, short_name')
        .eq('id', user!.schoolId)
        .maybeSingle()
      return (data as { school_name: string; short_name: string } | null)
    },
  })
}

function useRecordPayment() {
  const { user } = useAuth()
  const qc       = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      studentId:       string
      feeStructureId:  string | null
      academicYearId:  string | null
      term:            number
      amountDue:       number
      amountPaid:      number
      paymentDate:     string
      receiptNumber:   string | null
      notes:           string | null
    }) => {
      // Check for existing record this student/term/academic_year
      let existQ = supabase
        .from('fee_payments')
        .select('id, amount_paid, amount_due')
        .eq('school_id', user!.schoolId)
        .eq('student_id', input.studentId)
        .eq('term', input.term)
      if (input.academicYearId) existQ = existQ.eq('academic_year_id', input.academicYearId)
      const { data: existing } = await existQ.maybeSingle()

      if (existing) {
        type Ex = { id: string; amount_paid: number; amount_due: number }
        const ex      = existing as unknown as Ex
        const newPaid = Number(ex.amount_paid) + input.amountPaid
        const { error } = await supabase.from('fee_payments')
          .update({
            amount_paid:    newPaid,
            payment_date:   input.paymentDate,
            receipt_number: input.receiptNumber,
            notes:          input.notes,
          })
          .eq('id', ex.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fee_payments').insert({
          school_id:        user!.schoolId,
          student_id:       input.studentId,
          fee_structure_id: input.feeStructureId,
          academic_year_id: input.academicYearId,
          term:             input.term,
          amount_due:       input.amountDue,
          amount_paid:      input.amountPaid,
          payment_date:     input.paymentDate,
          receipt_number:   input.receiptNumber,
          notes:            input.notes,
          imported:         false,
          created_by:       user!.staffId ?? null,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bursar-student-fees'] })
      void qc.invalidateQueries({ queryKey: ['fee-payments-bursar'] })
      void qc.invalidateQueries({ queryKey: ['bursar-kpis'] })
    },
  })
}

function useUpdatePaymentAmount() {
  const { user } = useAuth()
  const qc       = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id:        string
      amountDue: number
      newPaid:   number
    }) => {
      const { error } = await supabase.from('fee_payments')
        .update({ amount_paid: input.newPaid })
        .eq('id', input.id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bursar-student-fees'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function nameHash(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i)
  return Math.abs(h)
}

const AVATAR_COLORS = [
  ['#0d9488', '#f0fdfa'],
  ['#8b5cf6', '#f5f3ff'],
  ['#0ea5e9', '#f0f9ff'],
  ['#f59e0b', '#fffbeb'],
  ['#f43f5e', '#fff1f2'],
  ['#10b981', '#ecfdf5'],
]

function avatarColor(name: string): [string, string] {
  return AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length] as [string, string]
}

const STATUS_CONFIG: Record<FeeStatusEx, { label: string; color: string; stripe: string; glow: string }> = {
  paid:    { label: 'Paid',     color: 'var(--success)', stripe: '#10b981', glow: 'rgba(16,185,129,.25)' },
  above60: { label: '60%+',    color: 'var(--warning)', stripe: '#f59e0b', glow: 'rgba(245,158,11,.25)' },
  partial: { label: 'Partial',  color: 'var(--info)',    stripe: '#0ea5e9', glow: 'rgba(14,165,233,.25)' },
  unpaid:  { label: 'Unpaid',  color: 'var(--danger)',  stripe: '#f43f5e', glow: 'rgba(244,63,94,.25)'  },
  no_fees: { label: 'No Fees', color: 'var(--txt3)',    stripe: '#94a3b8', glow: 'rgba(148,163,184,.2)' },
}

const PROGRESS_COLOR: Record<FeeStatusEx, string> = {
  paid:    'linear-gradient(90deg,#10b981,#34d399)',
  above60: 'linear-gradient(90deg,#f59e0b,#fcd34d)',
  partial: 'linear-gradient(90deg,#0ea5e9,#38bdf8)',
  unpaid:  'linear-gradient(90deg,#f43f5e,#fb7185)',
  no_fees: 'var(--border)',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.85rem',
  border: '1.5px solid var(--border)', borderRadius: 10,
  background: 'var(--surface)', color: 'var(--txt)',
  fontSize: 13, fontFamily: 'var(--font1)', outline: 'none',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--txt2)', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: 0.5,
  fontFamily: 'var(--font2)',
}

// ─────────────────────────────────────────────────────────────
// Quick Payment Modal
// ─────────────────────────────────────────────────────────────

function QuickPaymentModal({
  student, term, academicYearId, feeStructures, onClose,
}: {
  student:        StudentFeeRow
  term:           number
  academicYearId: string | null
  feeStructures:  FeeStructureItem[]
  onClose:        () => void
}) {
  const toast  = useToast()
  const record = useRecordPayment()
  const today  = new Date().toISOString().split('T')[0]

  const [amountPaid,     setAmountPaid]     = useState('')
  const [paymentDate,    setPaymentDate]    = useState(today)
  const [receiptNumber,  setReceiptNumber]  = useState('')
  const [notes,          setNotes]          = useState('')
  const [feeStructureId, setFeeStructureId] = useState<string>(feeStructures[0]?.id ?? '')
  const [amountDue,      setAmountDue]      = useState(
    feeStructures[0] ? String(feeStructures[0].amount) : String(student.amountDue || 0)
  )

  const paid    = parseFloat(amountPaid) || 0
  const due     = parseFloat(amountDue)  || 0
  const balance = Math.max(0, due - paid)
  const isValid = paid > 0 && !!paymentDate

  function onFeeStructureChange(id: string) {
    setFeeStructureId(id)
    const fs = feeStructures.find(f => f.id === id)
    if (fs) setAmountDue(String(fs.amount))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    try {
      await record.mutateAsync({
        studentId:      student.id,
        feeStructureId: feeStructureId || null,
        academicYearId,
        term,
        amountDue:      due,
        amountPaid:     paid,
        paymentDate,
        receiptNumber:  receiptNumber || null,
        notes:          notes || null,
      })
      toast.success(`Payment recorded for ${student.firstName} ${student.lastName}`)
      onClose()
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to record payment')
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Record Payment — ${student.firstName} ${student.lastName}`}
      size="sm"
      footer={
        <>
          <ModalCancelButton onClose={onClose} />
          <Button
            variant="primary"
            type="submit"
            form="quick-payment-form"
            disabled={record.isPending || !isValid}
          >
            {record.isPending ? 'Saving…' : 'Record Payment'}
          </Button>
        </>
      }
    >
      {/* Student chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0.6rem 0.85rem', borderRadius: 10,
        background: 'var(--surface2)', marginBottom: '1rem',
      }}>
        <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
          <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{student.admissionNumber}</span>
          &ensp;·&ensp;{student.className}{student.streamName ? ` · ${student.streamName}` : ''}
          &ensp;·&ensp;Term {term}
        </div>
      </div>

      <form
        id="quick-payment-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {feeStructures.length > 0 && (
          <div>
            <label style={LABEL_STYLE}>Fee Structure</label>
            <select
              value={feeStructureId}
              onChange={e => onFeeStructureChange(e.target.value)}
              style={INPUT_STYLE}
            >
              <option value="">— Select fee type —</option>
              {feeStructures.map(fs => (
                <option key={fs.id} value={fs.id}>{fs.name} ({ugx(fs.amount)})</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={LABEL_STYLE}>Amount Due (UGX)</label>
            <input
              type="number" value={amountDue} min={0}
              onChange={e => setAmountDue(e.target.value)}
              placeholder="800000" style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Amount Paid (UGX) *</label>
            <input
              type="number" value={amountPaid} min={0}
              onChange={e => setAmountPaid(e.target.value)}
              placeholder="0" required autoFocus
              style={{ ...INPUT_STYLE, borderColor: paid <= 0 ? 'var(--danger)' : 'var(--border)' }}
            />
          </div>
        </div>

        {/* Live balance */}
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: balance <= 0 ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)',
          border: `1px solid ${balance <= 0 ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Balance after payment
          </span>
          <span style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 15, color: balance <= 0 ? 'var(--success)' : 'var(--warning)' }}>
            {ugx(balance)}{balance <= 0 ? ' ✓' : ''}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={LABEL_STYLE}>Payment Date *</label>
            <input type="date" value={paymentDate} required style={INPUT_STYLE} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Receipt Number</label>
            <input type="text" value={receiptNumber} placeholder="RCT-001" style={INPUT_STYLE} onChange={e => setReceiptNumber(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={LABEL_STYLE}>Notes (optional)</label>
          <input type="text" value={notes} placeholder="e.g. cash payment, bank transfer" style={INPUT_STYLE} onChange={e => setNotes(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Inline-editable amount cell (history modal)
// ─────────────────────────────────────────────────────────────

function EditablePaidCell({
  row, onSave,
}: {
  row:    PaymentDetailRow
  onSave: (id: string, amountDue: number, newPaid: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(row.amountPaid))
  const inputRef = useRef<HTMLInputElement>(null)

  function start() {
    setDraft(String(row.amountPaid))
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  function commit() {
    setEditing(false)
    const v = parseFloat(draft)
    if (isNaN(v) || v === row.amountPaid || v < 0) return
    onSave(row.id, row.amountDue, v)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        aria-label="Edit amount paid"
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter')  commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{
          width: 110, padding: '0.2rem 0.4rem',
          border: '1.5px solid var(--brand)', borderRadius: 8,
          background: 'var(--surface)', color: 'var(--txt)',
          fontFamily: 'var(--font3)', fontSize: 12, outline: 'none',
        }}
      />
    )
  }

  return (
    <button
      onClick={start}
      title="Click to edit"
      style={{
        background: 'none', border: 'none', cursor: 'text',
        fontFamily: 'var(--font3)', fontWeight: 600, fontSize: 13,
        color: 'var(--txt)', padding: '0.2rem 0.4rem',
        borderRadius: 4, borderBottom: '1px dashed var(--border)',
      }}
    >
      {ugx(row.amountPaid)}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Payment History Modal
// ─────────────────────────────────────────────────────────────

function PaymentHistoryModal({
  student, onClose,
}: {
  student: StudentFeeRow
  onClose: () => void
}) {
  const toast      = useToast()
  const updatePaid = useUpdatePaymentAmount()

  const rows = student.paymentRows

  const totalDue  = rows.reduce((s, r) => s + r.amountDue,  0)
  const totalPaid = rows.reduce((s, r) => s + r.amountPaid, 0)
  const totalBal  = rows.reduce((s, r) => s + r.balance,    0)

  function handleSave(id: string, amountDue: number, newPaid: number) {
    updatePaid.mutate(
      { id, amountDue, newPaid },
      {
        onSuccess: () => toast.success('Payment updated'),
        onError:   (err) => toast.error((err as Error).message),
      }
    )
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Payment History — ${student.firstName} ${student.lastName}`}
      size="lg"
      footer={<ModalCancelButton onClose={onClose} />}
    >
      {/* Student meta chip */}
      <div style={{
        fontSize: 12, color: 'var(--txt2)',
        padding: '0.5rem 0.75rem', background: 'var(--surface2)',
        borderRadius: 8, marginBottom: '1rem',
      }}>
        {student.admissionNumber} &middot; {student.className}{student.streamName ? ` · ${student.streamName}` : ''}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--txt3)', fontSize: 13 }}>
          No payment records found for this student.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Fee Type', 'Term', 'Due', 'Paid', 'Balance', 'Status', 'Date'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 700,
                    color: 'var(--txt3)', padding: '0.6rem 0.85rem',
                    textTransform: 'uppercase', letterSpacing: 0.7,
                    fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rowBal    = Math.max(0, r.balance)
                const rowPct    = r.amountDue > 0 ? Math.round((r.amountPaid / r.amountDue) * 100) : 0
                const rowStatus: FeeStatusEx =
                  r.amountDue === 0   ? 'no_fees'
                  : rowBal <= 0       ? 'paid'
                  : r.amountPaid > 0 && rowPct >= 60 ? 'above60'
                  : r.amountPaid > 0  ? 'partial'
                  :                     'unpaid'
                const cfg = STATUS_CONFIG[rowStatus]
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontSize: 12, color: 'var(--txt)', fontWeight: 600 }}>
                      {r.feeName ?? (r.feeStructureId ? 'Fee Item' : 'Manual Entry')}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font2)', fontWeight: 700 }}>
                      {r.term != null ? `T${r.term}` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font3)', fontSize: 12.5, color: 'var(--txt)' }}>
                      {ugx(r.amountDue)}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <EditablePaidCell row={r} onSave={handleSave} />
                    </td>
                    <td style={{
                      padding: '0.65rem 0.85rem', fontFamily: 'var(--font3)', fontSize: 12.5, fontWeight: 600,
                      color: rowBal <= 0 ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {ugx(rowBal)}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 9px', borderRadius: 20,
                        fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font2)',
                        color: cfg.color, background: cfg.glow,
                        border: `1px solid ${cfg.stripe}33`,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.stripe, display: 'inline-block', flexShrink: 0 }} />
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', fontSize: 11.5, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
                      {r.paymentDate ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={2} style={{ padding: '0.7rem 0.85rem', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 11, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Totals
                </td>
                <td style={{ padding: '0.7rem 0.85rem', fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>{ugx(totalDue)}</td>
                <td style={{ padding: '0.7rem 0.85rem', fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 13, color: 'var(--brand)' }}>{ugx(totalPaid)}</td>
                <td style={{ padding: '0.7rem 0.85rem', fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 13, color: totalBal <= 0 ? 'var(--success)' : 'var(--danger)' }}>{ugx(Math.max(0, totalBal))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Student Card
// ─────────────────────────────────────────────────────────────

function StudentCard({
  student,
  onPay,
  onHistory,
  onSms,
}: {
  student:   StudentFeeRow
  onPay:     (s: StudentFeeRow) => void
  onHistory: (s: StudentFeeRow) => void
  onSms:     (s: StudentFeeRow) => void
}) {
  const cfg     = STATUS_CONFIG[student.status]
  const fullName = `${student.firstName} ${student.lastName}`
  const [bg, fg] = avatarColor(fullName)

  return (
    <div style={{
      display: 'flex', gap: 0, background: 'var(--surface)',
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid var(--border)',
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      transition: 'box-shadow .18s, transform .18s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 24px ${cfg.glow}`
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
      }}
    >
      {/* Left accent stripe */}
      <div style={{ width: 4, flexShrink: 0, background: cfg.stripe, borderRadius: '14px 0 0 14px' }} />

      {/* Card body */}
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: fg,
          letterSpacing: -.5, userSelect: 'none',
        }}>
          {student.firstName[0]}{student.lastName[0]}
        </div>

        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14.5, color: 'var(--txt)', letterSpacing: -.2, whiteSpace: 'nowrap' }}>
              {fullName}
            </span>
            {/* Type badge */}
            <span style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
              fontFamily: 'var(--font2)', letterSpacing: .3,
              background: student.studentType === 'boarder' ? 'rgba(139,92,246,.12)' : 'rgba(14,165,233,.1)',
              color: student.studentType === 'boarder' ? 'var(--violet)' : 'var(--info)',
              border: student.studentType === 'boarder' ? '1px solid rgba(139,92,246,.25)' : '1px solid rgba(14,165,233,.25)',
            }}>
              {student.studentType === 'boarder' ? 'Boarder' : 'Day Scholar'}
            </span>
            {/* Status chip */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 9px', borderRadius: 20, fontSize: 10.5,
              fontWeight: 700, fontFamily: 'var(--font2)', letterSpacing: .3,
              background: cfg.glow, color: cfg.color,
              border: `1px solid ${cfg.stripe}44`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: cfg.stripe,
                display: 'inline-block', flexShrink: 0,
                boxShadow: `0 0 6px ${cfg.stripe}`,
                animation: student.status === 'unpaid' ? 'pulse 2s infinite' : 'none',
              }} />
              {cfg.label}
            </span>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginBottom: 10, fontFamily: 'var(--font3)' }}>
            {student.admissionNumber}
            {student.className && (
              <span style={{ marginLeft: 8, color: 'var(--txt2)', fontFamily: 'var(--font1)' }}>
                &middot; {student.className}{student.streamName ? ` ${student.streamName}` : ''}
              </span>
            )}
          </div>

          {/* Fee amounts */}
          <div className="mob-bursar-fee-amounts" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            {[
              { label: 'Due',     value: ugx(student.amountDue),  color: 'var(--txt)'     },
              { label: 'Paid',    value: ugx(student.amountPaid), color: 'var(--success)'  },
              { label: 'Balance', value: ugx(Math.max(0, student.balance)),
                color: student.balance <= 0 ? 'var(--success)' : 'var(--danger)'  },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 1 }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 13.5, color }}>
                  {value}
                </div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 1 }}>
                Progress
              </div>
              <div style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 13.5, color: cfg.color }}>
                {student.status === 'no_fees' ? '—' : `${student.pct}%`}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 5, borderRadius: 99, background: 'var(--surface2)',
            overflow: 'hidden', marginBottom: 12,
          }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(100, student.pct)}%`,
              background: PROGRESS_COLOR[student.status],
              transition: 'width .5s cubic-bezier(.34,1.56,.64,1)',
            }} />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ActionBtn
              onClick={() => onPay(student)}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              }
              label="Record Payment"
              primary
            />
            <ActionBtn
              onClick={() => onHistory(student)}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              }
              label="View History"
            />
            <ActionBtn
              onClick={() => onSms(student)}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              }
              label="SMS Reminder"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({
  onClick, icon, label, primary = false,
}: {
  onClick: () => void
  icon:    React.ReactNode
  label:   string
  primary?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 8,
        fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 11.5,
        cursor: 'pointer', transition: 'all .15s',
        background: primary
          ? hovered
            ? 'linear-gradient(135deg, var(--brand-dark), #065f5b)'
            : 'linear-gradient(135deg, var(--brand), var(--brand-dark))'
          : hovered
          ? 'var(--surface2)'
          : 'var(--surface)',
        color: primary ? '#fff' : 'var(--txt2)',
        border: primary ? 'none' : '1px solid var(--border)',
        boxShadow: primary && hovered ? '0 4px 12px rgba(13,148,136,.3)' : 'none',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Excel export helper
// ─────────────────────────────────────────────────────────────

async function exportToExcel(
  rows:       StudentFeeRow[],
  term:       number,
  year:       string,
  schoolName: string,
  userName:   string,
) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Shule Management System'
  wb.created = new Date()

  const ws = wb.addWorksheet('Fee Ledger', { pageSetup: { fitToPage: true, fitToWidth: 1 } })

  const COLS = 9
  const lastColLetter = 'I'

  // ── Row 1: Title ──────────────────────────────────────────
  ws.mergeCells(`A1:${lastColLetter}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = `OFFICIAL FEE LEDGER — TERM ${term}, YEAR ${year}`
  titleCell.font  = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D4D47' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 32

  // ── Row 2: School + meta ──────────────────────────────────
  ws.mergeCells(`A2:${lastColLetter}2`)
  const metaCell = ws.getCell('A2')
  metaCell.value = `${schoolName}   |   Generated by: ${userName}   |   ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
  metaCell.font  = { name: 'Calibri', italic: true, size: 9.5, color: { argb: 'FF475569' } }
  metaCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
  metaCell.alignment = { horizontal: 'center' }
  ws.getRow(2).height = 16

  // ── Row 3: blank ─────────────────────────────────────────
  ws.getRow(3).height = 6

  // ── Row 4: Headers ───────────────────────────────────────
  const HEADERS = ['#', 'Admission No.', 'Student Name', 'Class', 'Type', 'Amount Due', 'Amount Paid', 'Balance', 'Status']
  const headerRow = ws.getRow(4)
  headerRow.values = HEADERS
  headerRow.height = 22
  headerRow.eachCell((cell, colNum) => {
    if (colNum > COLS) return
    cell.font      = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF0D4D47' } },
      bottom: { style: 'thin', color: { argb: 'FF0D4D47' } },
      left:   { style: 'thin', color: { argb: 'FF0D4D47' } },
      right:  { style: 'thin', color: { argb: 'FF0D4D47' } },
    }
  })

  const STATUS_LABEL_EXCEL: Record<FeeStatusEx, string> = {
    paid: 'Paid', above60: '60%+', partial: 'Partial', unpaid: 'Unpaid', no_fees: 'No Fees',
  }
  const STATUS_BG: Record<FeeStatusEx, string> = {
    paid:    'FFD1FAE5', // green light
    above60: 'FFFEF3C7', // amber light
    partial: 'FFE0F2FE', // blue light
    unpaid:  'FFFFE4E6', // red light
    no_fees: 'FFF1F5F9', // gray light
  }
  const STATUS_FG: Record<FeeStatusEx, string> = {
    paid: 'FF059669', above60: 'FFD97706', partial: 'FF0284C7', unpaid: 'FFE11D48', no_fees: 'FF64748B',
  }

  // ── Data rows (starting at row 5) ────────────────────────
  rows.forEach((s, idx) => {
    const rowNum    = idx + 5
    const isEven    = idx % 2 === 0
    const baseBg    = s.status === 'no_fees'
      ? 'FFF1F5F9'
      : isEven ? 'FFF8FAFC' : 'FFFFFFFF'
    const rowBg     = s.status === 'paid'   ? 'FFD1FAE5'
                    : s.status === 'unpaid' ? 'FFFFE4E6'
                    : baseBg

    const dataRow = ws.getRow(rowNum)
    dataRow.values = [
      idx + 1,
      s.admissionNumber,
      `${s.firstName} ${s.lastName}`,
      s.className + (s.streamName ? ` ${s.streamName}` : ''),
      s.studentType === 'boarder' ? 'Boarder' : 'Day Scholar',
      s.amountDue,
      s.amountPaid,
      Math.max(0, s.balance),
      STATUS_LABEL_EXCEL[s.status],
    ]
    dataRow.height = 17

    dataRow.eachCell((cell, colNum) => {
      if (colNum > COLS) return
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      cell.font = { name: 'Calibri', size: 10 }
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle' }

      // Amount columns: right-align, UGX number format
      if (colNum === 6 || colNum === 7 || colNum === 8) {
        cell.numFmt    = '"UGX "#,##0'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        // Balance colour
        if (colNum === 8) {
          const isZero = (cell.value as number) <= 0
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isZero ? 'FF059669' : 'FFE11D48' } }
        }
      }

      // Status column
      if (colNum === 9) {
        cell.font = {
          name: 'Calibri', size: 10, bold: true,
          color: { argb: STATUS_FG[s.status] },
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_BG[s.status] } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })
  })

  // ── Totals row ────────────────────────────────────────────
  const totDue  = rows.reduce((s, r) => s + r.amountDue,  0)
  const totPaid = rows.reduce((s, r) => s + r.amountPaid, 0)
  const totBal  = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const totRowNum = rows.length + 5
  const totRow  = ws.getRow(totRowNum)
  totRow.values = ['', '', 'TOTALS', '', '', totDue, totPaid, totBal, '']
  totRow.height = 20
  totRow.eachCell((cell, colNum) => {
    if (colNum > COLS) return
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle' }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0D4D47' } },
      bottom: { style: 'medium', color: { argb: 'FF0D4D47' } },
    }
    if (colNum === 6 || colNum === 7 || colNum === 8) {
      cell.numFmt    = '"UGX "#,##0'
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
    }
  })

  // ── Footer ────────────────────────────────────────────────
  const footerRowNum = totRowNum + 2
  ws.mergeCells(`A${footerRowNum}:${lastColLetter}${footerRowNum}`)
  const footerCell = ws.getCell(`A${footerRowNum}`)
  footerCell.value     = 'Shule Management System — Confidential Fee Record'
  footerCell.font      = { name: 'Calibri', italic: true, size: 8.5, color: { argb: 'FF94A3B8' } }
  footerCell.alignment = { horizontal: 'center' }

  // ── Column widths ─────────────────────────────────────────
  const widths = [5, 16, 26, 16, 13, 18, 18, 18, 12]
  ws.columns.forEach((col, i) => { col.width = widths[i] ?? 14 })

  // ── Freeze panes ─────────────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }]

  // ── Generate file ─────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `fee-ledger-T${term}-${year}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

type StatusFilter = 'all' | FeeStatusEx

export function BursarStudentsPage() {
  const { user }  = useToastUser()
  const toast     = useToast()

  const [classId,   setClassId]   = useState<string | null>(null)
  const [streamId,  setStreamId]  = useState<string | null>(null)
  const [term,      setTerm]      = useState<1 | 2 | 3>(1)
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [payStudent,     setPayStudent]     = useState<StudentFeeRow | null>(null)
  const [historyStudent, setHistoryStudent] = useState<StudentFeeRow | null>(null)

  const { data: classes }       = useClasses()
  const { data: academicYears } = useAcademicYears()
  const { data: streams }       = useStreams(classId)
  const { data: feeStructures = [] } = useFeeStructures(term, academicYearId)
  const { data: schoolProfile }      = useSchoolProfile()

  // Auto-select active academic year and first class on load
  useEffect(() => {
    if (academicYears && academicYears.length > 0 && !academicYearId) {
      const active = academicYears.find(y => y.isActive) ?? academicYears[0]
      setAcademicYearId(active.id)
    }
  }, [academicYears, academicYearId])

  useEffect(() => {
    if (classes && classes.length > 0 && !classId) {
      setClassId(classes[0].id)
    }
  }, [classes, classId])

  const { data: students = [], isLoading, error } = useBursarStudentFees(
    classId, streamId, term, academicYearId,
  )

  // ── Filtered list ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = students
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)  ||
        s.admissionNumber.toLowerCase().includes(q)
      )
    }
    return list
  }, [students, statusFilter, search])

  // ── KPI counts ───────────────────────────────────────────
  const kpis = useMemo(() => ({
    total:   students.length,
    paid:    students.filter(s => s.status === 'paid').length,
    partial: students.filter(s => s.status === 'partial' || s.status === 'above60').length,
    unpaid:  students.filter(s => s.status === 'unpaid').length,
  }), [students])

  // ── Virtualizer ──────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count:            filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 178,
    overscan:         5,
    gap:              10,
  })

  // ── SMS handler (stub — navigate to SMS page) ─────────────
  function handleSms(student: StudentFeeRow) {
    toast.info(`SMS reminder: ${student.firstName} ${student.lastName} — navigate to SMS Reminders page to send.`)
  }

  // ── Export ────────────────────────────────────────────────
  async function handleExport() {
    if (!filtered.length) {
      toast.warning('No students to export — apply a filter first.')
      return
    }
    try {
      const yearLabel = (academicYears ?? []).find(y => y.id === academicYearId)?.name ?? String(new Date().getFullYear())
      await exportToExcel(
        filtered, term, yearLabel,
        schoolProfile?.school_name ?? 'School',
        user?.name ?? 'Bursar',
      )
      toast.success(`Exported ${filtered.length} students to Excel`)
    } catch (err) {
      toast.error('Export failed: ' + (err as Error).message)
    }
  }

  // ── Styles ────────────────────────────────────────────────
  const selectStyle: React.CSSProperties = {
    padding: '0.38rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 10,
    background: 'var(--surface)', color: 'var(--txt)', fontSize: 13, outline: 'none',
    fontFamily: 'var(--font1)', cursor: 'pointer',
  }

  return (
    <div className="mob-bursar-students" style={{
      padding: '1.5rem 2rem', maxWidth: 1400, margin: '0 auto',
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)',
      gap: 16,
    }}>

      {/* ── Hero Band ─────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: 'hidden', flexShrink: 0,
        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #065f5b 100%)',
        padding: '28px 28px 22px', position: 'relative',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80,  width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 160, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 26, color: '#fff', margin: 0, letterSpacing: -.5, lineHeight: 1 }}>
                  Student Fee Tracker
                </h1>
                <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 12.5, margin: '4px 0 0', fontWeight: 500 }}>
                  Select a class to view fee collection status
                </p>
              </div>
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={!filtered.length}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', borderRadius: 12,
                border: '.5px solid rgba(255,255,255,.35)',
                background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)',
                color: '#fff', fontFamily: 'var(--font2)', fontWeight: 800,
                fontSize: 13, cursor: filtered.length ? 'pointer' : 'default',
                opacity: filtered.length ? 1 : .45, transition: 'all .18s',
                boxShadow: filtered.length ? '0 4px 16px rgba(0,0,0,.12)' : 'none',
              }}
              onMouseEnter={e => { if (filtered.length) (e.currentTarget.style.background = 'rgba(255,255,255,.26)') }}
              onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(255,255,255,.16)') }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Ledger
            </button>
          </div>

          {/* KPI chips */}
          <div className="mob-bursar-kpis" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            {[
              { label: 'Total Students', value: isLoading ? '—' : kpis.total,   accent: 'rgba(255,255,255,.22)' },
              { label: 'Fully Paid',     value: isLoading ? '—' : kpis.paid,    accent: 'rgba(16,185,129,.35)'  },
              { label: 'Partial',        value: isLoading ? '—' : kpis.partial, accent: 'rgba(245,158,11,.35)'  },
              { label: 'Unpaid',         value: isLoading ? '—' : kpis.unpaid,  accent: 'rgba(244,63,94,.35)'   },
            ].map(stat => (
              <div key={stat.label} style={{
                background: stat.accent, backdropFilter: 'blur(8px)',
                border: '.5px solid rgba(255,255,255,.25)',
                borderRadius: 14, padding: '10px 18px', minWidth: 90,
              }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────── */}
      <div className="mob-bursar-filters" style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        flexShrink: 0, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 14,
        padding: '12px 16px',
      }}>
        {/* Term pills */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
          {([1, 2, 3] as const).map(t => (
            <button
              key={t}
              onClick={() => setTerm(t)}
              style={{
                padding: '5px 14px', border: 'none', borderRadius: 20,
                background: term === t ? 'var(--brand)' : 'transparent',
                color: term === t ? '#fff' : 'var(--txt3)',
                fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12.5,
                cursor: 'pointer', transition: 'all .18s',
                boxShadow: term === t ? '0 2px 8px rgba(13,148,136,.35)' : 'none',
              }}
            >
              T{t}
            </button>
          ))}
        </div>

        {/* Academic Year */}
        <select
          value={academicYearId ?? ''}
          onChange={e => setAcademicYearId(e.target.value || null)}
          aria-label="Academic Year"
          style={selectStyle}
        >
          <option value="">All Years</option>
          {(academicYears ?? []).map(y => (
            <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>
          ))}
        </select>

        {/* Class */}
        <select
          value={classId ?? ''}
          onChange={e => { setClassId(e.target.value || null); setStreamId(null) }}
          aria-label="Class"
          style={selectStyle}
        >
          <option value="">— Select Class —</option>
          {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Stream */}
        <select
          value={streamId ?? ''}
          onChange={e => setStreamId(e.target.value || null)}
          aria-label="Stream"
          disabled={!classId || !streams?.length}
          style={{ ...selectStyle, opacity: classId ? 1 : 0.5 }}
        >
          <option value="">All Streams</option>
          {(streams ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Status filter"
          style={selectStyle}
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="above60">60%+</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="no_fees">No Fees</option>
        </select>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or admission no…"
            aria-label="Search students"
            style={{
              ...selectStyle, width: '100%', paddingLeft: '2.2rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Count badge */}
        <span style={{
          fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font2)',
          fontWeight: 700, whiteSpace: 'nowrap', background: 'var(--surface2)',
          padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)',
        }}>
          {filtered.length} student{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Card list area ───────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {!classId ? (
          // Premium empty state — no class selected
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(13,148,136,.12), rgba(13,148,136,.04))',
              border: '1.5px solid rgba(13,148,136,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 18, color: 'var(--txt)', letterSpacing: -.3, marginBottom: 6 }}>
                Select a Class to Begin
              </div>
              <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 340, lineHeight: 1.6 }}>
                Choose a class from the filter bar above to view student fee records
                for Term {term}.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(classes ?? []).slice(0, 5).map(c => (
                <button
                  key={c.id}
                  onClick={() => setClassId(c.id)}
                  style={{
                    padding: '8px 16px', border: '1.5px solid var(--border)',
                    borderRadius: 10, background: 'var(--surface)',
                    color: 'var(--txt2)', fontFamily: 'var(--font2)', fontWeight: 700,
                    fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget.style.borderColor = 'var(--brand)')
                    ;(e.currentTarget.style.color = 'var(--brand)')
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget.style.borderColor = 'var(--border)')
                    ;(e.currentTarget.style.color = 'var(--txt2)')
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : isLoading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid var(--brand)', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 13, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600 }}>
                Loading students…
              </span>
            </div>
          </div>
        ) : error ? (
          <div style={{
            margin: '1rem 0', padding: '1rem 1.25rem',
            background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)',
            borderRadius: 12, color: 'var(--danger)', fontSize: 13,
          }}>
            {(error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt2)' }}>
              No students match the current filters
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--txt3)' }}>
              Try adjusting the status filter or search term.
            </div>
          </div>
        ) : (
          // Virtualized card list
          <div
            ref={parentRef}
            style={{ height: '100%', overflowY: 'auto', paddingRight: 4 }}
          >
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vItem => {
                const student = filtered[vItem.index]
                return (
                  <div
                    key={student.id}
                    data-index={vItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute', top: 0, left: 0, right: 0,
                      transform: `translateY(${vItem.start}px)`,
                      paddingBottom: 10,
                    }}
                  >
                    <StudentCard
                      student={student}
                      onPay={setPayStudent}
                      onHistory={setHistoryStudent}
                      onSms={handleSms}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {payStudent && (
        <QuickPaymentModal
          student={payStudent}
          term={term}
          academicYearId={academicYearId}
          feeStructures={feeStructures}
          onClose={() => setPayStudent(null)}
        />
      )}

      {historyStudent && (
        <PaymentHistoryModal
          student={historyStudent}
          onClose={() => setHistoryStudent(null)}
        />
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Internal helper: get user from auth context for export
// (avoids re-fetching what the hook already has)
// ─────────────────────────────────────────────────────────────

function useToastUser() {
  const { user } = useAuth()
  return { user }
}
