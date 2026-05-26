import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { ImportWizard } from '../../components/shared/ImportWizard'
import { PageHeader } from '../../components/ui/PageHeader'
import type { ColumnSpec, ParsedRow, ImportResult } from '../../components/shared/ImportWizard'

const STUDENT_REQUIRED: ColumnSpec[] = [
  { key: 'first_name',       label: 'First Name',       required: true },
  { key: 'last_name',        label: 'Last Name',        required: true },
  { key: 'admission_number', label: 'Admission Number', required: true },
]
const STUDENT_OPTIONAL: ColumnSpec[] = [
  { key: 'dob',            label: 'Date of Birth'  },
  { key: 'gender',         label: 'Gender'         },
  { key: 'class_name',     label: 'Class Name'     },
  { key: 'stream_name',    label: 'Stream Name'    },
  { key: 'student_type',   label: 'Student Type'   },
  { key: 'nationality',    label: 'Nationality'    },
]

const STAFF_REQUIRED: ColumnSpec[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name',  label: 'Last Name',  required: true },
  { key: 'role',       label: 'Role',       required: true },
]
const STAFF_OPTIONAL: ColumnSpec[] = [
  { key: 'email',            label: 'Email'           },
  { key: 'phone',            label: 'Phone'           },
  { key: 'national_id',      label: 'National ID'     },
  { key: 'employment_type',  label: 'Employment Type' },
  { key: 'department_name',  label: 'Department'      },
]

export function ImportDataPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'students' | 'staff'>('students')

  async function handleStudentImport(rows: ParsedRow[]): Promise<ImportResult> {
    const failedItems: Array<{ row: number; reason: string }> = []
    let imported = 0; let updated = 0

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const inserts = batch.map(r => ({
        school_id:        user!.schoolId,
        first_name:       String(r.first_name ?? ''),
        last_name:        String(r.last_name ?? ''),
        admission_number: String(r.admission_number ?? ''),
        dob:              r.dob ? String(r.dob) : null,
        gender:           r.gender ? String(r.gender) : null,
        student_type:     r.student_type ? String(r.student_type) : 'day',
        status:           'active',
        enrolled_at:      new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('students')
        .upsert(inserts, { onConflict: 'school_id,admission_number', ignoreDuplicates: false })

      if (error) {
        batch.forEach((_, j) => failedItems.push({ row: i + j + 2, reason: error.message }))
      } else {
        imported += batch.length
      }
    }

    void qc.invalidateQueries({ queryKey: ['students'] })
    return { imported, updated, skipped: 0, failed: failedItems }
  }

  async function handleStaffImport(rows: ParsedRow[]): Promise<ImportResult> {
    const failedItems: Array<{ row: number; reason: string }> = []
    let imported = 0

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const inserts = batch.map(r => ({
        school_id:       user!.schoolId,
        first_name:      String(r.first_name ?? ''),
        last_name:       String(r.last_name ?? ''),
        role:            String(r.role ?? 'teacher'),
        email:           r.email ? String(r.email) : null,
        phone:           r.phone ? String(r.phone) : null,
        national_id:     r.national_id ? String(r.national_id) : null,
        employment_type: r.employment_type ? String(r.employment_type) : 'permanent',
        is_active:       true,
        join_date:       new Date().toISOString().slice(0, 10),
      }))

      const { error } = await supabase.from('staff').insert(inserts)
      if (error) {
        batch.forEach((_, j) => failedItems.push({ row: i + j + 2, reason: error.message }))
      } else {
        imported += batch.length
      }
    }

    void qc.invalidateQueries({ queryKey: ['staff'] })
    return { imported, updated: 0, skipped: 0, failed: failedItems }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader title="Import Data" subtitle="Batch import students or staff from a spreadsheet." />

      <div style={{ display: 'flex', gap: 8 }}>
        {(['students', 'staff'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={mode === m ? 'sui-btn-primary' : 'sui-btn-ghost'}
            style={{ textTransform: 'capitalize' }}>
            Import {m}
          </button>
        ))}
      </div>

      <ImportWizard
        key={mode}
        context={mode}
        requiredFields={mode === 'students' ? STUDENT_REQUIRED : STAFF_REQUIRED}
        optionalFields={mode === 'students' ? STUDENT_OPTIONAL : STAFF_OPTIONAL}
        onComplete={mode === 'students' ? handleStudentImport : handleStaffImport}
      />
    </div>
  )
}
