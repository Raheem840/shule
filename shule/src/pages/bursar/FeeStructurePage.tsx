import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SubmitHandler } from 'react-hook-form'
import { PageHeader }     from '../../components/ui/PageHeader'
import { Button }         from '../../components/ui/Button'
import { Modal }          from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Badge }          from '../../components/ui/Badge'
import {
  useFeeStructure, useAcademicYears,
  useAddFeeType, useUpdateFeeAmount, useToggleFeeActive,
  type AddFeeTypeInput,
} from '../../hooks/useFeeStructure'
import { ugx } from '../../hooks/useFeePayments'
import type { FeeStructure } from '../../types/app'

// ── Zod schema for Add Fee Type form ──────────────────────────
export const AddFeeSchema = z.object({
  name:           z.string().min(2, 'Name is required'),
  amount:         z.coerce.number().positive('Must be a positive amount'),
  appliesTo:      z.enum(['all', 'boarders', 'day_scholars']),
  term:           z.coerce.number().int().min(1).max(3),
  academicYearId: z.string().min(1, 'Select an academic year'),
})
type AddFeeFormValues = z.infer<typeof AddFeeSchema>

// ── APPLIES_TO labels ─────────────────────────────────────────
const APPLIES_LABELS: Record<FeeStructure['appliesTo'], string> = {
  all:          'All Students',
  boarders:     'Boarders',
  day_scholars: 'Day Scholars',
}

// ── Inline editable amount cell ───────────────────────────────
function AmountCell({ fee }: { fee: FeeStructure }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(fee.amount))
  const update = useUpdateFeeAmount()
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(String(fee.amount))
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  async function commitEdit() {
    setEditing(false)
    const newAmount = parseFloat(draft)
    if (isNaN(newAmount) || newAmount === fee.amount || newAmount <= 0) return
    await update.mutateAsync({ id: fee.id, amount: newAmount })
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        aria-label="Edit fee amount"
        onChange={e => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          width: 120, padding: '0.25rem 0.5rem',
          border: '1.5px solid var(--brand)', borderRadius: 'var(--r)',
          background: 'var(--surface)', color: 'var(--txt)',
          fontFamily: 'var(--font3)', fontSize: 13, outline: 'none',
        }}
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      title="Click to edit"
      style={{
        background: 'none', border: 'none', cursor: 'text', padding: '0.25rem 0.4rem',
        fontFamily: 'var(--font3)', fontWeight: 600, fontSize: 13,
        color: 'var(--txt)', borderRadius: 'var(--r)',
        borderBottom: '1px dashed var(--border)',
      }}
    >
      {update.isPending ? '…' : ugx(fee.amount)}
    </button>
  )
}

