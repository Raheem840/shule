import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useStudents } from '../../hooks/useStudents'
import { useAddPayment } from '../../hooks/useFeePayments'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'

const schema = z.object({
  studentId:     z.string().min(1, 'Select a student'),
  amountDue:     z.coerce.number().min(1, 'Amount due is required'),
  amountPaid:    z.coerce.number().min(0),
  paymentDate:   z.string().min(1, 'Payment date is required'),
  receiptNumber: z.string().optional(),
  feeTypeId:     z.string().optional(),
  notes:         z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function AddPaymentPage() {
  const { success: ok, error: err } = useToast()
  const addPayment = useAddPayment()
  const [search, setSearch] = useState('')
  const { data: students = [], isLoading: studentsLoading } = useStudents({}, true)
  const today = new Date().toISOString().slice(0, 10)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { paymentDate: today, amountPaid: 0, amountDue: 0 },
  })

  const amountDue  = Number(watch('amountPaid') ?? 0)
  const amountPaid = Number(watch('amountDue')  ?? 0)
  const balance    = amountDue - amountPaid

  const filtered = search.trim()
    ? students.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        s.admissionNumber.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 20)
    : []

  async function onSubmit(values: FormValues) {
    try {
      await addPayment.mutateAsync({
        studentId:     values.studentId,
        feeTypeId:     values.feeTypeId || null,
        amountDue:     values.amountDue,
        amountPaid:    values.amountPaid,
        paymentDate:   values.paymentDate,
        receiptNumber: values.receiptNumber || null,
        notes:         values.notes || null,
        term:          1,
        year:          new Date().getFullYear(),
      })
      ok('Payment recorded successfully.')
      reset({ paymentDate: today, amountPaid: 0, amountDue: 0 })
      setSearch('')
    } catch (e: any) {
      err(e.message)
    }
  }

  const inputStyle = { width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      <PageHeader title="Add Payment" subtitle="Record a fee payment for a student." />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <form onSubmit={(handleSubmit as any)(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Student search */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Student *</label>
            <input className="sui-input" style={inputStyle} placeholder="Search by name or admission number…"
              value={search} onChange={e => setSearch(e.target.value)} disabled={studentsLoading} />
            {filtered.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, overflow: 'hidden', background: 'var(--surface)' }}>
                {filtered.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { (document.getElementById('studentId') as HTMLInputElement).value = s.id; setSearch(`${s.firstName} ${s.lastName} (${s.admissionNumber})`); }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--txt)' }}>
                    {s.firstName} {s.lastName} — <span style={{ fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{s.admissionNumber}</span>
                  </button>
                ))}
              </div>
            )}
            <input type="hidden" id="studentId" {...register('studentId')} />
            {errors.studentId && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.studentId.message}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Amount Due (UGX) *</label>
              <input className="sui-input" style={inputStyle} type="number" {...register('amountDue')} />
              {errors.amountDue && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.amountDue.message}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Amount Paid (UGX)</label>
              <input className="sui-input" style={inputStyle} type="number" {...register('amountPaid')} />
            </div>
          </div>

          {/* Balance preview */}
          {(amountDue > 0 || amountPaid > 0) && (
            <div style={{ background: balance > 0 ? 'var(--warning-bg)' : 'var(--success-bg)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
              Balance outstanding: UGX {Math.max(0, balance).toLocaleString()}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Payment Date *</label>
              <input className="sui-input" style={inputStyle} type="date" {...register('paymentDate')} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Receipt Number</label>
              <input className="sui-input" style={inputStyle} {...register('receiptNumber')} placeholder="e.g. REC-0042" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Notes</label>
            <input className="sui-input" style={inputStyle} {...register('notes')} placeholder="Optional note…" />
          </div>

          <button type="submit" className="sui-btn-primary" disabled={addPayment.isPending} style={{ alignSelf: 'flex-start' }}>
            {addPayment.isPending ? 'Saving…' : 'Record Payment'}
          </button>
        </form>
      </div>
    </div>
  )
}
