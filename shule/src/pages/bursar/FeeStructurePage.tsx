import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SubmitHandler } from 'react-hook-form'
import {
  useFeeStructure, useAcademicYears, useAddFeeType,
  useUpdateFeeAmount, useToggleFeeActive, useDeleteFeeType, useAutoChargeFees,
  type AddFeeTypeInput,
} from '../../hooks/useFeeStructure'
import { useClasses } from '../../hooks/useClasses'
import { ugx } from '../../hooks/useFeePayments'
import { useToast } from '../../components/ui/Toast'
import type { FeeStructure } from '../../types/app'

// ─── Zod schema ───────────────────────────────────────────────────────────────
const AddFeeSchema = z.object({
  name:           z.string().min(2, 'Name is required'),
  amount:         z.coerce.number().positive('Must be > 0'),
  appliesTo:      z.enum(['all', 'boarders', 'day_scholars']),
  term:           z.coerce.number().int().min(1).max(3),
  academicYearId: z.string().min(1, 'Select a year'),
  classId:        z.string().nullable(),
  isCompulsory:   z.boolean(),
  autoCharge:     z.boolean(),
})
type AddFeeForm = z.infer<typeof AddFeeSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────
const APPLIES_LABEL: Record<FeeStructure['appliesTo'], string> = {
  all:          'All Students',
  boarders:     'Boarders Only',
  day_scholars: 'Day Scholars Only',
}

function portal() { return (document.querySelector('.ar') as HTMLElement) ?? document.body }
function ini(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }

// ─── Inline editable amount ───────────────────────────────────────────────────
function AmountCell({ fee }: { fee: FeeStructure }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(fee.amount))
  const update = useUpdateFeeAmount()

  async function commit() {
    setEditing(false)
    const n = parseFloat(draft)
    if (isNaN(n) || n === fee.amount || n <= 0) return
    await update.mutateAsync({ id: fee.id, amount: n })
  }

  if (editing) return (
    <input
      type="number" autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { void commit() }}
      onKeyDown={e => e.key === 'Enter' && void commit()}
      style={{ width: 100, padding: '4px 8px', borderRadius: 8, border: '1.5px solid var(--brand)', fontSize: 13, fontFamily: 'var(--font3)', background: 'var(--brand-light)', color: 'var(--txt)', outline: 'none' }}
    />
  )

  return (
    <button onClick={() => { setDraft(String(fee.amount)); setEditing(true) }}
      title="Click to edit"
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
      {ugx(fee.amount)}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  )
}

