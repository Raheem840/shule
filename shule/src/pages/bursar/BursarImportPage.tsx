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
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          Import Fee Payments
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Upload a spreadsheet to batch-import fee payment records.
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
