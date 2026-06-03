import { ImportWizard } from '../../components/shared/ImportWizard'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import ExcelJS from 'exceljs'
import type { ColumnSpec, ParsedRow, ImportResult } from '../../components/shared/ImportWizard'

// ─── Column specs ──────────────────────────────────────────────────────────────
const REQUIRED: ColumnSpec[] = [
  {
    key: 'admission_number', label: 'Admission Number', example: 'KJA/2025/001',
    hint: 'Must match exactly what is in the student register (e.g. KJA/2025/001)',
  },
  {
    key: 'amount_paid', label: 'Amount Paid (UGX)', example: '250000',
    hint: 'How much the student has paid so far this term. Numbers only, no commas.',
    validate: v => isNaN(Number(v)) ? 'Must be a number' : null,
  },
  {
    key: 'amount_due', label: 'Amount Due (UGX)', example: '400000',
    hint: 'Total fees owed for the term. Balance = Due − Paid.',
    validate: v => isNaN(Number(v)) ? 'Must be a number' : null,
  },
  {
    key: 'term', label: 'Term (1, 2, or 3)', example: '1',
    hint: 'Which school term this record applies to.',
    validate: v => !['1','2','3'].includes(String(v).trim()) ? 'Must be 1, 2, or 3' : null,
  },
  {
    key: 'year', label: 'Year', example: '2025',
    hint: 'Calendar year (e.g. 2025).',
    validate: v => isNaN(Number(v)) || Number(v) < 2020 ? 'Enter a valid year' : null,
  },
]

const OPTIONAL: ColumnSpec[] = [
  { key: 'payment_date',   label: 'Payment Date',   example: '2025-09-01', hint: 'Date of payment in YYYY-MM-DD format.' },
  { key: 'receipt_number', label: 'Receipt Number', example: 'REC-001',    hint: 'Reference number from payment receipt.' },
  { key: 'notes',          label: 'Notes',          example: 'Term 1 fees', hint: 'Any additional notes about this payment.' },
]

