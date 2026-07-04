import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SubmitHandler } from 'react-hook-form'
import ExcelJS from 'exceljs'
import { Button }         from '../../components/ui/Button'
import { Badge }          from '../../components/ui/Badge'
import { Modal }          from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudents }    from '../../hooks/useStudents'
import {
  useFeePayments, useAddPayment, useUpdatePayment,
  ugx, calcFeeStatus,
  type LedgerRow, type FeeFilters,
} from '../../hooks/useFeePayments'
import { useAcademicYears } from '../../hooks/useFeeStructure'
import type { FeeStatus } from '../../types/app'

// ── Status badge variant map ───────────────────────────────────
const STATUS_VARIANT = {
  paid:    'green',
  partial: 'amber',
  unpaid:  'red',
} as const

const STATUS_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

// ── Add Payment form schema ────────────────────────────────────
const AddPaymentSchema = z.object({
  studentId:     z.string().min(1, 'Select a student'),
  amountDue:     z.coerce.number().positive('Required'),
  amountPaid:    z.coerce.number().min(0, 'Cannot be negative'),
  paymentDate:   z.string().min(1, 'Date required'),
  receiptNumber: z.string().optional(),
  notes:         z.string().optional(),
})
type AddPaymentForm = z.infer<typeof AddPaymentSchema>

