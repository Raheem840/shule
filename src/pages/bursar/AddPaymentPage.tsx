import { useState, useRef, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SubmitHandler } from 'react-hook-form'
import { createPortal } from 'react-dom'
import { useStudents } from '../../hooks/useStudents'
import {
  useAddPayment,
  useApplyPayment,
  useStudentFeeRows,
  ugx,
  calcFeeStatus,
} from '../../hooks/useFeePayments'
import { useFeeStructure } from '../../hooks/useFeeStructure'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { Avatar as StudentAvatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'
import type { StudentFeeRow } from '../../hooks/useFeePayments'

// ── Schema for creating a NEW fee payment row ─────────────────
const newRowSchema = z.object({
  feeStructureId: z.string().optional(),
  amountDue:      z.coerce.number().min(1, 'Amount due is required'),
  amountPaid:     z.coerce.number().min(0, 'Cannot be negative'),
  paymentDate:    z.string().min(1, 'Payment date is required'),
  receiptNumber:  z.string().optional(),
  notes:          z.string().optional(),
})
type NewRowValues = z.infer<typeof newRowSchema>

// ── Schema for applying payment to an existing row ────────────
const applySchema = z.object({
  amountPaid:    z.coerce.number().min(0, 'Cannot be negative'),
  paymentDate:   z.string().min(1, 'Payment date is required'),
  receiptNumber: z.string().optional(),
  notes:         z.string().optional(),
})
type ApplyValues = z.infer<typeof applySchema>

const STATUS_VARIANT = { paid: 'green', partial: 'amber', unpaid: 'red' } as const
const STATUS_LABEL   = { paid: 'Paid',  partial: 'Partial', unpaid: 'Unpaid' }

const CURRENT_YEAR = new Date().getFullYear()

// ── Student Avatar wrapper ────────────────────────────────────
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

// ── Student search dropdown rendered via portal ───────────────
// Portalling out of the glass-card avoids any overflow:hidden clipping.
function StudentDropdown({
  items,
  anchorRef,
  onSelect,
}: {
  items: Student[]
  anchorRef: React.RefObject<HTMLInputElement | null>
  onSelect: (s: Student) => void
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const update = () => setRect(el.getBoundingClientRect())
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorRef])

  if (!rect || items.length === 0) return null

  return createPortal(
    <div
      style={{
        position:  'fixed',
        top:       rect.bottom + 4,
        left:      rect.left,
        width:     rect.width,
        zIndex:    9999,
        border:    '1.5px solid var(--border)',
        borderRadius: 'var(--r)',
        background:   'var(--surface)',
        maxHeight:    260,
        overflowY:    'auto',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.18)',
      }}
    >
      {items.map((s, idx) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(s) }}
          style={{
            width:          '100%',
            padding:        '0.65rem 1rem',
            background:     'none',
            border:         'none',
            cursor:         'pointer',
            textAlign:      'left',
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            borderBottom:   idx < items.length - 1 ? '1px solid var(--border)' : 'none',
            transition:     'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-light)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
            {s.firstName} {s.lastName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
            {s.admissionNumber}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  )
}

// ── Left panel: student finder ────────────────────────────────
function StudentFinder({
  selected,
  onSelect,
  term: _term,
}: {
  selected: Student | null
  onSelect: (s: Student | null) => void
  term: number
}) {
  const [search, setSearch]   = useState('')
  const [open, setOpen]       = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)
  const { data: students = [] } = useStudents({}, true)

  const filtered = search.trim()
    ? students
        .filter(s =>
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          s.admissionNumber.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 20)
    : []

  const inputStyle: React.CSSProperties = {
    width:        '100%',
    padding:      '0.55rem 0.85rem',
    border:       '1.5px solid var(--border)',
    borderRadius: 'var(--r)',
    background:   'var(--surface)',
    color:        'var(--txt)',
    fontSize:     13,
    fontFamily:   'var(--font1)',
    outline:      'none',
    boxSizing:    'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>
        Find Student
      </div>

      {selected ? (
        <div style={{
          background:   'var(--brand-light)',
          border:       '1.5px solid var(--brand)',
          borderRadius: 'var(--r-lg)',
          padding:      '1rem',
          display:      'flex',
          flexDirection:'column',
          gap:          '0.75rem',
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
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--txt3)', fontSize: 20, lineHeight: 1,
              }}
            >×</button>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search by name or admission number…"
            aria-label="Search student"
            style={inputStyle}
          />
          {open && search && filtered.length > 0 && (
            <StudentDropdown
              items={filtered}
              anchorRef={inputRef}
              onSelect={s => { onSelect(s); setSearch(''); setOpen(false) }}
            />
          )}
          {open && search && filtered.length === 0 && (
            <div style={{ marginTop: 4, padding: '0.65rem', fontSize: 12, color: 'var(--txt3)' }}>
              No students found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Fee row card (existing charge) ───────────────────────────
function FeeRowCard({
  row,
  selected,
  onSelect,
}: {
  row:      StudentFeeRow
  selected: boolean
  onSelect: () => void
}) {
  const status = calcFeeStatus(row.amountPaid, row.balance)
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width:          '100%',
        textAlign:      'left',
        padding:        '0.75rem',
        borderRadius:   'var(--r)',
        border:         selected ? '2px solid var(--brand)' : '1.5px solid var(--border)',
        background:     selected ? 'var(--brand-light)' : 'var(--surface)',
        cursor:         'pointer',
        display:        'flex',
        flexDirection:  'column',
        gap:            4,
        transition:     'border 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{row.feeName}</span>
        <Badge variant={STATUS_VARIANT[status]} size="sm">{STATUS_LABEL[status]}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
        <span>Due: <strong style={{ color: 'var(--txt)' }}>{ugx(row.amountDue)}</strong></span>
        <span>Paid: <strong style={{ color: 'var(--success)' }}>{ugx(row.amountPaid)}</strong></span>
        <span>Balance: <strong style={{ color: row.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{ugx(row.balance)}</strong></span>
      </div>
    </button>
  )
}

// ── Apply payment form (updates existing row) ─────────────────
// Default mode: shows current paid as read-only, adds incremental payment.
// Edit mode: all fields become editable to correct mistakes.
const addSchema = z.object({
  amountToAdd:   z.coerce.number().min(0, 'Cannot be negative'),
  paymentDate:   z.string().min(1, 'Payment date is required'),
  receiptNumber: z.string().optional(),
  notes:         z.string().optional(),
})
type AddValues = z.infer<typeof addSchema>

function ApplyPaymentForm({
  row,
  onDone,
}: {
  row:    StudentFeeRow
  onDone: () => void
}) {
  const { success: toastOk, error: toastErr } = useToast()
  const applyPayment = useApplyPayment()
  const today        = new Date().toISOString().slice(0, 10)
  const [editMode, setEditMode] = useState(false)

  // ── Add-payment form (default) ──────────────────────────────
  const addForm = useForm<AddValues>({
    resolver: zodResolver(addSchema) as any,
    defaultValues: { amountToAdd: 0, paymentDate: today, receiptNumber: '', notes: '' },
  })
  const amountToAdd  = Number(addForm.watch('amountToAdd') ?? 0)
  const newPaidAdd   = row.amountPaid + amountToAdd
  const newBalAdd    = Math.max(0, row.amountDue - newPaidAdd)

  const onAddSubmit: SubmitHandler<AddValues> = async values => {
    try {
      await applyPayment.mutateAsync({
        id:            row.id,
        amountDue:     row.amountDue,
        amountPaid:    row.amountPaid + values.amountToAdd,
        paymentDate:   values.paymentDate,
        receiptNumber: values.receiptNumber || null,
        notes:         values.notes || null,
      })
      toastOk(`${ugx(values.amountToAdd)} added — new total ${ugx(newPaidAdd)}`)
      onDone()
    } catch (e: any) { toastErr(e.message) }
  }

  // ── Edit form (correct mistakes) ────────────────────────────
  const editForm = useForm<ApplyValues>({
    resolver: zodResolver(applySchema) as any,
    defaultValues: {
      amountPaid:    row.amountPaid,
      paymentDate:   row.paymentDate ?? today,
      receiptNumber: row.receiptNumber ?? '',
      notes:         row.notes ?? '',
    },
  })
  const watchedEdit = Number(editForm.watch('amountPaid') ?? row.amountPaid)
  const newBalEdit  = Math.max(0, row.amountDue - watchedEdit)

  const onEditSubmit: SubmitHandler<ApplyValues> = async values => {
    try {
      await applyPayment.mutateAsync({
        id:            row.id,
        amountDue:     row.amountDue,
        amountPaid:    values.amountPaid,
        paymentDate:   values.paymentDate,
        receiptNumber: values.receiptNumber || null,
        notes:         values.notes || null,
      })
      toastOk(`Payment corrected — ${ugx(values.amountPaid)} recorded`)
      onDone()
    } catch (e: any) { toastErr(e.message) }
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--txt2)', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'var(--font2)',
  }
  const fieldInput: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.85rem',
    border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
    background: 'var(--surface)', color: 'var(--txt)',
    fontSize: 13, fontFamily: 'var(--font1)', outline: 'none', boxSizing: 'border-box',
  }
  const readonlyInput: React.CSSProperties = {
    ...fieldInput, background: 'var(--surface2)', color: 'var(--txt2)', cursor: 'default',
  }
  const fieldErr: React.CSSProperties = { fontSize: 11, color: 'var(--danger)', marginTop: 3 }

  // ── Fee summary strip ───────────────────────────────────────
  const summary = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {[
        { label: 'Amount Due', value: ugx(row.amountDue), color: 'var(--txt)' },
        { label: 'Already Paid', value: ugx(row.amountPaid), color: 'var(--success)' },
        { label: 'Balance', value: ugx(row.balance), color: row.balance > 0 ? 'var(--danger)' : 'var(--success)' },
      ].map(s => (
        <div key={s.label} style={{ padding: '0.6rem 0.75rem', background: 'var(--surface2)', borderRadius: 'var(--r)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{s.label}</div>
          <div style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 13, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )

  if (editMode) {
    return (
      <form onSubmit={(editForm.handleSubmit as any)(onEditSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', fontFamily: 'var(--font2)' }}>
            Edit Payment — {row.feeName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Correct a mistake</span>
        </div>
        {summary}
        <div>
          <label style={fieldLabel}>Correct Total Paid (UGX) *</label>
          <input {...editForm.register('amountPaid')} type="number" min={0} max={row.amountDue} style={fieldInput} autoFocus />
          {editForm.formState.errors.amountPaid && <p style={fieldErr}>{editForm.formState.errors.amountPaid.message}</p>}
        </div>
        <div style={{
          padding: '0.55rem 0.85rem', borderRadius: 'var(--r)',
          background: newBalEdit <= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
          fontSize: 12.5, fontWeight: 700,
          color: newBalEdit <= 0 ? 'var(--success)' : 'var(--warning)',
        }}>
          Balance after correction: {ugx(newBalEdit)} · {newBalEdit <= 0 ? 'Fully Paid' : 'Outstanding'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={fieldLabel}>Payment Date *</label>
            <input {...editForm.register('paymentDate')} type="date" style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Receipt Number</label>
            <input {...editForm.register('receiptNumber')} style={fieldInput} placeholder="RCT-001" />
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Notes</label>
          <input {...editForm.register('notes')} style={fieldInput} placeholder="Correction reason…" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" type="button" onClick={() => setEditMode(false)}>Back</Button>
          <Button variant="primary" size="md" type="submit" disabled={applyPayment.isPending}>
            {applyPayment.isPending ? 'Saving…' : 'Save Correction'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={(addForm.handleSubmit as any)(onAddSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 2 }}>
        {row.feeName}
      </div>
      {summary}

      {/* Read-only already-paid display */}
      <div>
        <label style={fieldLabel}>Already Paid (UGX)</label>
        <div style={readonlyInput}>{ugx(row.amountPaid)}</div>
      </div>

      {/* Incremental amount to add */}
      <div>
        <label style={fieldLabel}>Add Payment (UGX) *</label>
        <input
          {...addForm.register('amountToAdd')}
          type="number" min={0} max={row.balance}
          style={fieldInput} placeholder="0" autoFocus
        />
        {addForm.formState.errors.amountToAdd && <p style={fieldErr}>{addForm.formState.errors.amountToAdd.message}</p>}
      </div>

      {amountToAdd > 0 && (
        <div style={{
          padding: '0.55rem 0.85rem', borderRadius: 'var(--r)',
          background: newBalAdd <= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${newBalAdd <= 0 ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Balance after payment
          </span>
          <span style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 14, color: newBalAdd <= 0 ? 'var(--success)' : 'var(--warning)' }}>
            {ugx(newBalAdd)}{newBalAdd <= 0 ? ' ✓' : ''}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={fieldLabel}>Payment Date *</label>
          <input {...addForm.register('paymentDate')} type="date" style={fieldInput} />
          {addForm.formState.errors.paymentDate && <p style={fieldErr}>{addForm.formState.errors.paymentDate.message}</p>}
        </div>
        <div>
          <label style={fieldLabel}>Receipt Number</label>
          <input {...addForm.register('receiptNumber')} style={fieldInput} placeholder="RCT-001" />
        </div>
      </div>

      <div>
        <label style={fieldLabel}>Notes (optional)</label>
        <input {...addForm.register('notes')} style={fieldInput} placeholder="e.g. cash payment, bank transfer" />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" type="button" onClick={onDone}>Cancel</Button>
        <Button
          variant="secondary" size="sm" type="button"
          onClick={() => setEditMode(true)}
        >
          Edit Payment
        </Button>
        <Button variant="primary" size="md" type="submit" disabled={applyPayment.isPending || amountToAdd <= 0}>
          {applyPayment.isPending ? 'Saving…' : 'Add Payment'}
        </Button>
      </div>
    </form>
  )
}

// ── New fee row form (creates fresh row) ──────────────────────
function NewFeeRowForm({
  studentId,
  term,
  academicYearId,
  existingRows,
  onDone,
}: {
  studentId:      string
  term:           number
  academicYearId: string | null
  existingRows:   StudentFeeRow[]
  onDone:         () => void
}) {
  const { success: toastOk, error: toastErr } = useToast()
  const addPayment   = useAddPayment()
  const { data: feeStructures = [] } = useFeeStructure()
  const today        = new Date().toISOString().slice(0, 10)

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<NewRowValues>({
    resolver: zodResolver(newRowSchema) as any,
    defaultValues: { paymentDate: today, amountPaid: 0, amountDue: 0 },
  })

  const selectedFsId  = watch('feeStructureId')
  const selectedFs    = feeStructures.find(f => f.id === selectedFsId)
  // Find any existing payment row for this fee structure so we can show prior paid amount
  const existingRow   = existingRows.find(r => r.feeStructureId === selectedFsId) ?? null

  // Auto-fill amount due when fee structure changes
  useEffect(() => {
    if (selectedFs) setValue('amountDue', selectedFs.amount)
  }, [selectedFs, setValue])

  const watchedDue  = Number(watch('amountDue')  ?? 0)
  const watchedPaid = Number(watch('amountPaid') ?? 0)
  const alreadyPaid = existingRow?.amountPaid ?? 0
  const liveBalance = watchedDue - (alreadyPaid + watchedPaid)

  const fieldLabel: React.CSSProperties = {
    display:       'block',
    fontSize:      11,
    fontWeight:    700,
    color:         'var(--txt2)',
    marginBottom:  4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily:    'var(--font2)',
  }
  const fieldInput: React.CSSProperties = {
    width:        '100%',
    padding:      '0.55rem 0.85rem',
    border:       '1.5px solid var(--border)',
    borderRadius: 'var(--r)',
    background:   'var(--surface)',
    color:        'var(--txt)',
    fontSize:     13,
    fontFamily:   'var(--font1)',
    outline:      'none',
    boxSizing:    'border-box',
  }
  const fieldErr: React.CSSProperties = { fontSize: 11, color: 'var(--danger)', marginTop: 3 }

  const onSubmit: SubmitHandler<NewRowValues> = async values => {
    try {
      await addPayment.mutateAsync({
        studentId,
        feeStructureId: values.feeStructureId || null,
        academicYearId: academicYearId,
        amountDue:     values.amountDue,
        amountPaid:    values.amountPaid,
        paymentDate:   values.paymentDate,
        receiptNumber: values.receiptNumber || null,
        notes:         values.notes || null,
        term,
      })
      toastOk(`Payment of ${ugx(values.amountPaid)} recorded`)
      onDone()
    } catch (e: any) {
      toastErr(e.message)
    }
  }

  return (
    <form onSubmit={(handleSubmit as any)(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      <div>
        <label style={fieldLabel}>Fee Structure Item (optional)</label>
        <select {...register('feeStructureId')} style={{ ...fieldInput }}>
          <option value="">— Manual entry —</option>
          {feeStructures.filter(f => f.isActive).map(f => (
            <option key={f.id} value={f.id}>
              {f.name} ({ugx(f.amount)})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={fieldLabel}>Amount Due (UGX)</label>
          <input
            {...register('amountDue')}
            type="number"
            min={0}
            readOnly={!!selectedFs}
            style={{
              ...fieldInput,
              background: selectedFs ? 'var(--surface2)' : 'var(--surface)',
              color:      selectedFs ? 'var(--txt2)'    : 'var(--txt)',
              cursor:     selectedFs ? 'default'        : 'text',
            }}
            placeholder="800000"
          />
          {errors.amountDue && <p style={fieldErr}>{errors.amountDue.message}</p>}
        </div>
        <div>
          <label style={fieldLabel}>
            {existingRow ? 'Previously Paid (UGX)' : 'Amount Paid (UGX) *'}
          </label>
          {existingRow ? (
            <div style={{
              ...fieldInput,
              background:  'var(--surface2)',
              color:       'var(--success)',
              fontFamily:  'var(--font3)',
              fontWeight:  700,
              cursor:      'default',
              display:     'flex',
              alignItems:  'center',
            }}>
              {ugx(alreadyPaid)}
            </div>
          ) : (
            <input {...register('amountPaid')} type="number" min={0} style={fieldInput} placeholder="0" />
          )}
          {errors.amountPaid && !existingRow && <p style={fieldErr}>{errors.amountPaid.message}</p>}
        </div>
      </div>

      {/* If existing row: show "Add Payment" as a separate field */}
      {existingRow && (
        <div>
          <label style={fieldLabel}>Add Payment Now (UGX) *</label>
          <input {...register('amountPaid')} type="number" min={0} style={fieldInput} placeholder="0" autoFocus />
          {errors.amountPaid && <p style={fieldErr}>{errors.amountPaid.message}</p>}
        </div>
      )}

      {(watchedDue > 0 || watchedPaid > 0 || alreadyPaid > 0) && (
        <div style={{
          padding:      '0.6rem 0.85rem',
          borderRadius: 'var(--r)',
          background:   liveBalance <= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
          border:       `1px solid ${liveBalance <= 0 ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}`,
          display:      'flex',
          justifyContent: 'space-between',
          alignItems:   'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Balance after payment
          </span>
          <span style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 14, color: liveBalance <= 0 ? 'var(--success)' : 'var(--warning)' }}>
            {ugx(Math.max(0, liveBalance))}{liveBalance <= 0 ? ' ✓' : ''}
          </span>
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
        <Button variant="ghost" size="sm" type="button" onClick={onDone}>Cancel</Button>
        <Button variant="primary" size="md" type="submit" disabled={addPayment.isPending}>
          {addPayment.isPending ? 'Saving…' : 'Record Payment'}
        </Button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────
export function AddPaymentPage() {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [term, setTerm]                       = useState<1 | 2 | 3>(1)
  const [year, setYear]                       = useState(CURRENT_YEAR)

  // Which existing fee row is selected for payment, or 'new' to create one
  const [activeRowId, setActiveRowId]         = useState<string | 'new' | null>(null)

  const { data: feeRows = [], isLoading: loadingRows } = useStudentFeeRows(
    selectedStudent?.id ?? null,
    term,
  )

  // Derive academic year id from the first fee row that has one
  const academicYearId = feeRows.find(r => r.academicYearId)?.academicYearId ?? null

  const handleTermChange = useCallback((t: 1 | 2 | 3) => {
    setTerm(t)
    setActiveRowId(null)
  }, [])

  const handleStudentSelect = useCallback((s: Student | null) => {
    setSelectedStudent(s)
    setActiveRowId(null)
  }, [])

  const selectedRow = feeRows.find(r => r.id === activeRowId) ?? null

  const totalDue     = feeRows.reduce((a, r) => a + r.amountDue,  0)
  const totalPaid    = feeRows.reduce((a, r) => a + r.amountPaid, 0)
  const totalBalance = feeRows.reduce((a, r) => a + r.balance,    0)

  return (
    <div className="sui-page-enter" style={{ padding: '1.5rem 2rem', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(16,185,129,.45)', flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Add Payment</h1>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Record a fee payment for a student</p>
        </div>
      </div>

      <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: Student finder + fee summary ─── */}
        <div className="sui-glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Term + Year selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
              {([1, 2, 3] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTermChange(t)}
                  style={{
                    padding:    '0.22rem 0.75rem',
                    border:     'none',
                    borderRadius: 20,
                    background: term === t ? 'var(--brand)' : 'transparent',
                    color:      term === t ? '#fff' : 'var(--txt3)',
                    fontFamily: 'var(--font2)',
                    fontWeight: 700,
                    fontSize:   12,
                    cursor:     'pointer',
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
            onSelect={handleStudentSelect}
            term={term}
          />

          {/* Fee rows for selected student */}
          {selectedStudent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Term {term} {year} — Fee Records
              </div>

              {loadingRows && (
                <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '0.5rem 0' }}>Loading…</div>
              )}

              {!loadingRows && feeRows.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '0.5rem 0' }}>
                  No fee records for this term. Use "Add New Fee Entry" below.
                </div>
              )}

              {feeRows.map(row => (
                <FeeRowCard
                  key={row.id}
                  row={row}
                  selected={activeRowId === row.id}
                  onSelect={() => setActiveRowId(prev => prev === row.id ? null : row.id)}
                />
              ))}

              {/* Balance summary */}
              {feeRows.length > 0 && (
                <div style={{
                  background:   'var(--surface)',
                  borderRadius: 'var(--r)',
                  padding:      '0.65rem 0.85rem',
                  border:       '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                    Term Total
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Amount Due</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{ugx(totalDue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Total Paid</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--success)' }}>{ugx(totalPaid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Outstanding</span>
                    <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font3)', color: totalBalance <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {ugx(Math.max(0, totalBalance))}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveRowId('new')}
                style={{
                  padding:      '0.5rem 0.85rem',
                  border:       `1.5px dashed ${activeRowId === 'new' ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius: 'var(--r)',
                  background:   activeRowId === 'new' ? 'var(--brand-light)' : 'transparent',
                  color:        'var(--brand)',
                  fontSize:     12,
                  fontWeight:   700,
                  cursor:       'pointer',
                  fontFamily:   'var(--font2)',
                  textAlign:    'left',
                }}
              >
                + Add New Fee Entry
              </button>
            </div>
          )}

          {!selectedStudent && (
            <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '1rem 0' }}>
              Search for a student above to view their fee records
            </div>
          )}
        </div>

        {/* ── RIGHT: Payment form ─────────────────── */}
        <div style={{
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding:      '1.25rem',
          minHeight:    240,
        }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: '1.25rem' }}>
            {activeRowId === 'new' ? 'New Fee Entry' : activeRowId ? 'Apply Payment' : 'Payment Details'}
          </div>

          {!selectedStudent && (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--txt3)', paddingTop: '2rem' }}>
              Select a student on the left to begin
            </div>
          )}

          {selectedStudent && !activeRowId && (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--txt3)', paddingTop: '2rem' }}>
              {feeRows.length > 0
                ? 'Select a fee record on the left to apply a payment, or click "+ Add New Fee Entry"'
                : 'Click "+ Add New Fee Entry" on the left to create a new fee record'}
            </div>
          )}

          {selectedStudent && activeRowId === 'new' && (
            <NewFeeRowForm
              studentId={selectedStudent.id}
              term={term}
              academicYearId={academicYearId}
              existingRows={feeRows}
              onDone={() => setActiveRowId(null)}
            />
          )}

          {selectedStudent && selectedRow && (
            <ApplyPaymentForm
              key={selectedRow.id}
              row={selectedRow}
              onDone={() => setActiveRowId(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
