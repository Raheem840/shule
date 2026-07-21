// Shared student CSV/Excel import logic — used by BOTH SecretaryStudentsPage's
// dedicated import and the generic ImportDataPage, so the two entry points
// behave identically instead of diverging (different required columns,
// different match/update rules, one handling guardians and one not).
import { supabase } from './supabase'
import type { ColumnSpec, ParsedRow, ConflictStrategy } from '../components/shared/ImportWizard'

// admission_number is OPTIONAL — the DB trigger auto-generates it when blank
export const STUDENT_IMPORT_REQUIRED: ColumnSpec[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name',  label: 'Last Name',  required: true },
  { key: 'class_name', label: 'Class Name', required: true },
]

export const STUDENT_IMPORT_OPTIONAL: ColumnSpec[] = [
  { key: 'admission_number', label: 'Admission Number' },
  { key: 'dob',              label: 'Date of Birth'    },
  {
    key: 'gender', label: 'Gender',
    validate: v => !v || ['male', 'female', 'm', 'f'].includes(v.toLowerCase()) ? null : 'Must be Male or Female',
  },
  { key: 'stream_name',      label: 'Stream Name'      },
  {
    key: 'student_type', label: 'Student Type',
    validate: v => !v || ['day', 'boarder'].includes(v.toLowerCase()) ? null : 'Must be Day or Boarder',
  },
  { key: 'nationality',      label: 'Nationality'      },
  { key: 'religion',         label: 'Religion'         },
  { key: 'previous_school',  label: 'Previous School'  },
  // Parent / guardian contact
  { key: 'parent_name',         label: 'Parent Name'         },
  { key: 'parent_phone',        label: 'Parent Phone'        },
  { key: 'parent_email',        label: 'Parent Email'        },
  { key: 'parent_relationship', label: 'Parent Relationship' },
]

export type ImportedStudentSummary = { name: string; admission_number: string }
export type YearMismatchIssue = { className: string; level: number; selectedYear: number; expectedYear: number }

export interface StudentImportOutcome {
  imported: number
  updated: number
  skipped: number
  failed: Array<{ row: number; reason: string }>
  newStudentResults: ImportedStudentSummary[]
  yearMismatchIssues: YearMismatchIssue[]
}

const normCls = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/\./g, '').replace(/-/g, '').replace(/^senior/, 's').replace(/^form/, 's')

// Escapes ilike wildcard metacharacters (% and _) so a guardian name containing
// them is matched literally instead of as a SQL LIKE pattern.
const escapeIlike = (s: string) => s.replace(/[%_\\]/g, c => `\\${c}`)

function extractLevel(name: string): number | null {
  const n = normCls(name)
  const m = n.match(/^[spf](\d)/)
  return m ? parseInt(m[1]) : null
}

// Inserts a new guardian from CSV parent_* columns, or UPDATES the existing
// one if a guardian with the same name already exists for this student —
// re-importing the same CSV must overwrite, not pile up duplicate rows.
async function upsertGuardianFromRow(schoolId: string, studentId: string, r: ParsedRow): Promise<void> {
  const parentName = r.parent_name ? String(r.parent_name).trim() : ''
  if (!parentName) return

  const patch = {
    relationship:    r.parent_relationship ? String(r.parent_relationship).trim() : 'Parent',
    phone:           r.parent_phone ? String(r.parent_phone).trim() : null,
    email:           r.parent_email ? String(r.parent_email).trim() : null,
  }

  const { data: existing } = await supabase
    .from('student_guardians')
    .select('id')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .ilike('full_name', escapeIlike(parentName))
    .maybeSingle()

  if (existing) {
    await supabase.from('student_guardians').update(patch).eq('id', existing.id).eq('school_id', schoolId)
  } else {
    await supabase.from('student_guardians').insert({
      school_id:        schoolId,
      student_id:       studentId,
      full_name:        parentName,
      is_primary:       true,
      comms_preference: 'sms',
      do_not_contact:   false,
      ...patch,
    })
  }
  // Errors here are non-fatal — guardian is supplemental to the student record.
}