// ── Add Payment modal ─────────────────────────────────────────
function AddPaymentModal({
  term, academicYearId, onClose,
}: {
  term: number; academicYearId: string | null; onClose: () => void
}) {
  const { data: students } = useStudents()
  const addPayment = useAddPayment()
  const [search, setSearch] = useState('')

  const filtered = (students ?? []).filter(s => {
    const q = search.toLowerCase()
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q)  ||
      s.admissionNumber.toLowerCase().includes(q)
    )
  }).slice(0, 20)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<AddPaymentForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(AddPaymentSchema) as any,
    defaultValues: { paymentDate: new Date().toISOString().split('T')[0], amountPaid: 0, amountDue: 0 },
  })

  const selectedId  = watch('studentId')
  const amountDue   = watch('amountDue')  || 0
  const amountPaid  = watch('amountPaid') || 0
  const balance     = amountDue - amountPaid
  const selectedStu = students?.find(s => s.id === selectedId)

  const onSubmit: SubmitHandler<AddPaymentForm> = async values => {
    await addPayment.mutateAsync({
      studentId:     values.studentId,
      feeStructureId: null,
      academicYearId,
      amountDue:     values.amountDue,
      amountPaid:    values.amountPaid,
      paymentDate:   values.paymentDate,
      receiptNumber: values.receiptNumber || null,
      notes:         values.notes || null,
      term,
    })
    onClose()
  }

  const field = {
    label: { display: 'block' as const, fontSize: 11, fontWeight: 700 as const, color: 'var(--txt2)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5, fontFamily: 'var(--font2)' },
    input: { width: '100%', padding: '0.55rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13, fontFamily: 'var(--font1)', outline: 'none', boxSizing: 'border-box' as const },
    err:   { fontSize: 11, color: 'var(--danger)', marginTop: 3 },
  }

  return (
    <Modal isOpen onClose={onClose} title="Add Payment" size="md">
      <form onSubmit={(handleSubmit as any)(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Student search */}
        <div>
          <label style={field.label}>Student</label>
          {selectedStu ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.85rem', background: 'var(--brand-light)', border: '1.5px solid var(--brand)', borderRadius: 'var(--r)' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--brand)' }}>
                {selectedStu.firstName} {selectedStu.lastName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 4 }}>{selectedStu.admissionNumber}</span>
              <button type="button" onClick={() => { setValue('studentId', ''); setSearch('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 16 }}>×</button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or admission no…"
                aria-label="Search student"
                style={field.input}
              />
              {search && filtered.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                  {filtered.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setValue('studentId', s.id); setSearch('') }}
                      style={{ width: '100%', padding: '0.55rem 0.85rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{s.firstName} {s.lastName}</span>
                      <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{s.admissionNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <input type="hidden" {...register('studentId')} />
          {errors.studentId && <p style={field.err}>{errors.studentId.message}</p>}
        </div>

        <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={field.label}>Amount Due (UGX)</label>
            <input {...register('amountDue')} type="number" placeholder="800000" style={field.input} />
            {errors.amountDue && <p style={field.err}>{errors.amountDue.message}</p>}
          </div>
          <div>
            <label style={field.label}>Amount Paid (UGX)</label>
            <input {...register('amountPaid')} type="number" placeholder="0" style={field.input} />
            {errors.amountPaid && <p style={field.err}>{errors.amountPaid.message}</p>}
          </div>
        </div>

        {/* Live balance preview */}
        <div style={{ padding: '0.6rem 0.85rem', background: balance <= 0 ? 'var(--success-bg)' : 'var(--warning-bg)', borderRadius: 'var(--r)', fontSize: 12.5, fontWeight: 700, color: balance <= 0 ? 'var(--success)' : 'var(--warning)' }}>
          Balance: {ugx(Math.max(0, balance))} · {balance <= 0 ? 'Fully Paid' : 'Outstanding'}
        </div>

        <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={field.label}>Payment Date</label>
            <input {...register('paymentDate')} type="date" style={field.input} />
            {errors.paymentDate && <p style={field.err}>{errors.paymentDate.message}</p>}
          </div>
          <div>
            <label style={field.label}>Receipt Number</label>
            <input {...register('receiptNumber')} placeholder="RCT-001" style={field.input} />
          </div>
        </div>

        <div>
          <label style={field.label}>Notes (optional)</label>
          <input {...register('notes')} placeholder="e.g. cash payment, bank transfer" style={field.input} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" disabled={addPayment.isPending}>
            {addPayment.isPending ? 'Saving…' : 'Add Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Inline editable amount_paid cell ──────────────────────────
function EditableAmountCell({
  row, onSave,
}: {
  row: LedgerRow
  onSave: (id: string, oldPaid: number, newPaid: number) => void
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
    const val = parseFloat(draft)
    if (isNaN(val) || val === row.amountPaid || val < 0) return
    onSave(row.id, row.amountPaid, val)
  }

  if (editing) {
    // While editing, show live balance
    const liveBalance = row.amountDue - (parseFloat(draft) || 0)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          aria-label="Edit amount paid"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          style={{
            width: '100%', maxWidth: 110, padding: '0.2rem 0.4rem',
            border: '1.5px solid var(--brand)', borderRadius: 'var(--r)',
            background: 'var(--surface)', color: 'var(--txt)',
            fontFamily: 'var(--font3)', fontSize: 12, outline: 'none',
          }}
        />
        <span style={{ fontSize: 10, color: liveBalance <= 0 ? 'var(--success)' : 'var(--warning)' }}>
          Bal: {ugx(Math.max(0, liveBalance))}
        </span>
      </div>
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

// ── Main page ─────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()

export function FeeLedgerPage() {
  const [filters, setFilters] = useState<FeeFilters>({
    term: 1, year: CURRENT_YEAR,
  })
  const navigate = useNavigate()
  const [showAdd,    setShowAdd]    = useState(false)
  const [above60,    setAbove60]    = useState(false)

  const { data: classes } = useClasses()
  const { data: streams } = useStreams(filters.classId ?? null)
  const { data: academicYears = [] } = useAcademicYears()
  const activeAcademicYearId = academicYears.find(y => y.isActive)?.id ?? null

  // Default the ledger to the school's active academic year the first time
  // years load, rather than leaving academicYearId unset (which silently
  // falls back to "active year" anyway — this keeps the select in sync).
  useEffect(() => {
    if (!filters.academicYearId && activeAcademicYearId) {
      setFilters(f => ({ ...f, academicYearId: activeAcademicYearId }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYearId])

  const { data: rows, isLoading, error } = useFeePayments(filters)
  const updatePayment = useUpdatePayment()

  const selectedYearLabel = academicYears.find(y => y.id === filters.academicYearId)?.name
    ?? String(filters.year ?? CURRENT_YEAR)

  const allRows = useMemo(() => {
    const r = rows ?? []
    if (above60) return r.filter(row => row.amountDue > 0 && row.amountPaid / row.amountDue >= 0.6)
    return r
  }, [rows, above60])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count:           allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => 52,
    overscan:        10,
  })

  // ── Inline payment update ────────────────────────────────────
  const handleInlineEdit = useCallback(
    (id: string, oldPaid: number, newPaid: number) => {
      const row = (rows ?? []).find(r => r.id === id)
      if (!row) return
      updatePayment.mutate({ id, amountDue: row.amountDue, amountPaid: newPaid, oldAmountPaid: oldPaid })
    },
    [rows, updatePayment]
  )

  // ── Excel export (premium) ────────────────────────────────────
  async function handleExport() {
    if (!allRows.length) return
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Shule Management System'
    wb.created = new Date()
    const ws = wb.addWorksheet('Fee Ledger')

    const lastCol = 'J'
    const title = `Fee Ledger — Term ${filters.term ?? 1}, ${selectedYearLabel}`

    // Title row
    ws.mergeCells(`A1:${lastCol}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = title
    titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 28

    // Date row
    ws.mergeCells(`A2:${lastCol}2`)
    const dateCell = ws.getCell('A2')
    dateCell.value = `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    dateCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF64748B' } }
    dateCell.alignment = { horizontal: 'right' }
    ws.getRow(2).height = 14

    // Header row (row 3)
    const headers = ['Student Name', 'Admission No', 'Class', 'Stream', 'Amount Due (UGX)', 'Amount Paid (UGX)', 'Balance (UGX)', 'Term', 'Status', 'Last Payment']
    const headerRow = ws.addRow(headers)
    headerRow.height = 20
    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF0D9488' } } }
    })

    // Data rows with alternating colours
    const STATUS_FONT: Record<string, string> = { paid: 'FF10B981', partial: 'FFF59E0B', unpaid: 'FFF43F5E' }
    allRows.forEach((r, i) => {
      const status = calcFeeStatus(r.amountPaid, r.balance)
      const dataRow = ws.addRow([
        `${r.firstName} ${r.lastName}`,
        r.admissionNumber,
        r.className,
        r.streamName ?? '',
        r.amountDue,
        r.amountPaid,
        Math.max(0, r.balance),
        String(filters.term ?? 1),
        status.charAt(0).toUpperCase() + status.slice(1),
        r.paymentDate ?? '',
      ])
      dataRow.height = 16
      dataRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
        cell.font = { name: 'Calibri', size: 10 }
        cell.alignment = { vertical: 'middle' }
        if (colNum >= 5 && colNum <= 7) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          cell.numFmt = '#,##0'
        }
        if (colNum === 9) {
          const argb = STATUS_FONT[status] ?? 'FF0F172A'
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb } }
        }
      })
    })

    // Totals row
    const totDue  = allRows.reduce((s, r) => s + r.amountDue,  0)
    const totPaid = allRows.reduce((s, r) => s + r.amountPaid, 0)
    const totBal  = allRows.reduce((s, r) => s + Math.max(0, r.balance), 0)
    const totRow  = ws.addRow(['TOTALS', '', '', '', totDue, totPaid, totBal, '', '', ''])
    totRow.height = 18
    totRow.eachCell((cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle' }
      if (colNum >= 5 && colNum <= 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        cell.numFmt = '#,##0'
      }
    })

    // Column widths
    const colWidths = [28, 14, 10, 10, 18, 18, 16, 8, 10, 14]
    ws.columns.forEach((col, i) => { col.width = colWidths[i] ?? 14 })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `fee-ledger-T${filters.term ?? 1}-${selectedYearLabel.replace(/[^a-zA-Z0-9]+/g, '-')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const thStyle = {
    textAlign: 'left' as const, fontSize: 10, fontWeight: 700 as const,
    color: 'var(--txt3)', padding: '0.6rem 0.85rem',
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
    fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)', whiteSpace: 'nowrap' as const,
    position: 'sticky' as const, top: 0, zIndex: 1,
  }
  const tdStyle = { padding: '0.65rem 0.85rem', verticalAlign: 'middle' as const }

  return (
    <div style={{ padding: 'clamp(0.75rem, 4vw, 1.5rem) clamp(0.75rem, 4vw, 2rem)', maxWidth: 1400, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Hero Band */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
        padding: '28px 28px 24px', position: 'relative', marginBottom: 16,
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Icon + title + action buttons */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.20)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>Fee Ledger</h1>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/bursar/import')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', minHeight: 44, borderRadius: 10, border: '.5px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.26)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.16)')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import
              </button>
              <button
                onClick={handleExport}
                disabled={!allRows.length}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', minHeight: 44, borderRadius: 10, border: '.5px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: allRows.length ? 'pointer' : 'default', opacity: allRows.length ? 1 : .5, transition: 'background .15s' }}
                onMouseEnter={e => { if (allRows.length) e.currentTarget.style.background = 'rgba(255,255,255,.26)' }}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.16)')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 16 12 21 17 16"/><line x1="12" y1="21" x2="12" y2="9"/></svg>
                Export
              </button>
              <button
                onClick={() => setShowAdd(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', minHeight: 44, borderRadius: 10, border: 'none', background: '#fff', color: '#be123c', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.18)', transition: 'box-shadow .15s, transform .15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,.22)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.18)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Payment
              </button>
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
            View and manage student fee payments for Term {filters.term ?? 1}, {selectedYearLabel}.
          </p>

          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Records', value: isLoading ? '—' : allRows.length },
              { label: 'Fully Paid', value: isLoading ? '—' : allRows.filter(r => calcFeeStatus(r.amountPaid, r.balance) === 'paid').length },
              { label: 'Partial', value: isLoading ? '—' : allRows.filter(r => calcFeeStatus(r.amountPaid, r.balance) === 'partial').length },
              { label: 'Unpaid', value: isLoading ? '—' : allRows.filter(r => calcFeeStatus(r.amountPaid, r.balance) === 'unpaid').length },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.28)', borderRadius: 12, padding: '10px 16px', minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        {/* Term pills */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
          {([1, 2, 3] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilters(f => ({ ...f, term: t, streamId: undefined }))}
              style={{
                padding: '0.55rem 0.85rem', minHeight: 36, border: 'none', borderRadius: 20,
                background: filters.term === t ? 'var(--brand)' : 'transparent',
                color: filters.term === t ? '#fff' : 'var(--txt3)',
                fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12,
                cursor: 'pointer',
              }}
            >T{t}</button>
          ))}
        </div>

        <select
          value={filters.academicYearId ?? ''}
          onChange={e => setFilters(f => ({ ...f, academicYearId: e.target.value || undefined }))}
          aria-label="Academic Year"
          style={{ padding: '0.35rem 0.85rem', minWidth: 120, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13 }}
        >
          {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>)}
        </select>

        <select
          value={filters.classId ?? ''}
          onChange={e => setFilters(f => ({ ...f, classId: e.target.value || undefined, streamId: undefined }))}
          aria-label="Filter by class"
          style={{ padding: '0.35rem 0.85rem', minWidth: 120, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13 }}
        >
          <option value="">All Classes</option>
          {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filters.streamId ?? ''}
          onChange={e => setFilters(f => ({ ...f, streamId: e.target.value || undefined }))}
          aria-label="Filter by stream"
          disabled={!filters.classId}
          style={{ padding: '0.35rem 0.85rem', minWidth: 100, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13, opacity: filters.classId ? 1 : 0.5 }}
        >
          <option value="">All Streams</option>
          {(streams ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          value={filters.status ?? ''}
          onChange={e => setFilters(f => ({ ...f, status: (e.target.value as FeeStatus) || undefined }))}
          aria-label="Filter by status"
          style={{ padding: '0.35rem 0.85rem', minWidth: 110, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13 }}
        >
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>

        <input
          type="search"
          value={filters.search ?? ''}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value || undefined }))}
          placeholder="Search name or adm no…"
          aria-label="Search students"
          style={{ flex: 1, minWidth: 180, padding: '0.35rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13, outline: 'none' }}
        />

        {/* ≥60% paid filter pill */}
        <button
          onClick={() => setAbove60(v => !v)}
          style={{
            padding: '0.3rem 0.9rem', borderRadius: 20, cursor: 'pointer',
            fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 11, whiteSpace: 'nowrap',
            background: above60
              ? 'linear-gradient(135deg,#10b981,#059669)'
              : 'linear-gradient(135deg,rgba(16,185,129,.12),rgba(5,150,105,.08))',
            color:  above60 ? '#fff' : 'var(--success)',
            border: above60 ? 'none' : '1.5px solid rgba(16,185,129,.35)',
            boxShadow: above60 ? '0 2px 12px rgba(16,185,129,.35)' : 'none',
            transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
          }}
        >
          ≥ 60% Paid
        </button>

        <span style={{ fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
          {allRows.length} record{allRows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Virtualised table ──────────────────────────────── */}
      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div style={{ padding: '1rem', background: 'var(--danger-bg)', borderRadius: 'var(--r)', color: 'var(--danger)', fontSize: 13 }}>
          {(error as Error).message}
        </div>
      ) : (
        <div className="table-scroll" style={{
          flex: 1, overflow: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', WebkitOverflowScrolling: 'touch' as any,
        }}>
          {/* Fixed header */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 720 }}>
            <thead>
              <tr>
                {['Adm No', 'Student', 'Class', 'Stream', 'Amount Due', 'Amount Paid', 'Balance', 'Status', 'Last Payment', 'Receipt No'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>

          {/* Scrollable body */}
          <div
            ref={parentRef}
            style={{ maxHeight: 'calc(100dvh - 300px)', minHeight: 400, overflowY: 'auto' }}
          >
            {allRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--txt3)', fontSize: 13 }}>
                No payments found for the selected filters.
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <tbody>
                    {virtualizer.getVirtualItems().map(vr => {
                      const row = allRows[vr.index]
                      const liveBalance = row.balance
                      const liveStatus  = calcFeeStatus(row.amountPaid, liveBalance)
                      return (
                        <tr
                          key={row.id}
                          className="sui-tr"
                          style={{
                            position: 'absolute', top: 0, left: 0, width: '100%',
                            transform: `translateY(${vr.start}px)`, height: vr.size,
                          }}
                        >
                          <td style={{ ...tdStyle, fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt3)' }}>
                            {row.admissionNumber}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>
                              {row.firstName} {row.lastName}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: 'var(--txt2)' }}>{row.className}</td>
                          <td style={{ ...tdStyle, fontSize: 12, color: 'var(--txt2)' }}>{row.streamName}</td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)' }}>
                            {ugx(row.amountDue)}
                          </td>
                          <td style={tdStyle}>
                            <EditableAmountCell row={row} onSave={handleInlineEdit} />
                          </td>
                          <td style={{
                            ...tdStyle,
                            fontFamily: 'var(--font3)', fontSize: 13,
                            color: liveBalance <= 0 ? 'var(--success)' : 'var(--danger)',
                            fontWeight: 600,
                          }}>
                            {ugx(Math.max(0, liveBalance))}
                          </td>
                          <td style={tdStyle}>
                            <Badge variant={STATUS_VARIANT[liveStatus]} size="sm">
                              {STATUS_LABEL[liveStatus]}
                            </Badge>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: 'var(--txt2)' }}>
                            {row.paymentDate ?? '—'}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt3)' }}>
                            {row.receiptNumber ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {showAdd && (
        <AddPaymentModal
          term={filters.term ?? 1}
          academicYearId={activeAcademicYearId}
          onClose={() => setShowAdd(false)}
        />
      )}

    </div>
  )
}