// ─── Fee row card ─────────────────────────────────────────────────────────────
function FeeCard({ fee, className, onDelete, onAutoCharge }: {
  fee: FeeStructure; className: string | null
  onDelete: () => void; onAutoCharge: () => void
}) {
  const toggle = useToggleFeeActive()
  const [hovered, setHovered] = useState(false)

  const accentColor = fee.isCompulsory ? 'var(--brand)' : 'var(--violet)'

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', borderRadius: 14,
        border: `1px solid ${hovered ? accentColor : 'var(--border)'}`,
        overflow: 'hidden', transition: 'border-color .15s, box-shadow .15s',
        boxShadow: hovered ? `0 4px 20px rgba(0,0,0,.08)` : '0 1px 3px rgba(0,0,0,.04)',
        opacity: fee.isActive ? 1 : .55,
      }}
    >
      {/* Top accent strip */}
      <div style={{ height: 3, background: fee.isActive ? accentColor : 'var(--border)' }} />

      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Left: icon */}
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `${accentColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        </div>

        {/* Middle: info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 7 }}>
            {fee.name}
            {fee.isCompulsory
              ? <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--brand)', background: 'var(--brand-light)', border: '.5px solid rgba(13,148,136,.2)', borderRadius: 99, padding: '1px 7px', letterSpacing: .3 }}>COMPULSORY</span>
              : <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--violet)', background: 'rgba(139,92,246,.08)', border: '.5px solid rgba(139,92,246,.2)', borderRadius: 99, padding: '1px 7px', letterSpacing: .3 }}>OPTIONAL</span>
            }
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
              Term {fee.term}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
              {APPLIES_LABEL[fee.appliesTo]}
            </span>
            {className && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--info)', background: 'rgba(14,165,233,.08)', border: '.5px solid rgba(14,165,233,.2)', borderRadius: 6, padding: '2px 8px' }}>
                {className}
              </span>
            )}
          </div>
        </div>

        {/* Right: amount + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <AmountCell fee={fee} />
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={onAutoCharge}
              title="Auto-charge all matching students"
              style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: 'rgba(13,148,136,.1)', color: 'var(--brand)', fontWeight: 700, fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><line x1="19" y1="6" x2="19" y2="12"/><line x1="22" y1="9" x2="16" y2="9"/></svg>
              Charge
            </button>
            <button onClick={() => toggle.mutate({ id: fee.id, isActive: !fee.isActive })}
              style={{ padding: '4px 10px', borderRadius: 8, border: `.5px solid var(--border)`, background: 'var(--surface2)', color: 'var(--txt3)', fontWeight: 700, fontSize: 10.5, cursor: 'pointer' }}>
              {fee.isActive ? 'Disable' : 'Enable'}
            </button>
            <button onClick={onDelete}
              style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,.08)', color: 'var(--danger)', cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Fee Modal ────────────────────────────────────────────────────────────
function AddFeeModal({ onClose }: { onClose: () => void }) {
  const { data: years = [] }   = useAcademicYears()
  const { data: classes = [] } = useClasses()
  const addMut      = useAddFeeType()
  const chargeMut   = useAutoChargeFees()
  const { success: ok, error: err } = useToast()

  const activeYear = years.find(y => y.isActive) ?? years[0]

  const { control, register, watch, handleSubmit, formState: { errors } } = useForm<AddFeeForm>({
    resolver: zodResolver(AddFeeSchema),
    defaultValues: {
      name: '', amount: 0,
      appliesTo: 'all', term: 1,
      academicYearId: activeYear?.id ?? '',
      classId: null, isCompulsory: true, autoCharge: true,
    },
  })

  const onSubmit: SubmitHandler<AddFeeForm> = async data => {
    try {
      const input: AddFeeTypeInput = {
        name: data.name.trim(), amount: data.amount,
        appliesTo: data.appliesTo, term: data.term as 1|2|3,
        academicYearId: data.academicYearId,
        classId: data.classId || null,
        isCompulsory: data.isCompulsory,
      }
      const newId = await addMut.mutateAsync(input)

      if (data.autoCharge && newId) {
        const year = years.find(y => y.id === data.academicYearId)
        const chargeYear = year ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
        const result = await chargeMut.mutateAsync({
          feeStructureId: newId, classId: data.classId || null,
          appliesTo: data.appliesTo, term: data.term,
          year: chargeYear, amount: data.amount,
          academicYearId: data.academicYearId,
        })
        ok(`Fee created · ${result.charged} student(s) auto-charged`)
      } else {
        ok('Fee structure added')
      }
      onClose()
    } catch (e: any) { err(e.message ?? 'Failed to add fee') }
  }

  const autoCharge = watch('autoCharge')
  const classId    = watch('classId')
  const appliesTo  = watch('appliesTo')

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '90dvh', borderRadius: 24, overflow: 'hidden', background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', animation: 'discCenterIn .26s cubic-bezier(.32,.72,0,1) both' }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 16px', background: 'linear-gradient(135deg,rgba(13,148,136,.1),transparent)', borderBottom: '.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: 'var(--txt)', letterSpacing: -.3 }}>Define Fee Structure</div>
          <div style={{ fontSize: 12.5, color: 'var(--txt3)', marginTop: 3 }}>Add a compulsory or optional fee item for a term</div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Name */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 5 }}>Fee Name *</label>
              <input className="sui-input" placeholder="e.g. School Fees, Boarding Fees, Library" {...register('name')} style={{ width: '100%' }} />
              {errors.name && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{errors.name.message}</div>}
            </div>

            {/* Amount */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 5 }}>Amount (UGX) *</label>
              <input className="sui-input" type="number" min="0" placeholder="0" {...register('amount')} style={{ width: '100%', fontFamily: 'var(--font3)' }} />
              {errors.amount && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{errors.amount.message}</div>}
            </div>

            {/* Term */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 5 }}>Term *</label>
              <Controller name="term" control={control} render={({ field }) => (
                <select className="sui-input" {...field} style={{ width: '100%' }}>
                  <option value={1}>Term 1</option>
                  <option value={2}>Term 2</option>
                  <option value={3}>Term 3</option>
                </select>
              )} />
            </div>

            {/* Academic year */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 5 }}>Academic Year *</label>
              <Controller name="academicYearId" control={control} render={({ field }) => (
                <select className="sui-input" {...field} style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Current)' : ''}</option>)}
                </select>
              )} />
              {errors.academicYearId && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{errors.academicYearId.message}</div>}
            </div>

            {/* Class */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 5 }}>Class (leave blank = all)</label>
              <Controller name="classId" control={control} render={({ field }) => (
                <select className="sui-input" value={field.value ?? ''} onChange={e => field.onChange(e.target.value || null)} style={{ width: '100%' }}>
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )} />
            </div>

            {/* Applies to */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 5 }}>Applies To *</label>
              <Controller name="appliesTo" control={control} render={({ field }) => (
                <select className="sui-input" {...field} style={{ width: '100%' }}>
                  <option value="all">All Students</option>
                  <option value="boarders">Boarders Only</option>
                  <option value="day_scholars">Day Scholars Only</option>
                </select>
              )} />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['isCompulsory', 'autoCharge'] as const).map(key => {
              const labels = {
                isCompulsory: { label: 'Compulsory payment', sub: 'Students must pay this fee' },
                autoCharge:   { label: 'Auto-charge matching students', sub: `Creates payment records for all ${appliesTo === 'all' ? '' : appliesTo + ' '}students${classId ? ' in selected class' : ''}` },
              }
              const l = labels[key]
              return (
                <Controller key={key} name={key} control={control} render={({ field }) => (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `.5px solid ${field.value ? 'var(--brand)' : 'var(--border)'}`, background: field.value ? 'var(--brand-light)' : 'var(--surface2)', cursor: 'pointer', transition: 'all .14s' }}>
                    <div style={{ width: 42, height: 24, borderRadius: 99, background: field.value ? 'var(--brand)' : 'var(--border)', position: 'relative', transition: 'background .14s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: field.value ? 20 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .14s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{l.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{l.sub}</div>
                    </div>
                    <input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)} style={{ display: 'none' }} />
                  </label>
                )} />
              )
            })}
          </div>

          {autoCharge && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(13,148,136,.06)', border: '.5px solid rgba(13,148,136,.2)', fontSize: 12, color: 'var(--brand)', lineHeight: 1.6 }}>
              <strong>Auto-charge on:</strong> Saves time by automatically creating fee payment entries for all matching students right after you add this fee.
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', borderTop: '.5px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '.5px solid var(--border)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={addMut.isPending || chargeMut.isPending}
            style={{ flex: 2, height: 44, borderRadius: 12, border: 'none', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.4)', opacity: (addMut.isPending || chargeMut.isPending) ? .7 : 1 }}>
            {addMut.isPending ? 'Adding…' : chargeMut.isPending ? 'Charging students…' : 'Add Fee'}
          </button>
        </div>
      </div>
    </div>,
    portal()
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function FeeStructurePage() {
  const [showAdd,  setShowAdd]  = useState(false)
  const [filterTerm, setFilterTerm] = useState<number | null>(null)
  const [filterClass, setFilterClass] = useState<string | null>(null)
  const { data: years = [] }    = useAcademicYears()
  const { data: classes = [] }  = useClasses()
  const { data: fees = [], isLoading } = useFeeStructure()
  const deleteMut   = useDeleteFeeType()
  const chargeMut   = useAutoChargeFees()
  const { success: ok, error: err } = useToast()

  const activeYear = years.find(y => y.isActive) ?? years[0]

  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])

  const filtered = useMemo(() => {
    let f = fees
    if (filterTerm)  f = f.filter(fee => fee.term === filterTerm)
    if (filterClass) f = f.filter(fee => fee.classId === filterClass || fee.classId === null)
    return f
  }, [fees, filterTerm, filterClass])

  // Group by term
  const byTerm = useMemo(() => {
    const map = new Map<number, FeeStructure[]>()
    for (const f of filtered) {
      const arr = map.get(f.term) ?? []
      arr.push(f)
      map.set(f.term, arr)
    }
    return map
  }, [filtered])

  const totalExpected = filtered.filter(f => f.isActive).reduce((s, f) => s + f.amount, 0)
  const compulsoryCount = fees.filter(f => f.isCompulsory && f.isActive).length
  const activeCount     = fees.filter(f => f.isActive).length

  async function handleAutoCharge(fee: FeeStructure) {
    try {
      const year = years.find(y => y.id === fee.academicYearId)
      const chargeYear = year ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
      const result = await chargeMut.mutateAsync({
        feeStructureId: fee.id, classId: fee.classId,
        appliesTo: fee.appliesTo, term: fee.term,
        year: chargeYear, amount: fee.amount, academicYearId: fee.academicYearId,
      })
      ok(`${result.charged} student(s) charged for "${fee.name}"`)
    } catch (e: any) { err(e.message ?? 'Auto-charge failed') }
  }

  async function handleDelete(fee: FeeStructure) {
    if (!confirm(`Delete "${fee.name}"? This cannot be undone.`)) return
    try {
      await deleteMut.mutateAsync(fee.id)
      ok(`"${fee.name}" deleted`)
    } catch (e: any) { err(e.message ?? 'Delete failed') }
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero */}
      <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #0d4d47 100%)', padding: '28px 28px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(13,148,136,.15)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -.4 }}>Fee Structure</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 12.5, margin: '0 0 20px' }}>
            {activeYear ? `${activeYear.name} — ` : ''}Define fees by class, student type, and term
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: 'Active Fees',      value: activeCount },
              { label: 'Compulsory',       value: compulsoryCount },
              { label: 'Total per Filter', value: ugx(totalExpected) },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.15)', borderRadius: 12, padding: '10px 16px' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: typeof k.value === 'string' ? 'var(--font3)' : 'var(--font2)', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.6)', marginTop: 3, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
            <button onClick={() => setShowAdd(true)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.45)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Fee Item
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="sui-input" value={filterTerm ?? ''} onChange={e => setFilterTerm(e.target.value ? Number(e.target.value) : null)} style={{ minWidth: 120 }}>
          <option value="">All Terms</option>
          <option value={1}>Term 1</option>
          <option value={2}>Term 2</option>
          <option value={3}>Term 3</option>
        </select>
        <select className="sui-input" value={filterClass ?? ''} onChange={e => setFilterClass(e.target.value || null)} style={{ minWidth: 160 }}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(filterTerm || filterClass) && (
          <button onClick={() => { setFilterTerm(null); setFilterClass(null) }}
            style={{ padding: '7px 14px', borderRadius: 9, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)' }}>
          {filtered.length} fee item{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 14 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(13,148,136,.08)', border: '1px dashed rgba(13,148,136,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', marginBottom: 6 }}>No fee items yet</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Add fee items to define what students are charged each term.</div>
          </div>
          <button onClick={() => setShowAdd(true)}
            style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.35)' }}>
            + Add First Fee
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {[1, 2, 3].map(term => {
            const termFees = byTerm.get(term)
            if (!termFees?.length) return null
            const termTotal = termFees.filter(f => f.isActive).reduce((s, f) => s + f.amount, 0)
            return (
              <div key={term}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Term {term}</div>
                  <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{ugx(termTotal)} total</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
                  {termFees.map(fee => (
                    <FeeCard
                      key={fee.id} fee={fee}
                      className={fee.classId ? (classMap.get(fee.classId) ?? null) : null}
                      onDelete={() => handleDelete(fee)}
                      onAutoCharge={() => handleAutoCharge(fee)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddFeeModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
