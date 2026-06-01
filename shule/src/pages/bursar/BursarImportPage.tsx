import { ImportWizard } from '../../components/shared/ImportWizard'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ColumnSpec, ParsedRow, ImportResult } from '../../components/shared/ImportWizard'

const REQUIRED: ColumnSpec[] = [
  { key: 'admission_number', label: 'Admission Number', example: 'KJA/2025/001' },
  { key: 'amount_paid',      label: 'Amount Paid',      example: '250000' },
  { key: 'amount_due',       label: 'Amount Due',       example: '400000' },
  { key: 'term',             label: 'Term (1/2/3)',      example: '1' },
  { key: 'year',             label: 'Year',             example: '2025' },
]

const OPTIONAL: ColumnSpec[] = [
  { key: 'payment_date',   label: 'Payment Date', example: '2025-09-01' },
  { key: 'receipt_number', label: 'Receipt No.',  example: 'REC-001' },
  { key: 'notes',          label: 'Notes',        example: 'Term 1 fees' },
]

export function BursarImportPage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  async function handleImport(rows: ParsedRow[]): Promise<ImportResult> {
    let imported = 0
    const failedItems: Array<{ row: number; reason: string }> = []

    // Resolve admission numbers → student IDs in one query
    const admNumbers = [...new Set(rows.map(r => String(r.admission_number ?? '')))]
    const { data: stuData, error: stuErr } = await supabase
      .from('students')
      .select('id, admission_number')
      .eq('school_id', user!.schoolId)
      .in('admission_number', admNumbers)

    if (stuErr) {
      rows.forEach((_, i) => failedItems.push({ row: i + 2, reason: stuErr.message }))
      return { imported: 0, updated: 0, skipped: 0, failed: failedItems }
    }

    const admToId: Record<string, string> = {}
    for (const s of stuData ?? []) admToId[s.admission_number] = s.id

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const inserts: any[] = []

      batch.forEach((r, j) => {
        const admNo = String(r.admission_number ?? '')
        const studentId = admToId[admNo]
        if (!studentId) {
          failedItems.push({ row: i + j + 2, reason: `Student not found: ${admNo}` })
          return
        }
        const amountPaid = Number(r.amount_paid ?? 0)
        const amountDue  = Number(r.amount_due  ?? amountPaid)
        inserts.push({
          school_id:      user!.schoolId,
          student_id:     studentId,
          amount_paid:    amountPaid,
          amount_due:     amountDue,
          balance:        Math.max(0, amountDue - amountPaid),
          payment_date:   r.payment_date ? String(r.payment_date) : new Date().toISOString().slice(0, 10),
          receipt_number: r.receipt_number ? String(r.receipt_number) : null,
          notes:          r.notes ? String(r.notes) : null,
          term:           Number(r.term ?? 1),
          year:           Number(r.year ?? new Date().getFullYear()),
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

    return { imported, updated: 0, skipped: 0, failed: failedItems }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(16,185,129,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Import Fee Payments</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Upload a spreadsheet to batch-import fee payment records</p>
        </div>
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
