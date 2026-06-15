import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { ImportWizard } from '../../components/shared/ImportWizard'
import { generateImportTemplate } from '../../lib/importTemplates'
import type { ColumnSpec, ParsedRow, ImportResult } from '../../components/shared/ImportWizard'
import { validateStudentRow, validateStaffRow } from '../../lib/validators'

// ── Column specs ─────────────────────────────────────────────────────────────
// admission_number is OPTIONAL — the DB trigger auto-generates it when blank
const STUDENT_REQUIRED: ColumnSpec[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name',  label: 'Last Name',  required: true },
]
const STUDENT_OPTIONAL: ColumnSpec[] = [
  { key: 'admission_number', label: 'Admission Number' },
  { key: 'dob',              label: 'Date of Birth'    },
  { key: 'gender',           label: 'Gender'           },
  { key: 'class_name',       label: 'Class Name'       },
  { key: 'stream_name',      label: 'Stream Name'      },
  { key: 'student_type',     label: 'Student Type'     },
  { key: 'nationality',      label: 'Nationality'      },
  { key: 'religion',         label: 'Religion'         },
  { key: 'previous_school',  label: 'Previous School'  },
  // Parent / guardian contact
  { key: 'parent_name',         label: 'Parent Name'         },
  { key: 'parent_phone',        label: 'Parent Phone'        },
  { key: 'parent_email',        label: 'Parent Email'        },
  { key: 'parent_relationship', label: 'Parent Relationship' },
]

const STAFF_REQUIRED: ColumnSpec[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name',  label: 'Last Name',  required: true },
]
const STAFF_OPTIONAL: ColumnSpec[] = [
  { key: 'role',                 label: 'Role'                },  // defaults to 'teacher' if blank
  { key: 'staff_number',         label: 'Staff Number'        },
  { key: 'email',                label: 'Email'               },
  { key: 'phone',                label: 'Phone'               },
  { key: 'national_id',          label: 'National ID'         },
  { key: 'employment_type',      label: 'Employment Type'     },
  { key: 'department_name',      label: 'Department'          },
  { key: 'subject1',             label: 'Subject 1'           },
  { key: 'subject2',             label: 'Subject 2'           },
  { key: 'gender',               label: 'Gender'              },
  { key: 'date_of_birth',        label: 'Date of Birth'       },
  { key: 'address',              label: 'Address'             },
  { key: 'qualification_level',  label: 'Qualification Level' },
  { key: 'qualification_title',  label: 'Qualification Title' },
]

interface ImportedStudent {
  name:             string
  admission_number: string
}

// ── Download Template Button ──────────────────────────────────────────────────
function TemplateDownloadBar({ mode }: { mode: 'students' | 'staff' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 2 }}>
          Step 1 — Download the {mode === 'students' ? 'student' : 'staff'} template
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
          Fill in your data and import it below. Keep column headers exactly as shown.
        </div>
      </div>
      <button
        onClick={() => generateImportTemplate(mode)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
          border: '1.5px solid var(--brand)', background: 'transparent',
          color: 'var(--brand)', fontWeight: 700, fontSize: 13,
          fontFamily: 'var(--font1)', transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-light)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download Template (.csv)
      </button>
    </div>
  )
}