// Rule: same first_name + last_name + same class → UPDATE existing student
//       (overwrites profile fields present in the CSV, doesn't pile up duplicates)
//       anything else (different class, or new name) → INSERT
// `strategy: 'skip'` leaves matched existing students (and their guardians)
// untouched instead of updating them — matches the ImportWizard's own
// "Skip duplicates" promise ("left unchanged").
export async function importStudentsFromCsv(
  rows: ParsedRow[],
  schoolId: string,
  importYear: number,
  strategy: ConflictStrategy = 'upsert',
): Promise<StudentImportOutcome> {
  const failedItems: Array<{ row: number; reason: string }> = []
  let imported = 0
  let updated  = 0
  let skipped  = 0
  const newStudentResults: ImportedStudentSummary[] = []

  // ── Year mismatch check ─────────────────────────────────────────────────
  const currentCalYear = new Date().getFullYear()
  const uniqueClasses  = [...new Set(rows.map(r => String(r.class_name ?? '').trim()).filter(Boolean))]
  const yearMismatchIssues: YearMismatchIssue[] = []
  for (const className of uniqueClasses) {
    const level = extractLevel(className)
    if (level === null) continue
    const expectedYear = currentCalYear - (level - 1)
    if (importYear !== expectedYear) {
      yearMismatchIssues.push({ className, level, selectedYear: importYear, expectedYear })
    }
  }

  // ── Pre-fetch everything needed in parallel ─────────────────────────────
  const firstNames = [...new Set(rows.map(r => String(r.first_name ?? '').trim()).filter(Boolean))]
  const [classesRes, streamsRes, yearRes, existingRes] = await Promise.all([
    supabase.from('classes').select('id, name').eq('school_id', schoolId),
    supabase.from('streams').select('id, name, class_id').eq('school_id', schoolId),
    supabase.from('academic_years').select('id').eq('school_id', schoolId).eq('is_active', true).maybeSingle(),
    firstNames.length > 0
      ? supabase.from('students').select('id, first_name, last_name, admission_number, class_id').eq('school_id', schoolId).in('first_name', firstNames)
      : Promise.resolve({ data: [] }),
  ])

  const activeYearId = (yearRes.data as any)?.id as string | null
  const classMap     = new Map<string, string>((classesRes.data ?? []).map((c: any) => [normCls(c.name as string), c.id as string]))
  const streamMap    = new Map<string, string>()
  ;(streamsRes.data ?? []).forEach((s: any) => streamMap.set(`${s.class_id}::${(s.name as string).toLowerCase().trim()}`, s.id as string))

  // For historical import years the DB trigger can't help (it always uses
  // NOW()'s year), so each new row's admission number is reserved via the
  // reserve_admission_number(school_id, year) RPC — takes the same
  // advisory lock the trigger itself uses, so it can't collide with a
  // concurrent live registration or the trigger's own current-year path.
  // Previously this was an in-memory counter seeded once from a COUNT()
  // with no locking at all, so two concurrent historical-year imports for
  // the same school+year could generate the exact same numbers.
  const useHistoricalYear = importYear !== currentCalYear
  const ADMISSION_NUMBER_RE = /^STU\/\d{4}\/\d{8}$/

  // Build lookup: "firstName|lastName|classId" → existing student
  const existingMap = new Map<string, { id: string; admissionNumber: string }>()
  ;((existingRes as any).data ?? []).forEach((e: any) => {
    const key = `${(e.first_name as string).toLowerCase().trim()}|${(e.last_name as string).toLowerCase().trim()}|${e.class_id ?? ''}`
    existingMap.set(key, { id: e.id as string, admissionNumber: e.admission_number as string })
  })

  for (let i = 0; i < rows.length; i++) {
    const r         = rows[i]
    const firstName = String(r.first_name ?? '').trim()
    const lastName  = String(r.last_name  ?? '').trim()
    if (!firstName || !lastName) {
      failedItems.push({ row: i + 2, reason: 'First name and last name are required' })
      continue
    }

    const rawGender = r.gender ? String(r.gender).trim().toLowerCase() : null
    const gender    = rawGender === 'male' || rawGender === 'female' || rawGender === 'm' || rawGender === 'f'
      ? (rawGender[0] === 'm' ? 'male' : 'female')
      : null

    const rawClassName  = r.class_name  ? String(r.class_name).trim()  : ''
    const rawStreamName = r.stream_name ? String(r.stream_name).trim() : ''
    const classId  = rawClassName  ? (classMap.get(normCls(rawClassName))  ?? null) : null
    const streamId = (classId && rawStreamName) ? (streamMap.get(`${classId}::${rawStreamName.toLowerCase()}`) ?? null) : null

    const matchKey  = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${classId ?? ''}`
    const existing  = existingMap.get(matchKey)

    if (existing) {
      if (strategy === 'skip') {
        // Leave the existing student (and guardians) untouched.
        skipped++
        newStudentResults.push({ name: `${firstName} ${lastName}`, admission_number: existing.admissionNumber })
        continue
      }
      // UPDATE — student with same name already in the same class. Overwrites
      // only the profile fields actually present in the CSV row; blank cells
      // leave the existing DB value alone rather than wiping it to null.
      const patch: Record<string, unknown> = {
        first_name: firstName,
        last_name:  lastName,
      }
      if (r.dob)                    patch.dob             = String(r.dob)
      if (gender)                   patch.gender          = gender
      if (r.student_type)           patch.student_type    = String(r.student_type).toLowerCase()
      if (r.nationality)            patch.nationality     = String(r.nationality)
      if (r.religion)               patch.religion        = String(r.religion)
      if (r.previous_school)        patch.previous_school = String(r.previous_school)
      if (streamId)                 patch.stream_id       = streamId
      if (activeYearId && classId)  patch.academic_year_id = activeYearId
      const { error } = await supabase.from('students').update(patch).eq('id', existing.id).eq('school_id', schoolId)
      if (error) {
        failedItems.push({ row: i + 2, reason: error.message })
      } else {
        updated++
        newStudentResults.push({ name: `${firstName} ${lastName}`, admission_number: existing.admissionNumber })
        await upsertGuardianFromRow(schoolId, existing.id, r)
      }
    } else if (!classId) {
      // A student must belong to a class — reject rather than silently import with class_id: null
      failedItems.push({
        row: i + 2,
        reason: rawClassName
          ? `Class "${rawClassName}" does not match any existing class`
          : 'Class is required',
      })
    } else {
      // INSERT — new student.
      // For current year: leave admission_number null → DB trigger auto-generates SCHOOL/YEAR/NNNN
      // For historical years: pre-compute the number with the correct year
      const insertData: Record<string, unknown> = {
        school_id:       schoolId,
        first_name:      firstName,
        last_name:       lastName,
        dob:             r.dob ? String(r.dob) : null,
        gender,
        student_type:    r.student_type ? String(r.student_type).toLowerCase() : 'day',
        status:          'active',
        // Current-year imports enroll "today"; historical-year imports (bulk
        // backfills) have no real enrollment date, so default to Jan 1 of that year.
        enrolled_at:     useHistoricalYear ? new Date(importYear, 0, 1).toISOString() : new Date().toISOString(),
        nationality:     r.nationality  ? String(r.nationality)  : 'Ugandan',
        religion:        r.religion     ? String(r.religion)     : null,
        previous_school: r.previous_school ? String(r.previous_school) : null,
        class_id:        classId,
        stream_id:       streamId,
      }
      if (activeYearId) insertData.academic_year_id = activeYearId
      if (useHistoricalYear) {
        const { data: reserved, error: reserveErr } = await supabase
          .rpc('reserve_admission_number', { p_school_id: schoolId, p_year: importYear })
        if (reserveErr) {
          failedItems.push({ row: i + 2, reason: `Could not reserve an admission number: ${reserveErr.message}` })
          continue
        }
        insertData.admission_number = reserved as string
      }
      // Allow CSV-supplied admission_number to override the auto-generated
      // one — but only if it actually matches the agreed format, so a bulk
      // import can't silently seed the table with malformed numbers (a
      // single manual edit in the registration wizard is still allowed to
      // be more flexible; this is specifically the higher-volume,
      // less-reviewed bulk path).
      if (r.admission_number && String(r.admission_number).trim()) {
        const candidate = String(r.admission_number).trim()
        if (!ADMISSION_NUMBER_RE.test(candidate)) {
          failedItems.push({
            row: i + 2,
            reason: `Admission number "${candidate}" doesn't match the required format STU/YYYY/00000001`,
          })
          continue
        }
        insertData.admission_number = candidate
      }

      const { data: inserted, error } = await supabase
        .from('students').insert(insertData)
        .select('id, first_name, last_name, admission_number').single()

      if (error) {
        failedItems.push({ row: i + 2, reason: error.message })
      } else {
        imported++
        if (inserted) {
          newStudentResults.push({
            name:             `${inserted.first_name} ${inserted.last_name}`,
            admission_number: inserted.admission_number as string,
          })
          await upsertGuardianFromRow(schoolId, inserted.id as string, r)
        }
      }
    }
  }

  return { imported, updated, skipped, failed: failedItems, newStudentResults, yearMismatchIssues }
}
