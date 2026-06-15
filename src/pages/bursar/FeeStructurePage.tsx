import { useState, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SubmitHandler } from 'react-hook-form'
import {
  useFeeStructure, useAcademicYears, useAddFeeType,
  useUpdateFeeAmount, useUpdateFeeItem, useToggleFeeActive, useDeleteFeeType, useAutoChargeFees,
  useUnchargedCounts,
  type AddFeeTypeInput,
} from '../../hooks/useFeeStructure'
import { useClasses } from '../../hooks/useClasses'
import { ugx } from '../../hooks/useFeePayments'
import { useToast } from '../../components/ui/Toast'
import type { FeeStructure } from '../../types/app'

// ─── Fee structure import types ───────────────────────────────────────────────
type ImportRow = {
  name:         string
  amount:       number
  applies_to:   'all' | 'boarders' | 'day_scholars'
  term:         1 | 2 | 3
  is_compulsory: boolean
  class_name:   string
  _error?:      string
}

// ─── Import fee structure modal ───────────────────────────────────────────────
function ImportFeeStructureModal({ onClose }: { onClose: () => void }) {
  const { data: years   = [] } = useAcademicYears()
  const { data: classes = [] } = useClasses()
  const addMut = useAddFeeType()
  const { success: ok, error: err } = useToast()

  const [step,        setStep]        = useState<'upload' | 'preview' | 'done'>('upload')
  const [rawText,     setRawText]     = useState('')
  const [rows,        setRows]        = useState<ImportRow[]>([])
  const [yearId,      setYearId]      = useState(years.find(y => y.isActive)?.id ?? years[0]?.id ?? '')
  const [importing,   setImporting]   = useState(false)
  const [result,      setResult]      = useState<{ imported: number; failed: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Sync yearId when years load
  useMemo(() => {
    if (!yearId && years.length) setYearId(years.find(y => y.isActive)?.id ?? years[0]?.id ?? '')
  }, [years])

  const classMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of classes) m.set(c.name.toLowerCase().trim(), c.id)
    return m
  }, [classes])

  const APPLIES_OPTIONS = ['all', 'boarders', 'day_scholars'] as const
  const SAMPLE_CSV =
    'name,amount,applies_to,term,is_compulsory,class_name\n' +
    'School Fees S1,750000,all,1,true,S1\n' +
    'School Fees S2,750000,all,1,true,S2\n' +
    'School Fees S3,800000,all,1,true,S3\n' +
    'School Fees S4,850000,all,1,true,S4\n' +
    'School Fees S5,900000,all,1,true,S5\n' +
    'School Fees S6,950000,all,1,true,S6\n' +
    'Boarding Fees,600000,boarders,1,true,\n' +
    'Day Scholars Levy,50000,day_scholars,1,true,\n' +
    'Library Levy,25000,all,1,false,\n' +
    'Computer Lab,40000,all,2,false,\n' +
    'Sports & Activities,30000,all,1,false,'

  function parseCSV(text: string): ImportRow[] {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
    if (!lines.length) return []
    const header = lines[0].toLowerCase().split(',').map(h => h.trim())
    const idx = (name: string) => header.indexOf(name)

    return lines.slice(1).map((line, _i) => {
      const cols = line.split(',').map(c => c.trim())
      const get  = (name: string) => cols[idx(name)] ?? ''

      const name   = get('name')
      const amount = parseFloat(get('amount').replace(/[^0-9.]/g, ''))
      const at     = get('applies_to').toLowerCase() as ImportRow['applies_to']
      const term   = parseInt(get('term'), 10) as 1 | 2 | 3
      const comp   = get('is_compulsory').toLowerCase()
      const cls    = get('class_name').trim()

      let _error: string | undefined
      if (!name)                             _error = 'Missing name'
      else if (isNaN(amount) || amount <= 0) _error = 'Invalid amount'
      else if (!APPLIES_OPTIONS.includes(at)) _error = `applies_to must be all/boarders/day_scholars`
      else if (![1, 2, 3].includes(term))    _error = 'term must be 1, 2 or 3'
      else if (cls && !classMap.has(cls.toLowerCase())) _error = `Class "${cls}" not found`

      return {
        name, amount, applies_to: at, term, class_name: cls,
        is_compulsory: comp !== 'false' && comp !== '0',
        _error,
      } satisfies ImportRow
    })
  }

  function handleParse() {
    if (!rawText.trim()) return
    const parsed = parseCSV(rawText)
    setRows(parsed)
    setStep('preview')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setRawText((ev.target?.result as string) ?? '')
    reader.readAsText(file)
  }

  async function handleImport() {
    const valid = rows.filter(r => !r._error)
    if (!valid.length) { err('No valid rows to import'); return }
    if (!yearId) { err('Select an academic year first'); return }
    setImporting(true)
    const failed: string[] = []
    let imported = 0
    for (const row of valid) {
      try {
        await addMut.mutateAsync({
          name:           row.name,
          amount:         row.amount,
          appliesTo:      row.applies_to,
          term:           row.term,
          academicYearId: yearId,
          classId:        row.class_name ? (classMap.get(row.class_name.toLowerCase()) ?? null) : null,
          isCompulsory:   row.is_compulsory,
        } satisfies AddFeeTypeInput)
        imported++
      } catch (e: any) {
        failed.push(`"${row.name}": ${e.message ?? 'Failed'}`)
      }
    }
    setResult({ imported, failed })
    setStep('done')
    setImporting(false)
    if (imported) ok(`${imported} fee item${imported !== 1 ? 's' : ''} imported`)
  }

  const valid   = rows.filter(r => !r._error)
  const invalid = rows.filter(r =>  r._error)
  const portal  = document.querySelector('.ar') as HTMLElement ?? document.body

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 640, maxHeight: '90dvh', background: 'var(--surface)', borderRadius: 24, boxShadow: '0 28px 80px rgba(0,0,0,.26)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', background: 'linear-gradient(150deg,rgba(13,148,136,.1),transparent)', borderBottom: '.5px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(13,148,136,.4)' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>Import Fee Structure</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Upload a CSV to bulk-create fee items</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Academic year selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Academic Year *</label>
                <select className="sui-input" value={yearId} onChange={e => setYearId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select year…</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Current)' : ''}</option>)}
                </select>
              </div>

              {/* File upload */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Upload CSV File</label>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 13, color: 'var(--txt3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt3)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Choose CSV file
                </button>
              </div>

              {/* Or paste */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Or Paste CSV Text</label>
                <textarea
                  className="sui-input"
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  rows={7}
                  style={{ width: '100%', fontFamily: 'var(--font3)', fontSize: 12, resize: 'vertical' }}
                  placeholder={SAMPLE_CSV}
                />
              </div>

              {/* Template download */}
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(13,148,136,.06)', border: '.5px solid rgba(13,148,136,.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)', marginBottom: 3 }}>Need a template?</div>
                  <div style={{ fontSize: 11.5, color: 'var(--txt3)', lineHeight: 1.55 }}>
                    Columns: <code style={{ fontFamily: 'var(--font3)', fontSize: 10.5 }}>name, amount, applies_to, term, is_compulsory, class_name</code>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const csv = SAMPLE_CSV
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url  = URL.createObjectURL(blob)
                    const a    = document.createElement('a')
                    a.href     = url
                    a.download = 'fee_structure_template.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flexShrink: 0, boxShadow: '0 3px 10px rgba(13,148,136,.35)', whiteSpace: 'nowrap' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Template
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '.5px solid var(--border)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
                <button onClick={handleParse} disabled={!rawText.trim() || !yearId}
                  style={{ flex: 2, height: 44, borderRadius: 12, border: 'none', background: (!rawText.trim() || !yearId) ? 'var(--surface2)' : 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: (!rawText.trim() || !yearId) ? 'var(--txt3)' : '#fff', fontWeight: 700, fontSize: 13.5, cursor: (!rawText.trim() || !yearId) ? 'not-allowed' : 'pointer' }}>
                  Preview Import →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,.07)', border: '.5px solid rgba(16,185,129,.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font3)', color: 'var(--success)' }}>{valid.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>Valid rows</div>
                </div>
                {invalid.length > 0 && (
                  <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(244,63,94,.07)', border: '.5px solid rgba(244,63,94,.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font3)', color: 'var(--danger)' }}>{invalid.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>Skipped (errors)</div>
                  </div>
                )}
              </div>

              <div style={{ maxHeight: 320, overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Name', 'Amount', 'Applies To', 'Term', 'Compulsory', 'Class', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', background: 'var(--surface2)', fontWeight: 700, fontSize: 10.5, color: 'var(--txt3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: .4, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: r._error ? .6 : 1 }}>
                        <td style={{ padding: '7px 10px', color: 'var(--txt)', fontWeight: 600 }}>{r.name || '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{r.amount > 0 ? ugx(r.amount) : '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--txt2)' }}>{r.applies_to}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--txt2)' }}>T{r.term}</td>
                        <td style={{ padding: '7px 10px', color: r.is_compulsory ? 'var(--brand)' : 'var(--txt3)' }}>{r.is_compulsory ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--txt3)' }}>{r.class_name || 'All'}</td>
                        <td style={{ padding: '7px 10px' }}>
                          {r._error
                            ? <span style={{ fontSize: 10.5, color: 'var(--danger)', background: 'rgba(244,63,94,.1)', padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>{r._error}</span>
                            : <span style={{ fontSize: 10.5, color: 'var(--success)', background: 'rgba(16,185,129,.1)', padding: '2px 7px', borderRadius: 99 }}>✓ Ready</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('upload')} style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '.5px solid var(--border)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>← Back</button>
                <button onClick={() => void handleImport()} disabled={importing || valid.length === 0}
                  style={{ flex: 2, height: 44, borderRadius: 12, border: 'none', background: valid.length === 0 ? 'var(--surface2)' : 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: valid.length === 0 ? 'var(--txt3)' : '#fff', fontWeight: 700, fontSize: 13.5, cursor: (importing || valid.length === 0) ? 'not-allowed' : 'pointer', opacity: importing ? .7 : 1 }}>
                  {importing ? 'Importing…' : `Import ${valid.length} Fee Item${valid.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(16,185,129,.12)', border: '1.5px solid rgba(16,185,129,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: 'var(--txt)' }}>Import Complete</div>
              <div style={{ fontSize: 14, color: 'var(--txt2)' }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>{result.imported}</span> fee item{result.imported !== 1 ? 's' : ''} imported successfully.
              </div>
              {result.failed.length > 0 && (
                <div style={{ background: 'rgba(244,63,94,.06)', border: '.5px solid rgba(244,63,94,.2)', borderRadius: 10, padding: '12px 14px', textAlign: 'left' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{result.failed.length} failed</div>
                  {result.failed.map((f, i) => <div key={i} style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 3 }}>{f}</div>)}
                </div>
              )}
              <button onClick={onClose} style={{ height: 44, borderRadius: 12, border: 'none', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    portal
  )
}

// ─── Zod schema ───────────────────────────────────────────────────────────────
export const AddFeeSchema = z.object({
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
      style={{ width: '100%', maxWidth: 100, padding: '4px 8px', borderRadius: 8, border: '1.5px solid var(--brand)', fontSize: 13, fontFamily: 'var(--font3)', background: 'var(--brand-light)', color: 'var(--txt)', outline: 'none' }}
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

// ─── Edit fee modal ───────────────────────────────────────────────────────────
function EditFeeModal({ fee, onClose }: { fee: FeeStructure; onClose: () => void }) {
  const { data: years   = [] } = useAcademicYears()
  const { data: classes = [] } = useClasses()
  const updateMut = useUpdateFeeItem()
  const { success: ok, error: err } = useToast()

  const [form, setForm] = useState<AddFeeForm>({
    name:           fee.name,
    amount:         fee.amount,
    appliesTo:      fee.appliesTo,
    term:           fee.term,
    academicYearId: fee.academicYearId,
    classId:        fee.classId,
    isCompulsory:   fee.isCompulsory,
    autoCharge:     false,
  })

  const portal = document.querySelector('.ar') as HTMLElement ?? document.body

  async function handleSave() {
    try {
      await updateMut.mutateAsync({ id: fee.id, ...form, term: form.term as 1 | 2 | 3 })
      ok(`"${form.name}" updated`)
      onClose()
    } catch (e: any) { err(e.message ?? 'Update failed') }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.54)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 500, maxHeight: '92dvh', background: 'var(--surface)', borderRadius: 24, boxShadow: '0 28px 80px rgba(0,0,0,.26)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 22px 16px', background: 'linear-gradient(150deg,rgba(13,148,136,.1),transparent)', borderBottom: '.5px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(13,148,136,.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)' }}>Edit Fee Item</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Update fee details for this structure item</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>

          {/* Name */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Fee Name *</label>
            <input className="sui-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ width: '100%' }} placeholder="e.g. School Fees S1" />
          </div>

          {/* Amount + Term */}
          <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Amount (UGX) *</label>
              <input className="sui-input" type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} style={{ width: '100%', fontFamily: 'var(--font3)' }} />
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Term *</label>
              <select className="sui-input" value={form.term} onChange={e => setForm(p => ({ ...p, term: Number(e.target.value) as 1|2|3 }))} style={{ width: '100%' }}>
                <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
              </select>
            </div>
          </div>

          {/* Applies to + Class */}
          <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Applies To *</label>
              <select className="sui-input" value={form.appliesTo} onChange={e => setForm(p => ({ ...p, appliesTo: e.target.value as AddFeeForm['appliesTo'] }))} style={{ width: '100%' }}>
                <option value="all">All Students</option>
                <option value="boarders">Boarders Only</option>
                <option value="day_scholars">Day Scholars Only</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Class</label>
              <select className="sui-input" value={form.classId ?? ''} onChange={e => setForm(p => ({ ...p, classId: e.target.value || null }))} style={{ width: '100%' }}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Academic Year */}
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Academic Year *</label>
            <select className="sui-input" value={form.academicYearId} onChange={e => setForm(p => ({ ...p, academicYearId: e.target.value }))} style={{ width: '100%' }}>
              <option value="">Select…</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Current)' : ''}</option>)}
            </select>
          </div>

          {/* Compulsory toggle */}
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: form.isCompulsory ? 'rgba(13,148,136,.06)' : 'var(--surface2)', border: `.5px solid ${form.isCompulsory ? 'rgba(13,148,136,.25)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all .18s' }}
            onClick={() => setForm(p => ({ ...p, isCompulsory: !p.isCompulsory }))}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Compulsory payment</div>
              <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>Students must pay this fee</div>
            </div>
            <div style={{ position: 'relative', width: 44, height: 24, borderRadius: 99, background: form.isCompulsory ? 'var(--brand)' : 'var(--border)', flexShrink: 0, transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 3, left: form.isCompulsory ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 46, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 13, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
            <button type="button" onClick={() => void handleSave()} disabled={updateMut.isPending || !form.name.trim() || !form.academicYearId}
              style={{ flex: 2, height: 46, background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', border: 'none', borderRadius: 13, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: updateMut.isPending ? .7 : 1 }}>
              {updateMut.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portal
  )
}

// ─── Fee row card ─────────────────────────────────────────────────────────────
function FeeCard({ fee, className, classBadges, onDelete, onAutoCharge, onEnable, unchargedCount }: {
  fee: FeeStructure; className: string | null; classBadges?: string[]
  onDelete: () => void | Promise<void>; onAutoCharge: () => void | Promise<void>; onEnable: () => void | Promise<void>
  unchargedCount?: number
}) {
  const toggle = useToggleFeeActive()
  const [hovered,  setHovered]  = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [charging, setCharging] = useState(false)

  const accentColor = fee.isCompulsory ? 'var(--brand)' : 'var(--violet)'

  async function handleCharge() {
    setCharging(true)
    try { await onAutoCharge() } finally { setCharging(false) }
  }

  return (
    <>
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
            {(classBadges ?? (className ? [className] : [])).map(badge => (
              <span key={badge} style={{ fontSize: 11, fontWeight: 700, color: badge === 'All Classes' ? 'var(--txt3)' : 'var(--info)', background: badge === 'All Classes' ? 'var(--surface2)' : 'rgba(14,165,233,.08)', border: `.5px solid ${badge === 'All Classes' ? 'var(--border)' : 'rgba(14,165,233,.2)'}`, borderRadius: 6, padding: '2px 8px' }}>
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Right: amount + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <AmountCell fee={fee} />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => void handleCharge()}
              disabled={charging}
              title="Bill all uncharged matching students"
              style={{ padding: '8px 12px', minHeight: 36, borderRadius: 8, border: 'none', background: charging ? 'rgba(13,148,136,.06)' : unchargedCount ? 'rgba(244,63,94,.1)' : 'rgba(13,148,136,.1)', color: charging ? 'var(--brand)' : unchargedCount ? 'var(--danger)' : 'var(--brand)', fontWeight: 700, fontSize: 11, cursor: charging ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: charging ? 0.7 : 1 }}>
              {charging
                ? 'Billing…'
                : unchargedCount != null && unchargedCount > 0
                  ? `Bill ${unchargedCount} student${unchargedCount !== 1 ? 's' : ''}`
                  : 'Charge'}
            </button>
            {/* Edit button */}
            <button onClick={() => setEditing(true)}
              title="Edit fee item"
              style={{ padding: '8px', minHeight: 36, minWidth: 36, borderRadius: 8, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .14s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt3)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button
              onClick={async () => {
                const enabling = !fee.isActive
                await toggle.mutateAsync({ id: fee.id, isActive: enabling })
                if (enabling) onEnable()
              }}
              style={{ padding: '8px 12px', minHeight: 36, borderRadius: 8, border: `.5px solid var(--border)`, background: 'var(--surface2)', color: 'var(--txt3)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              {fee.isActive ? 'Disable' : 'Enable'}
            </button>
            <button onClick={onDelete}
              style={{ padding: '8px', minHeight: 36, minWidth: 36, borderRadius: 8, border: 'none', background: 'rgba(244,63,94,.08)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    {editing && <EditFeeModal fee={fee} onClose={() => setEditing(false)} />}
    </>
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
    resolver: zodResolver(AddFeeSchema) as any,
    defaultValues: {
      name: '', amount: 0,
      appliesTo: 'all', term: 1,
      academicYearId: activeYear?.id ?? '',
      classId: null, isCompulsory: true, autoCharge: true,
    },
  })

  // Multi-class selection: empty = all classes, otherwise one fee row per selected class
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  // "Apply to all terms" — creates 3 fee items (T1, T2, T3) in one submit
  const [allTerms, setAllTerms] = useState(false)

  function toggleClass(id: string) {
    setSelectedClassIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }
  function selectAllClasses()  { setSelectedClassIds(classes.map(c => c.id)) }
  function clearClassSelection() { setSelectedClassIds([]) }

  const onSubmit: SubmitHandler<AddFeeForm> = async data => {
    try {
      const classTargets = selectedClassIds.length > 0 ? selectedClassIds : [null]
      const termTargets  = allTerms ? ([1, 2, 3] as const) : [data.term as 1|2|3]
      let totalItems   = 0
      let totalCharged = 0

      for (const term of termTargets) {
        for (const cid of classTargets) {
          const input: AddFeeTypeInput = {
            name: allTerms ? `${data.name.trim()} (T${term})` : data.name.trim(),
            amount: data.amount,
            appliesTo: data.appliesTo, term,
            academicYearId: data.academicYearId,
            classId: cid,
            isCompulsory: data.isCompulsory,
          }
          const newId = await addMut.mutateAsync(input)
          totalItems++

          if (data.autoCharge && newId) {
            const year = years.find(y => y.id === data.academicYearId)
            const chargeYear = year ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
            const result = await chargeMut.mutateAsync({
              feeStructureId: newId, classId: cid,
              appliesTo: data.appliesTo, term,
              year: chargeYear, amount: data.amount,
              academicYearId: data.academicYearId,
            })
            totalCharged += result.charged
          }
        }
      }

      if (data.autoCharge) {
        ok(`${totalItems} fee item(s) created · ${totalCharged} student(s) auto-charged`)
      } else {
        ok(`${totalItems} fee item(s) added`)
      }
      onClose()
    } catch (e: any) { err(e.message ?? 'Failed to add fee') }
  }

  const autoCharge = watch('autoCharge')
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

            {/* Term + All-Terms toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6 }}>Term *</label>
                <button
                  type="button"
                  onClick={() => setAllTerms(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${allTerms ? 'var(--brand)' : 'var(--border)'}`, background: allTerms ? 'var(--brand-light)' : 'var(--surface2)', color: allTerms ? 'var(--brand)' : 'var(--txt3)', transition: 'all .14s' }}
                >
                  <div style={{ width: 26, height: 14, borderRadius: 99, background: allTerms ? 'var(--brand)' : 'var(--border)', position: 'relative', transition: 'background .14s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: allTerms ? 13 : 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', transition: 'left .14s' }} />
                  </div>
                  All Terms
                </button>
              </div>
              <Controller name="term" control={control} render={({ field }) => (
                <select className="sui-input" {...field} disabled={allTerms} style={{ width: '100%', opacity: allTerms ? .5 : 1 }}>
                  <option value={1}>Term 1</option>
                  <option value={2}>Term 2</option>
                  <option value={3}>Term 3</option>
                </select>
              )} />
              {allTerms && (
                <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 4 }}>
                  Creates 3 fee items: one per term (names auto-suffixed with T1/T2/T3)
                </div>
              )}
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

            {/* Class — multi-select checkboxes */}
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6 }}>
                  Classes{selectedClassIds.length > 0 ? ` (${selectedClassIds.length} selected)` : ' — leave blank for all'}
                </label>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button type="button" onClick={selectAllClasses}
                    style={{ fontSize: 10.5, fontWeight: 700, cursor: 'pointer', padding: '2px 8px', borderRadius: 6, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)' }}>
                    All
                  </button>
                  {selectedClassIds.length > 0 && (
                    <button type="button" onClick={clearClassSelection}
                      style={{ fontSize: 10.5, fontWeight: 700, cursor: 'pointer', padding: '2px 8px', borderRadius: 6, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)' }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {classes.map(c => {
                  const checked = selectedClassIds.includes(c.id)
                  return (
                    <button
                      key={c.id} type="button"
                      onClick={() => toggleClass(c.id)}
                      style={{
                        padding: '5px 13px', borderRadius: 20, fontSize: 12.5,
                        fontFamily: 'var(--font2)', fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`,
                        background: checked ? 'var(--brand-light)' : 'var(--surface)',
                        color: checked ? 'var(--brand)' : 'var(--txt2)',
                        transition: 'all .14s',
                      }}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
              {selectedClassIds.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 5 }}>
                  No classes selected — fee applies to all classes
                </div>
              )}
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
                autoCharge:   { label: 'Auto-charge matching students', sub: `Creates payment records for all ${appliesTo === 'all' ? '' : appliesTo + ' '}students${selectedClassIds.length > 0 ? ` in ${selectedClassIds.length} class(es)` : ''}` },
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
  const qc = useQueryClient()
  const [showAdd,    setShowAdd]    = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [filterTerm, setFilterTerm] = useState<number | null>(null)
  const [filterClass, setFilterClass] = useState<string | null>(null)
  const { data: years = [] }    = useAcademicYears()
  const { data: classes = [] }  = useClasses()
  const { data: fees = [], isLoading } = useFeeStructure()
  const deleteMut   = useDeleteFeeType()
  const chargeMut   = useAutoChargeFees()
  const { data: _rawUncharged } = useUnchargedCounts(fees)
  // Normalise: guard against a stale Map object in the React Query cache
  const unchargedMap: Record<string, number> = (
    _rawUncharged instanceof Map
      ? Object.fromEntries((_rawUncharged as Map<string, number>).entries())
      : (_rawUncharged ?? {})
  ) as Record<string, number>
  const { success: ok, error: err } = useToast()

  const totalUncharged = Object.values(unchargedMap).reduce((s: number, n) => s + (Number(n) || 0), 0)

  async function handleSyncAll() {
    const activeFees = fees.filter(f => f.isActive)
    let totalCharged = 0
    for (const fee of activeFees) {
      try {
        const year = years.find(y => y.id === fee.academicYearId)
        const chargeYear = year ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
        const result = await chargeMut.mutateAsync({
          feeStructureId: fee.id, classId: fee.classId,
          appliesTo: fee.appliesTo, term: fee.term,
          year: chargeYear, amount: fee.amount, academicYearId: fee.academicYearId,
        })
        totalCharged += result.charged
      } catch { /* skip failed items */ }
    }
    ok(totalCharged > 0 ? `${totalCharged} student(s) billed across all fees` : 'All eligible students are already billed')
    void qc.invalidateQueries({ queryKey: ['uncharged-counts-v2'] })
    void qc.invalidateQueries({ queryKey: ['bursar-student-fees'] })
    void qc.invalidateQueries({ queryKey: ['fee-payments'] })
  }

  const activeYear = years.find(y => y.isActive) ?? years[0]

  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])

  const filtered = useMemo(() => {
    let f = fees
    if (filterTerm)  f = f.filter(fee => fee.term === filterTerm)
    if (filterClass) f = f.filter(fee => fee.classId === filterClass || fee.classId === null)
    return f
  }, [fees, filterTerm, filterClass])

  // Group sibling rows that share name+amount+appliesTo+term+academicYearId into one card
  type FeeGroup = { key: string; rows: FeeStructure[]; allClasses: boolean; classNames: string[] }
  const byTerm = useMemo(() => {
    const map = new Map<number, FeeGroup[]>()
    for (const f of filtered) {
      const gk = `${f.name}|${f.amount}|${f.appliesTo}|${f.term}|${f.academicYearId}`
      const arr = map.get(f.term) ?? []
      const existing = arr.find(g => g.key === gk)
      if (existing) {
        existing.rows.push(f)
        if (f.classId === null) existing.allClasses = true
        else if (!existing.allClasses) existing.classNames.push(classMap.get(f.classId) ?? f.classId)
      } else {
        arr.push({
          key: gk,
          rows: [f],
          allClasses: f.classId === null,
          classNames: f.classId ? [classMap.get(f.classId) ?? f.classId] : [],
        })
        map.set(f.term, arr)
      }
    }
    return map
  }, [filtered, classMap])

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
      ok(result.charged > 0
        ? `${result.charged} student(s) charged for "${fee.name}"`
        : `All eligible students already billed for "${fee.name}"`)
      void qc.invalidateQueries({ queryKey: ['uncharged-counts-v2'] })
      void qc.invalidateQueries({ queryKey: ['bursar-student-fees'] })
      void qc.invalidateQueries({ queryKey: ['fee-payments'] })
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => setShowImport(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import CSV
              </button>
              <button onClick={() => setShowAdd(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.45)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Fee Item
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Uncharged students banner */}
      {totalUncharged > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
          borderRadius: 14, border: '1px solid rgba(244,63,94,.3)',
          background: 'rgba(244,63,94,.06)',
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,63,94,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--danger)' }}>
              {totalUncharged} student{totalUncharged !== 1 ? 's' : ''} not yet billed
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 1 }}>
              These students have active fee structure items but no payment record yet.
            </div>
          </div>
          <button
            onClick={() => void handleSyncAll()}
            disabled={chargeMut.isPending}
            style={{ flexShrink: 0, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: chargeMut.isPending ? 'wait' : 'pointer', opacity: chargeMut.isPending ? .7 : 1 }}
          >
            {chargeMut.isPending ? 'Billing…' : 'Bill All Now'}
          </button>
        </div>
      )}

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
            const groups = byTerm.get(term)
            if (!groups?.length) return null
            const termTotal = groups.reduce((s, g) => s + (g.rows[0]?.isActive ? g.rows[0].amount : 0), 0)
            return (
              <div key={term}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Term {term}</div>
                  <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{ugx(termTotal)} total</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 10 }}>
                  {groups.map(group => {
                    const rep = group.rows[0]
                    const groupUncharged = group.rows.reduce((s, r) => s + (unchargedMap[r.id] ?? 0), 0)
                    return (
                      <div key={group.key}>
                        <FeeCard
                          fee={rep}
                          className={group.allClasses ? null : group.classNames.join(', ') || null}
                          classBadges={group.allClasses ? ['All Classes'] : group.classNames}
                          onDelete={async () => { for (const r of group.rows) await handleDelete(r) }}
                          onAutoCharge={async () => { for (const r of group.rows) await handleAutoCharge(r) }}
                          onEnable={async () => { for (const r of group.rows) await handleAutoCharge(r) }}
                          unchargedCount={groupUncharged}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd    && <AddFeeModal             onClose={() => setShowAdd(false)}    />}
      {showImport && <ImportFeeStructureModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
