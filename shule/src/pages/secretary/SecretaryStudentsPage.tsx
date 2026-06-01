import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StudentsPage } from './StudentsPage'
import { StudentRegistrationWizard } from './StudentRegistrationWizard'
import { ImportWizard, type ColumnSpec, type ParsedRow, type ImportResult, type ConflictStrategy } from '../../components/shared/ImportWizard'
import { Modal } from '../../components/ui/Modal'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Student } from '../../types/app'

// ── Student import field specs ────────────────────────────────
const REQUIRED: ColumnSpec[] = [
  { key: 'first_name',       label: 'First Name',    required: true },
  { key: 'last_name',        label: 'Last Name',     required: true },
  { key: 'admission_number', label: 'Admission No.', required: true },
  { key: 'class',            label: 'Class',         required: true },
]

const OPTIONAL: ColumnSpec[] = [
  {
    key: 'gender', label: 'Gender', required: false,
    validate: v => ['male','female','m','f'].includes(v.toLowerCase()) ? null : 'Must be Male or Female',
  },
  {
    key: 'student_type', label: 'Student Type', required: false,
    validate: v => ['day','boarder'].includes(v.toLowerCase()) ? null : 'Must be Day or Boarder',
  },
  { key: 'dob',             label: 'Date of Birth',   required: false },
  { key: 'stream',          label: 'Stream',           required: false },
  { key: 'nationality',     label: 'Nationality',      required: false },
  { key: 'religion',        label: 'Religion',         required: false },
  { key: 'enrolled_at',     label: 'Enrolment Date',   required: false },
  { key: 'previous_school', label: 'Previous School',  required: false },
]

// ── Orchestrator ──────────────────────────────────────────────
export function SecretaryStudentsPage() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_viewed,    setViewed]     = useState<Student | null>(null)

  const qc                     = useQueryClient()
  const { user }               = useAuth()
  const { data: classes = [] } = useClasses()
  const { data: streams = [] } = useStreams()

  // ── Import handler ────────────────────────────────────────
  // Resolves class/stream names → IDs, then batch-upserts into students table.
  async function handleImportComplete(
    rows: ParsedRow[],
    strategy: ConflictStrategy,
  ): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, updated: 0, skipped: 0, failed: [] }
    if (rows.length === 0) return result

    const classMap  = new Map(classes.map(c => [c.name.toLowerCase().trim(), c.id]))
    const streamMap = new Map(streams.map(s => [s.name.toLowerCase().trim(), s.id]))
    const today     = new Date().toISOString().slice(0, 10)

    const BATCH = 50
    for (let offset = 0; offset < rows.length; offset += BATCH) {
      const batch = rows.slice(offset, offset + BATCH)

      const insertRows = batch.map(row => ({
        school_id:        user!.schoolId,
        admission_number: row.admission_number,
        first_name:       row.first_name,
        last_name:        row.last_name,
        dob:              row.dob?.trim() || null,
        gender:           (['m','male'].includes((row.gender ?? '').toLowerCase().trim()))
                            ? 'male'
                            : (['f','female'].includes((row.gender ?? '').toLowerCase().trim()))
                            ? 'female'
                            : null,
        nationality:      row.nationality?.trim() || null,
        religion:         row.religion?.trim() || null,
        class_id:         classMap.get(row.class?.toLowerCase().trim() ?? '') ?? null,
        stream_id:        streamMap.get(row.stream?.toLowerCase().trim() ?? '') ?? null,
        student_type:     (['day','boarder'].includes((row.student_type ?? '').toLowerCase().trim()))
                            ? row.student_type!.toLowerCase().trim()
                            : null,
        previous_school:  row.previous_school?.trim() || null,
        enrolled_at:      row.enrolled_at?.trim() || today,
        status:           'active',
      }))

      const { error } = await supabase.from('students').upsert(insertRows, {
        onConflict:       'admission_number',
        ignoreDuplicates: strategy === 'skip',
      })

      if (error) {
        batch.forEach((_, bi) =>
          result.failed.push({ row: offset + bi + 1, reason: error.message })
        )
      } else {
        result.imported += batch.length
      }
    }

    // Bust the students cache so the list re-fetches immediately
    if (result.imported > 0 || result.updated > 0) {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
    }

    return result
  }

  return (
    <>
      {/* ── Main student list ─────────────────────────────── */}
      <StudentsPage
        onRegister={() => setWizardOpen(true)}
        onImport={()   => setImportOpen(true)}
        onView={s      => setViewed(s)}
      />

      {/* ── Registration wizard ───────────────────────────── */}
      <StudentRegistrationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* ── Import wizard ─────────────────────────────────── */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Students from Excel"
        size="lg"
      >
        <ImportWizard
          context="students"
          requiredFields={REQUIRED}
          optionalFields={OPTIONAL}
          onComplete={handleImportComplete}
          onClose={() => setImportOpen(false)}
        />
      </Modal>
    </>
  )
}
