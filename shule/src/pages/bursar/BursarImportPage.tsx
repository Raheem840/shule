import { ImportWizard } from '../../components/shared/ImportWizard'
import { useFeePayments } from '../../hooks/useFeePayments'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ColumnSpec, ParsedRow, ImportResult } from '../../components/shared/ImportWizard'

const REQUIRED: ColumnSpec[] = [
  { key: 'admission_number', label: 'Admission Number', example: 'KJA/2025/001' },
  { key: 'amount',           label: 'Amount Paid',      example: '250000' },
]

const OPTIONAL: ColumnSpec[] = [
  { key: 'payment_date',  label: 'Payment Date',   example: '2025-09-01' },
  { key: 'payment_method',label: 'Payment Method', example: 'cash' },
  { key: 'reference',     label: 'Reference',      example: 'REC-001' },
  { key: 'notes',         label: 'Notes',          example: 'Term 1 fees' },
]

export function BursarImportPage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  async function handleImport(rows: ParsedRow[]): Promise<ImportResult> {
    let imported = 0
    let skipped  = 0
    let failed   = 0
    const failedRows: ParsedRow[] = []

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const inserts = batch.map(r => ({
        school_id:      user!.schoolId,
        admission_number: String(r.admission_number ?? ''),
        amount:         Number(r.amount ?? 0),
        payment_date:   r.payment_date ? String(r.payment_date) : new Date().toISOString().slice(0, 10),
        payment_method: r.payment_method ? String(r.payment_method) : 'cash',
        reference:      r.reference ? String(r.reference) : null,
        notes:          r.notes ? String(r.notes) : null,
      }))

      const { error } = await supabase.from('fee_payments').insert(inserts)
      if (error) {
        failed  += batch.length
        failedRows.push(...batch)
      } else {
        imported += batch.length
      }
    }

    qc.invalidateQueries({ queryKey: ['fee-payments'] })

    return {
      imported,
      updated: 0,
      skipped,
      failed,
      failedRows,
    }
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
