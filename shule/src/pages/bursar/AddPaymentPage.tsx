import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SubmitHandler } from 'react-hook-form'
import { useStudents } from '../../hooks/useStudents'
import { useAddPayment, useFeePayments, ugx, calcFeeStatus } from '../../hooks/useFeePayments'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { Avatar as StudentAvatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'

const schema = z.object({
  term:          z.coerce.number().int().min(1).max(3),
  year:          z.coerce.number().int().min(2020).max(2099),
  amountDue:     z.coerce.number().min(0, 'Required'),
  amountPaid:    z.coerce.number().min(0, 'Cannot be negative'),
  paymentDate:   z.string().min(1, 'Payment date is required'),
  receiptNumber: z.string().optional(),
  notes:         z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const STATUS_VARIANT = { paid: 'green', partial: 'amber', unpaid: 'red' } as const
const STATUS_LABEL   = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

const CURRENT_YEAR = new Date().getFullYear()

// ── Student avatar ────────────────────────────────────────────
function Avatar({ student }: { student: Student }) {
  return (
    <StudentAvatar
      photoPath={student.photoUrl}
      bucket="student-photos"
      name={`${student.firstName} ${student.lastName}`}
      size="lg"
    />
  )
}

// ── Left panel: student finder ────────────────────────────────
function StudentFinder({
  selected, onSelect, term, year,
}: {
  selected: Student | null
  onSelect: (s: Student | null) => void
  term: number
  year: number
}) {
  const [search, setSearch] = useState('')
  const { data: students = [] } = useStudents({}, true)

  const filtered = search.trim()
    ? students.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        s.admissionNumber.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 20)
    : []

  // Fetch balance for the selected student for the chosen term/year
  const { data: payments = [] } = useFeePayments(
    selected ? { term, year } : {},
  )
  const studentPayments = payments.filter(p => p.studentId === selected?.id)
  const totalDue    = studentPayments.reduce((a, p) => a + p.amountDue,  0)
  const totalPaid   = studentPayments.reduce((a, p) => a + p.amountPaid, 0)
  const totalBalance = studentPayments.reduce((a, p) => a + p.balance,   0)
  const feeStatus   = selected ? calcFeeStatus(totalPaid, totalBalance) : null

  const inputStyle = {
    width: '100%', padding: '0.55rem 0.85rem',
    border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
    background: 'var(--surface)', color: 'var(--txt)',
    fontSize: 13, fontFamily: 'var(--font1)', outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>
        Find Student
      </div>

      {selected ? (
        <div style={{
          background: 'var(--brand-light)', border: '1.5px solid var(--brand)',
          borderRadius: 'var(--r-lg)', padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar student={selected} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)' }}>
                {selected.firstName} {selected.lastName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                {selected.admissionNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { onSelect(null); setSearch('') }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 20, lineHeight: 1 }}
            >×</button>
          </div>

          {/* Balance summary */}
          {studentPayments.length > 0 && feeStatus && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r)',
              padding: '0.75rem', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Term {term} {year} Balance
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Amount Due</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{ugx(totalDue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Paid</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--success)' }}>{ugx(totalPaid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Balance</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 800, fontFamily: 'var(--font3)',
                    color: totalBalance <= 0 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {ugx(Math.max(0, totalBalance))}
                  </span>
                  <Badge variant={STATUS_VARIANT[feeStatus]} size="sm">{STATUS_LABEL[feeStatus]}</Badge>
                </div>
              </div>
            </div>
          )}

          {studentPayments.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '0.5rem' }}>
              No fee record for Term {term} {year}
            </div>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or admission number…"
            aria-label="Search student"
            style={inputStyle}
          />
          {search && filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
              background: 'var(--surface)', maxHeight: 240, overflowY: 'auto',
              marginTop: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}>
              {filtered.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onSelect(s); setSearch('') }}
                  style={{
                    width: '100%', padding: '0.65rem 1rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                    {s.firstName} {s.lastName}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                    {s.admissionNumber}
                  </span>
                </button>
              ))}
            </div>
          )}
          {search && filtered.length === 0 && (
            <div style={{ marginTop: 4, padding: '0.65rem', fontSize: 12, color: 'var(--txt3)' }}>
              No students found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export function AddPaymentPage() {
  const { success: toastOk, error: toastErr } = useToast()
  const addPayment = useAddPayment()

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [term, setTerm] = useState<1 | 2 | 3>(1)
  const [year, setYear] = useState(CURRENT_YEAR)

  const today = new Date().toISOString().slice(0, 10)

  const {
    register, handleSubmit, reset, watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { term: 1, year: CURRENT_YEAR, paymentDate: today, amountPaid: 0, amountDue: 0 },
  })

  const watchedDue  = Number(watch('amountDue')  ?? 0)
  const watchedPaid = Number(watch('amountPaid') ?? 0)
  const liveBalance = watchedDue - watchedPaid

  const onSubmit: SubmitHandler<FormValues> = async values => {
    if (!selectedStudent) { toastErr('Please select a student'); return }
    try {
      await addPayment.mutateAsync({
        studentId:     selectedStudent.id,
        feeTypeId:     null,
        amountDue:     values.amountDue,
        amountPaid:    values.amountPaid,
        paymentDate:   values.paymentDate,
        receiptNumber: values.receiptNumber || null,
        notes:         values.notes || null,
        term:          values.term,
        year:          values.year,
      })
      toastOk(`Payment of ${ugx(values.amountPaid)} recorded for ${selectedStudent.firstName} ${selectedStudent.lastName}`)
      // Keep student selected, reset form amounts
      reset({ term: values.term, year: values.year, paymentDate: today, amountPaid: 0, amountDue: 0 })
    } catch (e: any) {
      toastErr(e.message)
    }
  }

  const handleTermChange = useCallback((t: 1 | 2 | 3) => {
    setTerm(t)
    // Keep form term in sync
  }, [])

  const fieldLabel = {
    display: 'block', fontSize: 11, fontWeight: 700 as const, color: 'var(--txt2)',
    marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5, fontFamily: 'var(--font2)',
  }
  const fieldInput = {
    width: '100%', padding: '0.55rem 0.85rem', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)',
    fontSize: 13, fontFamily: 'var(--font1)', outline: 'none', boxSizing: 'border-box' as const,
  }
  const fieldErr = { fontSize: 11, color: 'var(--danger)', marginTop: 3 }

  return (
    <div className="sui-page-enter" style={{ padding: '1.5rem 2rem', maxWidth: 1100 }}>
      <PageHeader
        title="Add Payment"
        subtitle="Record a fee payment for a student"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: Student finder ───────────────────────── */}
        <div className="sui-glass-card" style={{ padding: '1.25rem' }}>
          {/* Term + Year selector here so balance auto-updates */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
              {([1, 2, 3] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTermChange(t)}
                  style={{
                    padding: '0.22rem 0.75rem', border: 'none', borderRadius: 20,
                    background: term === t ? 'var(--brand)' : 'transparent',
                    color: term === t ? '#fff' : 'var(--txt3)',
                    fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}
                >T{t}</button>
              ))}
            </div>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              aria-label="Year"
              style={{ width: 72, padding: '0.28rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, outline: 'none' }}
            />
          </div>

          <StudentFinder
            selected={selectedStudent}
            onSelect={setSelectedStudent}
            term={term}
            year={year}
          />
        </div>

        {/* ── RIGHT: Payment form ────────────────────────── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '1.25rem',
        }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: '1.25rem' }}>
            Payment Details
          </div>

          <form onSubmit={(handleSubmit as any)(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Term + Year in form (hidden — driven by left panel selectors) */}
            <input type="hidden" {...register('term')} value={term} />
            <input type="hidden" {...register('year')} value={year} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={fieldLabel}>Amount Due (UGX) *</label>
                <input {...register('amountDue')} type="number" min={0} style={fieldInput} placeholder="800000" />
                {errors.amountDue && <p style={fieldErr}>{errors.amountDue.message}</p>}
              </div>
              <div>
                <label style={fieldLabel}>Amount Paid (UGX) *</label>
                <input {...register('amountPaid')} type="number" min={0} style={fieldInput} placeholder="0" />
                {errors.amountPaid && <p style={fieldErr}>{errors.amountPaid.message}</p>}
              </div>
            </div>

            {/* Live balance preview */}
            {(watchedDue > 0 || watchedPaid > 0) && (
              <div style={{
                padding: '0.6rem 0.85rem', borderRadius: 'var(--r)',
                background: liveBalance <= 0 ? 'var(--success-bg)' : 'var(--warning-bg)',
                fontSize: 12.5, fontWeight: 700,
                color: liveBalance <= 0 ? 'var(--success)' : 'var(--warning)',
              }}>
                Balance: {ugx(Math.max(0, liveBalance))} · {liveBalance <= 0 ? 'Fully Paid' : 'Outstanding'}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={fieldLabel}>Payment Date *</label>
                <input {...register('paymentDate')} type="date" style={fieldInput} />
                {errors.paymentDate && <p style={fieldErr}>{errors.paymentDate.message}</p>}
              </div>
              <div>
                <label style={fieldLabel}>Receipt Number</label>
                <input {...register('receiptNumber')} style={fieldInput} placeholder="RCT-001" />
              </div>
            </div>

            <div>
              <label style={fieldLabel}>Notes (optional)</label>
              <input {...register('notes')} style={fieldInput} placeholder="e.g. cash payment, bank transfer" />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={!selectedStudent || addPayment.isPending}
              >
                {addPayment.isPending ? 'Saving…' : 'Record Payment'}
              </Button>
            </div>

            {!selectedStudent && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--txt3)' }}>
                Select a student on the left to enable payment recording
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