// ── Active toggle ─────────────────────────────────────────────
function ActiveToggle({ fee }: { fee: FeeStructure }) {
  const toggle = useToggleFeeActive()

  return (
    <button
      onClick={() => toggle.mutate({ id: fee.id, isActive: !fee.isActive })}
      disabled={toggle.isPending}
      aria-label={fee.isActive ? 'Deactivate fee type' : 'Activate fee type'}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: fee.isActive ? 'var(--brand)' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: fee.isActive ? 18 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ── Add Fee Type modal ────────────────────────────────────────
function AddFeeModal({
  onClose,
  defaultYearId,
}: {
  onClose: () => void
  defaultYearId: string
}) {
  const { data: years } = useAcademicYears()
  const addFee = useAddFeeType()

  const { register, handleSubmit, formState: { errors } } = useForm<AddFeeFormValues>({
    resolver: zodResolver(AddFeeSchema) as any,
    defaultValues: {
      name: '', amount: 0, appliesTo: 'all', term: 1, academicYearId: defaultYearId,
    },
  })

  const onSubmit: SubmitHandler<AddFeeFormValues> = async (values) => {
    await addFee.mutateAsync(values as AddFeeTypeInput)
    onClose()
  }

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--txt2)', marginBottom: 4,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
    fontFamily: 'var(--font2)',
  }
  const inputStyle = {
    width: '100%', padding: '0.55rem 0.85rem',
    border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
    background: 'var(--surface)', color: 'var(--txt)',
    fontSize: 13, fontFamily: 'var(--font1)', outline: 'none',
    boxSizing: 'border-box' as const,
  }
  const errStyle = { fontSize: 11, color: 'var(--danger)', marginTop: 3 }

  return (
    <Modal isOpen onClose={onClose} title="Add Fee Type" size="sm">
      <form onSubmit={(handleSubmit as any)(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <div>
          <label style={labelStyle}>Fee Name</label>
          <input {...register('name')} placeholder="e.g. School Fees, Boarding Fees" style={inputStyle} />
          {errors.name && <p style={errStyle}>{errors.name.message}</p>}
        </div>

        <div>
          <label style={labelStyle}>Amount (UGX)</label>
          <input {...register('amount')} type="number" placeholder="800000" style={inputStyle} />
          {errors.amount && <p style={errStyle}>{errors.amount.message}</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Applies To</label>
            <select {...register('appliesTo')} style={inputStyle}>
              <option value="all">All Students</option>
              <option value="boarders">Boarders</option>
              <option value="day_scholars">Day Scholars</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Term</label>
            <select {...register('term')} style={inputStyle}>
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Academic Year</label>
          <select {...register('academicYearId')} style={inputStyle}>
            {(years ?? []).map(y => (
              <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>
            ))}
          </select>
          {errors.academicYearId && <p style={errStyle}>{errors.academicYearId.message}</p>}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" disabled={addFee.isPending}>
            {addFee.isPending ? 'Adding…' : 'Add Fee Type'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────
export function FeeStructurePage() {
  const [showAdd,        setShowAdd]        = useState(false)
  const [filterYearId,   setFilterYearId]   = useState<string>('')
  const { data: years }                     = useAcademicYears()
  const { data: fees, isLoading, error }    = useFeeStructure(filterYearId || null)

  const activeYear = years?.find(y => y.isActive)

  const termGroup = (t: 1 | 2 | 3) => (fees ?? []).filter(f => f.term === t)

  const TERM_COLORS = {
    1: { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
    2: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    3: { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 900 }}>
      <PageHeader
        title="Fee Structure"
        subtitle="Manage fee types, amounts, and term assignments"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={filterYearId}
              onChange={e => setFilterYearId(e.target.value)}
              aria-label="Filter by academic year"
              style={{
                padding: '0.45rem 0.85rem', border: '1.5px solid var(--border)',
                borderRadius: 'var(--r)', background: 'var(--surface)',
                color: 'var(--txt)', fontSize: 13, fontFamily: 'var(--font1)',
              }}
            >
              <option value="">All Years</option>
              {(years ?? []).map(y => (
                <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' ✓' : ''}</option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              + Add Fee Type
            </Button>
          </div>
        }
      />

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'var(--danger-bg)', borderRadius: 'var(--r)', color: 'var(--danger)', fontSize: 13 }}>
          Failed to load fee structure: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && ([1, 2, 3] as const).map(t => {
        const group = termGroup(t)
        if (group.length === 0) return null
        const c = TERM_COLORS[t]
        return (
          <div key={t} style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem',
            }}>
              <div style={{
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 20, padding: '3px 12px',
                fontSize: 12, fontWeight: 800, color: c.text, fontFamily: 'var(--font2)',
              }}>
                Term {t}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                {group.length} fee type{group.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Fee Name', 'Amount (UGX)', 'Applies To', 'Status'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', fontSize: 10, fontWeight: 700,
                        color: 'var(--txt3)', padding: '0.6rem 1rem',
                        textTransform: 'uppercase', letterSpacing: 0.8,
                        fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.map(fee => (
                    <tr
                      key={fee.id}
                      className="sui-tr"
                      style={{ opacity: fee.isActive ? 1 : 0.45 }}
                    >
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>{fee.name}</div>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <AmountCell fee={fee} />
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <Badge variant="muted" size="sm">{APPLIES_LABELS[fee.appliesTo]}</Badge>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ActiveToggle fee={fee} />
                          <span style={{ fontSize: 12, color: fee.isActive ? 'var(--success)' : 'var(--txt3)' }}>
                            {fee.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {!isLoading && !error && (fees ?? []).length === 0 && (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗂️</div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>
            No fee types yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: '1rem' }}>
            Click "Add Fee Type" to define the first fee for this academic year.
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>Add Fee Type</Button>
        </div>
      )}

      {showAdd && (
        <AddFeeModal
          onClose={() => setShowAdd(false)}
          defaultYearId={activeYear?.id ?? years?.[0]?.id ?? ''}
        />
      )}
    </div>
  )
}
