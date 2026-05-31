import { useState, useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SubmitHandler } from 'react-hook-form'
import ExcelJS from 'exceljs'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { PageHeader }     from '../../components/ui/PageHeader'
import { Button }         from '../../components/ui/Button'
import { Badge }          from '../../components/ui/Badge'
import { Modal }          from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ImportWizard }   from '../../components/shared/ImportWizard'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudents }    from '../../hooks/useStudents'
import {
  useFeePayments, useAddPayment, useUpdatePayment,
  ugx, calcFeeStatus,
  type LedgerRow, type FeeFilters,
} from '../../hooks/useFeePayments'
import type { FeeStatus } from '../../types/app'
import type { ParsedRow, ConflictStrategy, ImportResult } from '../../components/shared/ImportWizard'

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
  term, year, onClose,
}: {
  term: number; year: number; onClose: () => void
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
      academicYearId: null,
      amountDue:     values.amountDue,
      amountPaid:    values.amountPaid,
      paymentDate:   values.paymentDate,
      receiptNumber: values.receiptNumber || null,
      notes:         values.notes || null,
      term,
      year,
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
            width: 110, padding: '0.2rem 0.4rem',
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
  const { user } = useAuth()
  const [filters, setFilters] = useState<FeeFilters>({
    term: 1, year: CURRENT_YEAR,
  })
  const [showAdd,    setShowAdd]    = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [above60,    setAbove60]    = useState(false)

  const { data: classes } = useClasses()
  const { data: streams } = useStreams(filters.classId ?? null)
  const { data: rows, isLoading, error } = useFeePayments(filters)
  const updatePayment = useUpdatePayment()

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

  // ── Excel export ─────────────────────────────────────────────
  async function handleExport() {
    if (!rows?.length) return
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Fee Ledger')
    ws.columns = [
      { header: 'Adm No',         key: 'admissionNumber', width: 16 },
      { header: 'Student Name',   key: 'name',            width: 28 },
      { header: 'Class',          key: 'className',       width: 10 },
      { header: 'Stream',         key: 'streamName',      width: 10 },
      { header: 'Amount Due',     key: 'amountDue',       width: 16 },
      { header: 'Amount Paid',    key: 'amountPaid',      width: 16 },
      { header: 'Balance',        key: 'balance',         width: 16 },
      { header: 'Status',         key: 'status',          width: 10 },
      { header: 'Last Payment',   key: 'paymentDate',     width: 16 },
      { header: 'Receipt No',     key: 'receiptNumber',   width: 16 },
    ]
    for (const r of rows) {
      ws.addRow({
        admissionNumber: r.admissionNumber,
        name:            `${r.firstName} ${r.lastName}`,
        className:       r.className,
        streamName:      r.streamName,
        amountDue:       r.amountDue,
        amountPaid:      r.amountPaid,
        balance:         r.balance,
        status:          r.status,
        paymentDate:     r.paymentDate ?? '',
        receiptNumber:   r.receiptNumber ?? '',
      })
    }
    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href = url
    a.download = `fee-ledger-term${filters.term}-${filters.year}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Fee import handler ────────────────────────────────────────
  const handleFeeImport = useCallback(
    async (parsedRows: ParsedRow[], strategy: ConflictStrategy): Promise<ImportResult> => {
      const result: ImportResult = { imported: 0, updated: 0, skipped: 0, failed: [] }
      const term = filters.term ?? 1
      const year = filters.year ?? CURRENT_YEAR

      // Resolve admission numbers → student IDs
      const admNums = [...new Set(parsedRows.map(r => r.admission_number).filter(Boolean))]
      const { data: students, error: stuErr } = await supabase
        .from('students')
        .select('id, admission_number')
        .eq('school_id', user!.schoolId)
        .in('admission_number', admNums)

      if (stuErr) throw stuErr

      const studentMap = new Map<string, string>()
      for (const s of students ?? []) studentMap.set(s.admission_number as string, s.id as string)

      const BATCH = 50
      for (let i = 0; i < parsedRows.length; i += BATCH) {
        const batch = parsedRows.slice(i, i + BATCH)
        for (let bi = 0; bi < batch.length; bi++) {
          const row    = batch[bi]
          const rowNum = i + bi + 1
          const sid    = studentMap.get(row.admission_number)

          if (!sid) { result.failed.push({ row: rowNum, reason: `Student "${row.admission_number}" not found` }); continue }

          const amountDue  = parseFloat(row.amount_due  || '0')
          const amountPaid = parseFloat(row.amount_paid || '0')
          if (isNaN(amountDue) || isNaN(amountPaid)) {
            result.failed.push({ row: rowNum, reason: 'Invalid amount value' }); continue
          }

          const rowTerm = parseInt(row.term || String(term), 10)
          const balance = amountDue - amountPaid

          // Check for existing record
          const { data: existing } = await supabase
            .from('fee_payments')
            .select('id')
            .eq('school_id', user!.schoolId)
            .eq('student_id', sid)
            .eq('term', rowTerm)
            .eq('year', year)
            .limit(1)
            .maybeSingle()

          if (existing) {
            if (strategy === 'skip') { result.skipped++; continue }
            // strategy === 'upsert'
            const { error } = await supabase
              .from('fee_payments')
              .update({ amount_due: amountDue, amount_paid: amountPaid, balance, imported: true })
              .eq('id', existing.id)
            if (error) { result.failed.push({ row: rowNum, reason: error.message }); continue }
            result.updated++
          } else {
            const { error } = await supabase
              .from('fee_payments')
              .insert({
                school_id:      user!.schoolId,
                student_id:     sid,
                fee_structure_id: null,
                amount_due:     amountDue,
                amount_paid:    amountPaid,
                balance,
                payment_date:   row.payment_date   || null,
                receipt_number: row.receipt_number || null,
                notes:          row.notes          || null,
                term:           rowTerm,
                year,
                imported:       true,
              })
            if (error) { result.failed.push({ row: rowNum, reason: error.message }); continue }
            result.imported++
          }
        }
      }

      return result
    },
    [filters.term, filters.year, user]
  )

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
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1400, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <PageHeader
        title="Fee Ledger"
        subtitle="View and manage student fee payments"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost"   size="sm" onClick={() => setShowImport(true)}>Import Excel</Button>
            <Button variant="ghost"   size="sm" onClick={handleExport} disabled={!allRows.length}>Export</Button>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Payment</Button>
          </div>
        }
      />

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        {/* Term pills */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
          {([1, 2, 3] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilters(f => ({ ...f, term: t, streamId: undefined }))}
              style={{
                padding: '0.25rem 0.85rem', border: 'none', borderRadius: 20,
                background: filters.term === t ? 'var(--brand)' : 'transparent',
                color: filters.term === t ? '#fff' : 'var(--txt3)',
                fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12,
                cursor: 'pointer',
              }}
            >T{t}</button>
          ))}
        </div>

        <input
          type="number"
          value={filters.year ?? CURRENT_YEAR}
          onChange={e => setFilters(f => ({ ...f, year: Number(e.target.value) }))}
          aria-label="Year"
          style={{ width: 75, padding: '0.3rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, outline: 'none' }}
        />

        <select
          value={filters.classId ?? ''}
          onChange={e => setFilters(f => ({ ...f, classId: e.target.value || undefined, streamId: undefined }))}
          aria-label="Filter by class"
          style={{ padding: '0.35rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13 }}
        >
          <option value="">All Classes</option>
          {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filters.streamId ?? ''}
          onChange={e => setFilters(f => ({ ...f, streamId: e.target.value || undefined }))}
          aria-label="Filter by stream"
          disabled={!filters.classId}
          style={{ padding: '0.35rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13, opacity: filters.classId ? 1 : 0.5 }}
        >
          <option value="">All Streams</option>
          {(streams ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          value={filters.status ?? ''}
          onChange={e => setFilters(f => ({ ...f, status: (e.target.value as FeeStatus) || undefined }))}
          aria-label="Filter by status"
          style={{ padding: '0.35rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 13 }}
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
            padding: '0.3rem 0.9rem', border: 'none', borderRadius: 20, cursor: 'pointer',
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
        <div style={{
          flex: 1, overflow: 'hidden',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
        }}>
          {/* Fixed header */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
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
            style={{ height: 'calc(100% - 37px)', overflowY: 'auto' }}
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
          year={filters.year ?? CURRENT_YEAR}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showImport && (
        <Modal isOpen onClose={() => setShowImport(false)} title="Import Fee Payments" size="xl">
          <ImportWizard
            context="fees"
            requiredFields={[
              { key: 'admission_number', label: 'Admission Number', required: true },
              { key: 'amount_due',       label: 'Amount Due (UGX)', required: true },
              { key: 'amount_paid',      label: 'Amount Paid (UGX)', required: true },
            ]}
            optionalFields={[
              { key: 'receipt_number', label: 'Receipt Number', required: false },
              { key: 'payment_date',   label: 'Payment Date',   required: false },
              { key: 'notes',          label: 'Notes',          required: false },
              { key: 'term',           label: 'Term (1/2/3)',   required: false },
            ]}
            onComplete={handleFeeImport}
            onClose={() => setShowImport(false)}
          />
        </Modal>
      )}
    </div>
  )
}