// ─── Download template ─────────────────────────────────────────────────────────
async function downloadTemplate() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Shule Management System'
  const ws = wb.addWorksheet('Fee Payments Import')

  ws.columns = [
    { header: 'admission_number', key: 'admission_number', width: 22 },
    { header: 'amount_paid',      key: 'amount_paid',      width: 18 },
    { header: 'amount_due',       key: 'amount_due',       width: 18 },
    { header: 'term',             key: 'term',             width: 10 },
    { header: 'year',             key: 'year',             width: 10 },
    { header: 'payment_date',     key: 'payment_date',     width: 16 },
    { header: 'receipt_number',   key: 'receipt_number',   width: 16 },
    { header: 'notes',            key: 'notes',            width: 24 },
  ]

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F766E' } } }
  })
  headerRow.height = 26

  // Add example rows
  ws.addRow(['KJA/2025/001', 250000, 400000, 1, 2025, '2025-09-01', 'REC-001', 'Term 1 partial'])
  ws.addRow(['KJA/2025/002', 400000, 400000, 1, 2025, '2025-09-05', 'REC-002', 'Term 1 full'])
  ws.addRow(['KJA/2025/003', 0,      400000, 1, 2025, '',           '',        ''])

  // Style example rows
  ws.getRow(2).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } } })
  ws.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } } })

  // Add notes sheet
  const notesWs = wb.addWorksheet('Notes & Instructions')
  const notes = [
    ['Column', 'Required?', 'Description', 'Example'],
    ['admission_number', 'YES', 'Must match the student register exactly', 'KJA/2025/001'],
    ['amount_paid',      'YES', 'How much paid so far (UGX, numbers only)', '250000'],
    ['amount_due',       'YES', 'Total amount owed for the term (UGX)', '400000'],
    ['term',             'YES', '1, 2, or 3 only', '1'],
    ['year',             'YES', 'Calendar year', '2025'],
    ['payment_date',     'No',  'Date of payment (YYYY-MM-DD)', '2025-09-01'],
    ['receipt_number',   'No',  'Receipt reference number', 'REC-001'],
    ['notes',            'No',  'Additional notes', 'Term 1 fees'],
  ]
  notes.forEach((row, i) => {
    const r = notesWs.addRow(row)
    if (i === 0) {
      r.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } } })
    }
  })
  notesWs.getColumn(1).width = 22
  notesWs.getColumn(3).width = 42

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = 'fee-payments-import-template.xlsx'; a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function BursarImportPage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  async function handleImport(rows: ParsedRow[]): Promise<ImportResult> {
    let imported = 0
    const failedItems: Array<{ row: number; reason: string }> = []

    // Resolve admission numbers → student IDs
    const admNumbers = [...new Set(rows.map(r => String(r.admission_number ?? '').trim()))]
    const { data: stuData, error: stuErr } = await supabase
      .from('students')
      .select('id, admission_number, class_id')
      .eq('school_id', user!.schoolId)
      .in('admission_number', admNumbers)

    if (stuErr) {
      rows.forEach((_, i) => failedItems.push({ row: i + 2, reason: stuErr.message }))
      return { imported: 0, updated: 0, skipped: 0, failed: failedItems }
    }

    const admToStudent: Record<string, { id: string; classId: string | null }> = {}
    for (const s of stuData ?? []) {
      admToStudent[String(s.admission_number).trim()] = { id: s.id, classId: s.class_id ?? null }
    }

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const inserts: Record<string, unknown>[] = []

      batch.forEach((r, j) => {
        const admNo     = String(r.admission_number ?? '').trim()
        const student   = admToStudent[admNo]
        if (!student) {
          failedItems.push({ row: i + j + 2, reason: `Student not found: ${admNo}` })
          return
        }
        const amountPaid = Number(r.amount_paid ?? 0)
        const amountDue  = Number(r.amount_due  ?? amountPaid)
        const balance    = Math.max(0, amountDue - amountPaid)
        const termNum    = Number(r.term ?? 1)
        const yearNum    = Number(r.year ?? new Date().getFullYear())

        if (isNaN(amountPaid) || isNaN(amountDue)) {
          failedItems.push({ row: i + j + 2, reason: `Invalid amounts for ${admNo}` }); return
        }
        if (![1,2,3].includes(termNum)) {
          failedItems.push({ row: i + j + 2, reason: `Invalid term "${r.term}" for ${admNo}` }); return
        }

        inserts.push({
          school_id:      user!.schoolId,
          student_id:     student.id,
          amount_paid:    amountPaid,
          amount_due:     amountDue,
          balance,
          payment_date:   r.payment_date ? String(r.payment_date) : new Date().toISOString().slice(0, 10),
          receipt_number: r.receipt_number ? String(r.receipt_number) : null,
          notes:          r.notes ? String(r.notes) : null,
          term:           termNum,
          year:           yearNum,
          imported:       true,
          created_by:     user!.id,
        })
      })

      if (inserts.length === 0) continue
      const { error } = await supabase.from('fee_payments').insert(inserts)
      if (error) {
        batch.forEach((_, j) => failedItems.push({ row: i + j + 2, reason: error.message }))
      } else {
        imported += inserts.length
      }
    }

    void qc.invalidateQueries({ queryKey: ['fee-payments'] })
    void qc.invalidateQueries({ queryKey: ['bursar-student-fees'] })
    void qc.invalidateQueries({ queryKey: ['bursar-kpis'] })

    return { imported, updated: 0, skipped: 0, failed: failedItems }
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero */}
      <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, #065f46 0%, #0d9488 100%)', padding: '26px 28px 22px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -.4 }}>Import Fee Payments</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, margin: '0 0 16px' }}>
            Upload a spreadsheet · column mapping is shown before import · balance is auto-computed
          </p>
          <button onClick={() => void downloadTemplate()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Template (.xlsx)
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {[
          { icon: 'M9 11l3 3L22 4', label: 'Auto balance', detail: 'Balance = Due − Paid. Computed on every row.' },
          { icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label: 'Safe mapping', detail: 'You map your column headers before import runs.' },
          { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8', label: 'Student matching', detail: 'Rows are matched by Admission Number.' },
          { icon: 'M12 5v14M5 12h14', label: 'Batch safe', detail: 'Import in batches of 50 — large files handled.' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2"><path d={k.icon}/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{k.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.5 }}>{k.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <ImportWizard
        context="fees"
        requiredFields={REQUIRED}
        optionalFields={OPTIONAL}
        onComplete={handleImport}
      />
    </div>
  )
}