// ── Imported Students Summary ─────────────────────────────────────────────────
function ImportedStudentsSummary({ students }: { students: ImportedStudent[] }) {
  if (students.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', letterSpacing: '0.5px', marginBottom: 8, fontFamily: 'var(--font2)' }}>
        ASSIGNED ADMISSION NUMBERS
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>#</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Name</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Admission No.</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={i}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>{s.name}</td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font3)', fontWeight: 700, color: 'var(--brand)' }}>
                  {s.admission_number}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function ImportDataPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [mode, setMode]               = useState<'students' | 'staff'>('students')
  const [importYear, setImportYear]   = useState(new Date().getFullYear())
  const [importedStudents, setImportedStudents]   = useState<ImportedStudent[]>([])
  const [importSuccess, setImportSuccess]         = useState<{ count: number; type: 'students' | 'staff' } | null>(null)

  // Non-blocking year mismatch notice — shown after import, import proceeds regardless.
  type YearMismatchIssue = { className: string; level: number; selectedYear: number; expectedYear: number }
  const [yearMismatchNotice, setYearMismatchNotice] = useState<YearMismatchIssue[]>([])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const normCls = (s: string) => s.toLowerCase().replace(/\s+/g,'').replace(/\./g,'').replace(/-/g,'').replace(/^senior/,'s').replace(/^form/,'s')

  function extractLevel(name: string): number | null {
    const n = normCls(name)
    const m = n.match(/^[spf](\d)/)
    return m ? parseInt(m[1]) : null
  }

  // ── Student import handler ──────────────────────────────────────────────────
  // Rule: same first_name + last_name + same class → UPDATE existing student
  //       anything else (different class, or new name) → INSERT
  //       admission number year = importYear state (default = current year)
  async function handleStudentImport(rows: ParsedRow[]): Promise<ImportResult> {
    if (!user) throw new Error('Not authenticated')
    const failedItems: Array<{ row: number; reason: string }> = []
    let imported = 0
    let updated  = 0
    const newStudentResults: ImportedStudent[] = []

    // ── Year mismatch check ─────────────────────────────────────────────────
    // For each unique class in the CSV, check whether importYear aligns with
    // the expected enrollment year (when they would have been in S.1).
    const currentCalYear = new Date().getFullYear()
    const uniqueClasses  = [...new Set(rows.map(r => String(r.class_name ?? '').trim()).filter(Boolean))]
    const mismatchIssues: Array<{ className: string; level: number; selectedYear: number; expectedYear: number }> = []

    for (const className of uniqueClasses) {
      const level = extractLevel(className)
      if (level === null) continue
      const expectedYear = currentCalYear - (level - 1)  // year they would have enrolled in S.1
      if (importYear !== expectedYear) {
        mismatchIssues.push({ className, level, selectedYear: importYear, expectedYear })
      }
    }

    if (mismatchIssues.length > 0) {
      // Non-blocking — record the warning and continue importing
      setYearMismatchNotice(mismatchIssues)
    }

    // ── Pre-fetch everything needed in parallel ─────────────────────────────
    const firstNames = [...new Set(rows.map(r => String(r.first_name ?? '').trim()).filter(Boolean))]
    const [classesRes, streamsRes, yearRes, existingRes, schoolRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', user!.schoolId),
      supabase.from('streams').select('id, name, class_id').eq('school_id', user!.schoolId),
      supabase.from('academic_years').select('id').eq('school_id', user!.schoolId).eq('is_active', true).maybeSingle(),
      firstNames.length > 0
        ? supabase.from('students').select('id, first_name, last_name, admission_number, class_id').eq('school_id', user!.schoolId).in('first_name', firstNames)
        : Promise.resolve({ data: [] }),
      supabase.from('school_profile').select('short_name').eq('id', user!.schoolId).single(),
    ])

    const activeYearId = (yearRes.data as any)?.id as string | null
    const shortName    = ((schoolRes as any).data?.short_name as string | null) ?? 'SCHOOL'
    const classMap     = new Map<string, string>((classesRes.data ?? []).map((c: any) => [normCls(c.name as string), c.id as string]))
    const streamMap    = new Map<string, string>()
    ;(streamsRes.data ?? []).forEach((s: any) => streamMap.set(`${s.class_id}::${(s.name as string).toLowerCase().trim()}`, s.id as string))

    // For historical import years, pre-compute admission number sequence
    // (the DB trigger uses NOW() year — for other years we supply the number ourselves)
    let admSeqOffset = 0
    const useHistoricalYear = importYear !== currentCalYear
    if (useHistoricalYear) {
      const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user!.schoolId)
        .like('admission_number', `${shortName}/${importYear}/%`)
      admSeqOffset = count ?? 0
    }
    let newStudentSeq = admSeqOffset

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

      // Normalise gender
      const rawGender = r.gender ? String(r.gender).trim().toLowerCase() : null
      const gender    = rawGender === 'male' || rawGender === 'female' ? rawGender : null

      // Resolve class + stream IDs
      const rawClassName  = r.class_name  ? String(r.class_name).trim()  : ''
      const rawStreamName = r.stream_name ? String(r.stream_name).trim() : ''
      const classId  = rawClassName  ? (classMap.get(normCls(rawClassName))  ?? null) : null
      const streamId = (classId && rawStreamName) ? (streamMap.get(`${classId}::${rawStreamName.toLowerCase()}`) ?? null) : null

      // Match rule: same name + same class → update existing
      const matchKey  = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${classId ?? ''}`
      const existing  = existingMap.get(matchKey)

      if (existing) {
        // UPDATE — student with same name already in the same class
        const patch: Record<string, unknown> = {
          first_name:   firstName,
          last_name:    lastName,
          dob:          r.dob ? String(r.dob) : undefined,
          gender,
          student_type: r.student_type ? String(r.student_type).toLowerCase() : undefined,
          nationality:  r.nationality  ? String(r.nationality)  : undefined,
          religion:     r.religion     ? String(r.religion)     : undefined,
          previous_school: r.previous_school ? String(r.previous_school) : undefined,
        }
        if (streamId)              patch.stream_id        = streamId
        if (activeYearId && classId) patch.academic_year_id = activeYearId
        const { error } = await supabase.from('students').update(patch).eq('id', existing.id).eq('school_id', user!.schoolId)
        if (error) {
          failedItems.push({ row: i + 2, reason: error.message })
        } else {
          updated++
          newStudentResults.push({ name: `${firstName} ${lastName}`, admission_number: existing.admissionNumber })
          // Upsert guardian if parent columns provided
          await upsertGuardian(existing.id, r)
        }
      } else {
        // INSERT — new student
        // For current year: leave admission_number null → DB trigger auto-generates SCHOOL/YEAR/NNNN
        // For historical years: pre-compute the number with the correct year
        const insertData: Record<string, unknown> = {
          school_id:    user!.schoolId,
          first_name:   firstName,
          last_name:    lastName,
          dob:          r.dob ? String(r.dob) : null,
          gender,
          student_type: r.student_type ? String(r.student_type).toLowerCase() : 'day',
          status:       'active',
          enrolled_at:  new Date(importYear, 0, 1).toISOString(),
          nationality:  r.nationality  ? String(r.nationality)  : 'Ugandan',
          religion:     r.religion     ? String(r.religion)     : null,
          previous_school: r.previous_school ? String(r.previous_school) : null,
        }
        if (classId)               insertData.class_id         = classId
        if (streamId)              insertData.stream_id        = streamId
        if (activeYearId && classId) insertData.academic_year_id = activeYearId
        if (useHistoricalYear) {
          const seq = String(++newStudentSeq).padStart(4, '0')
          insertData.admission_number = `${shortName}/${importYear}/${seq}`
        }
        // Allow CSV-supplied admission_number to override the auto-generated one
        if (r.admission_number && String(r.admission_number).trim()) {
          insertData.admission_number = String(r.admission_number).trim()
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
            // Insert guardian if parent columns provided
            await upsertGuardian(inserted.id as string, r)
          }
        }
      }
    }

    // ── Helper: insert a student_guardians row from CSV parent columns ───────
    async function upsertGuardian(studentId: string, r: ParsedRow): Promise<void> {
      const parentName = r.parent_name ? String(r.parent_name).trim() : ''
      if (!parentName) return

      await supabase.from('student_guardians').insert({
        school_id:       user!.schoolId,
        student_id:      studentId,
        full_name:       parentName,
        relationship:    r.parent_relationship ? String(r.parent_relationship).trim() : 'Parent',
        phone:           r.parent_phone  ? String(r.parent_phone).trim()  : null,
        email:           r.parent_email  ? String(r.parent_email).trim()  : null,
        is_primary:      true,
        comms_preference:'sms',
        do_not_contact:  false,
      })
      // Silently ignore errors (e.g. duplicate) — guardian is supplemental
    }

    void qc.invalidateQueries({ queryKey: ['students', user.schoolId] })
    setImportedStudents(newStudentResults)

    // Set activation flag and success metadata
    if (imported > 0) {
      localStorage.setItem('shule_pending_activations', JSON.stringify({
        type:       'students',
        count:      imported,
        importedAt: new Date().toISOString(),
      }))
    }
    setImportSuccess({ count: imported + updated, type: 'students' })

    return { imported, updated, skipped: 0, failed: failedItems }
  }

  // ── Staff import handler ────────────────────────────────────────────────────
  async function handleStaffImport(rows: ParsedRow[]): Promise<ImportResult> {
    if (!user) throw new Error('Not authenticated')
    const failedItems: Array<{ row: number; reason: string }> = []
    let imported = 0

    // ── Singleton role enforcement (principal + deputy: max 1 per school) ──
    const SINGLETON_ROLES = ['principal', 'deputy'] as const
    for (const role of SINGLETON_ROLES) {
      const inFile = rows.filter(r => String(r.role ?? '').trim().toLowerCase() === role)
      if (inFile.length > 1) {
        inFile.slice(1).forEach((_, idx) => {
          failedItems.push({ row: rows.indexOf(inFile[idx + 1]) + 2, reason: `Only one ${role} allowed per school — duplicate skipped` })
        })
      }
      if (inFile.length >= 1) {
        const { count } = await supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', user!.schoolId)
          .eq('role', role)
          .eq('is_active', true)
        if ((count ?? 0) > 0) {
          inFile.forEach(r => {
            failedItems.push({ row: rows.indexOf(r) + 2, reason: `A ${role} already exists in this school — cannot import a second one` })
          })
        }
      }
    }

    // Filter out rows already flagged as failed before batch insert
    const singletonFailedIdxs = new Set(failedItems.map(f => f.row - 2))
    const validRows = rows.filter((_, i) => !singletonFailedIdxs.has(i))

    // Pre-fetch departments to resolve department_name → department_id
    const { data: deptData } = await supabase
      .from('departments')
      .select('id, name')
      .eq('school_id', user!.schoolId)
    const deptMap = new Map<string, string>()
    ;(deptData ?? []).forEach((d: { id: string; name: string }) => {
      deptMap.set(d.name.toLowerCase().trim(), d.id)
    })

    for (let i = 0; i < validRows.length; i += 50) {
      const batch = validRows.slice(i, i + 50)
      const inserts = batch.map(r => {
        // Build subjects array from subject1/subject2 columns
        const subjectsArr: string[] = []
        const s1 = r.subject1 ? String(r.subject1).trim() : ''
        const s2 = r.subject2 ? String(r.subject2).trim() : ''
        if (s1) subjectsArr.push(s1)
        if (s2) subjectsArr.push(s2)

        // Resolve department
        const deptName = r.department_name ? String(r.department_name).trim() : ''
        const departmentId = deptName ? (deptMap.get(deptName.toLowerCase()) ?? null) : null

        const data: Record<string, unknown> = {
          school_id:       user!.schoolId,
          first_name:      String(r.first_name ?? '').trim(),
          last_name:       String(r.last_name ?? '').trim(),
          role:            String(r.role ?? 'teacher').trim() || 'teacher',
          email:           r.email ? String(r.email).trim() : null,
          phone:           r.phone ? String(r.phone).trim() : null,
          national_id:     r.national_id ? String(r.national_id).trim() : null,
          employment_type: r.employment_type ? String(r.employment_type).trim() : 'full_time',
          qualification_level: r.qualification_level ? String(r.qualification_level).trim() : null,
          qualification_title: r.qualification_title ? String(r.qualification_title).trim() : null,
          gender:          r.gender ? String(r.gender).trim().toLowerCase() : null,
          date_of_birth:   r.date_of_birth ? String(r.date_of_birth).trim() : null,
          address:         r.address ? String(r.address).trim() : null,
          is_active:       true,
          join_date:       new Date().toISOString().slice(0, 10),
        }
        if (subjectsArr.length > 0) data.subjects = subjectsArr
        if (departmentId)           data.department_id = departmentId
        // Include staff_number only if provided
        if (r.staff_number && String(r.staff_number).trim()) {
          data.staff_number = String(r.staff_number).trim()
        }
        return data
      })

      const { error } = await supabase.from('staff').insert(inserts)
      if (error) {
        batch.forEach((_, j) => failedItems.push({ row: i + j + 2, reason: error.message }))
      } else {
        imported += batch.length
      }
    }

    void qc.invalidateQueries({ queryKey: ['staff', user.schoolId] })
    setImportSuccess({ count: imported, type: 'staff' })
    return { imported, updated: 0, skipped: 0, failed: failedItems }
  }

  // ── Year-mismatch warning dialog ───────────────────────────────────────────
  const currentCalYear = new Date().getFullYear()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <PageHeader />

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['students', 'staff'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setImportSuccess(null); setImportedStudents([]); setYearMismatchNotice([]) }}
            style={{ padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize', border: 'none', background: mode === m ? 'linear-gradient(145deg,var(--brand),var(--brand-dark))' : 'var(--surface2)', color: mode === m ? '#fff' : 'var(--txt2)', boxShadow: mode === m ? '0 3px 12px rgba(13,148,136,.3)' : 'none' }}>
            Import {m}
          </button>
        ))}
      </div>

      {/* Year picker — students only */}
      {mode === 'students' && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', boxShadow: '0 2px 10px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(13,148,136,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>Enrollment Year</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>Year stamped on auto-generated admission numbers</div>
            </div>
          </div>
          <select
            value={importYear}
            onChange={e => setImportYear(Number(e.target.value))}
            className="sui-input"
            style={{ minWidth: 120 }}
          >
            {Array.from({ length: 12 }, (_, i) => currentCalYear - i).map(y => (
              <option key={y} value={y}>{y}{y === currentCalYear ? ' (Current)' : ''}</option>
            ))}
          </select>
          <div style={{ fontSize: 11.5, color: 'var(--txt3)', flex: 1 }}>
            Admission numbers will be generated as{' '}
            <span style={{ fontFamily: 'var(--font3)', fontWeight: 700, color: 'var(--brand)' }}>NYCS/{importYear}/0001</span>,{' '}
            <span style={{ fontFamily: 'var(--font3)', fontWeight: 700, color: 'var(--brand)' }}>NYCS/{importYear}/0002</span>, …
          </div>
        </div>
      )}

      {/* Download template bar */}
      <TemplateDownloadBar mode={mode} />

      {/* Wizard */}
      <ImportWizard
        key={`${mode}-${importYear}`}
        context={mode}
        requiredFields={mode === 'students' ? STUDENT_REQUIRED : STAFF_REQUIRED}
        optionalFields={mode === 'students' ? STUDENT_OPTIONAL : STAFF_OPTIONAL}
        onComplete={mode === 'students' ? handleStudentImport : handleStaffImport}
        validateRow={mode === 'students' ? validateStudentRow : validateStaffRow}
      />

      {/* Year-mismatch inline notice (non-blocking) */}
      {yearMismatchNotice.length > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2.2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--warning)' }}>Year Mismatch Notice</div>
            <button onClick={() => setYearMismatchNotice([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: '10px', lineHeight: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {yearMismatchNotice.map(iss => (
              <div key={iss.className} style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.55 }}>
                <strong>{iss.className}</strong> — enrolled year {iss.selectedYear} but S.{iss.level} students in {currentCalYear} would normally enroll in{' '}
                <strong>{iss.expectedYear}</strong>. Import succeeded; double-check if this is intentional.
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-import: student activation notice + assigned numbers */}
      {importSuccess?.type === 'students' && importSuccess.count > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--success)', marginBottom: 6 }}>
            Successfully imported {importSuccess.count} student{importSuccess.count > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--txt2)', marginBottom: 10 }}>
            New accounts may need activation.{' '}
            <button
              onClick={() => { window.location.href = '/admin/users' }}
              style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Go to IT Admin to activate accounts →
            </button>
          </div>
          <ImportedStudentsSummary students={importedStudents} />
        </div>
      )}

      {importSuccess?.type === 'staff' && importSuccess.count > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--success)' }}>
            Successfully imported {importSuccess.count} staff member{importSuccess.count > 1 ? 's' : ''}.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 4 }}>
            Go to{' '}
            <button
              onClick={() => { window.location.href = '/admin/users' }}
              style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              IT Admin
            </button>
            {' '}to issue login credentials.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
      <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(14,165,233,.45)', flexShrink: 0 }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </div>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Import Data</h1>
        <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Batch import students or staff from a spreadsheet</p>
      </div>
    </div>
  )
}

// ── Shared table styles ───────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase',
  color: 'var(--txt3)', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)',
  background: 'var(--surface2)', fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)',
  color: 'var(--txt2)', fontSize: 12, verticalAlign: 'middle',
}
