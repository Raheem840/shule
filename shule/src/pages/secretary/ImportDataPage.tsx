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
  { key: 'admission_number', label: 'Admission Number' },  // optional: leave blank for auto-generation
  { key: 'dob',              label: 'Date of Birth'    },
  { key: 'gender',           label: 'Gender'           },
  { key: 'class_name',       label: 'Class Name'       },
  { key: 'stream_name',      label: 'Stream Name'      },
  { key: 'student_type',     label: 'Student Type'     },
  { key: 'nationality',      label: 'Nationality'      },
  { key: 'religion',         label: 'Religion'         },
  { key: 'previous_school',  label: 'Previous School'  },
]

const STAFF_REQUIRED: ColumnSpec[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name',  label: 'Last Name',  required: true },
  { key: 'role',       label: 'Role',       required: true },
]
const STAFF_OPTIONAL: ColumnSpec[] = [
  { key: 'staff_number',       label: 'Staff Number'      },  // optional: provide existing or leave blank
  { key: 'email',              label: 'Email'             },
  { key: 'phone',              label: 'Phone'             },
  { key: 'national_id',        label: 'National ID'       },
  { key: 'employment_type',    label: 'Employment Type'   },
  { key: 'department_name',    label: 'Department'        },
  { key: 'qualification_level', label: 'Qualification Level' },
  { key: 'qualification_title', label: 'Qualification Title' },
]

// ── Types ─────────────────────────────────────────────────────────────────────
interface Collision {
  rowIndex:     number   // 0-based index into the rows being imported
  firstName:    string
  lastName:     string
  existingId:   string
  existingAdm:  string
  existingClass?: string
  resolution:   'update' | 'create'
}

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

// ── Collision Review UI ───────────────────────────────────────────────────────
function CollisionReview({
  collisions,
  onChange,
}: {
  collisions: Collision[]
  onChange: (id: string, resolution: 'update' | 'create') => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 10, fontSize: 12.5, color: 'var(--warning)', fontWeight: 700,
      }}>
        {collisions.length} name collision{collisions.length > 1 ? 's' : ''} detected — review each one before importing
      </div>
      {collisions.map(c => (
        <div key={c.existingId} style={{
          padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>
                Row {c.rowIndex + 2}: {c.firstName} {c.lastName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                Already exists — Adm: <strong style={{ color: 'var(--txt2)' }}>{c.existingAdm}</strong>
                {c.existingClass && <> · Class: <strong style={{ color: 'var(--txt2)' }}>{c.existingClass}</strong></>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['update', 'create'] as const).map(opt => {
              const selected = c.resolution === opt
              return (
                <label key={opt} style={{
                  flex: 1, display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                  border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border)'}`,
                  background: selected ? 'var(--brand-light)' : 'var(--surface2)',
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name={`collision-${c.existingId}`}
                    checked={selected}
                    onChange={() => onChange(c.existingId, opt)}
                    style={{ accentColor: 'var(--brand)', marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: selected ? 'var(--brand)' : 'var(--txt)' }}>
                      {opt === 'update' ? 'Same person — update existing record' : 'Different person — create new record'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>
                      {opt === 'update'
                        ? 'Overwrites the existing student\'s data with values from this row'
                        : 'Creates a new student entry with a new admission number'}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      ))}
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
  const [collisions, setCollisions]   = useState<Collision[]>([])
  const [pendingRows, setPendingRows] = useState<ParsedRow[] | null>(null)
  const [showCollisionStep, setShowCollisionStep] = useState(false)
  const [importedStudents, setImportedStudents]   = useState<ImportedStudent[]>([])
  const [importSuccess, setImportSuccess]         = useState<{ count: number; type: 'students' | 'staff' } | null>(null)

  // ── Detect collisions for students ─────────────────────────────────────────
  async function detectStudentCollisions(rows: ParsedRow[]): Promise<Collision[]> {
    const firstNames = rows.map(r => String(r.first_name ?? '').trim()).filter(Boolean)
    if (firstNames.length === 0) return []

    const { data: existing } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, class_id')
      .eq('school_id', user!.schoolId)
      .in('first_name', firstNames)

    if (!existing || existing.length === 0) return []

    const result: Collision[] = []
    rows.forEach((row, i) => {
      const first = String(row.first_name ?? '').trim().toLowerCase()
      const last  = String(row.last_name ?? '').trim().toLowerCase()
      const match = existing.find(e =>
        e.first_name.toLowerCase().trim() === first &&
        e.last_name.toLowerCase().trim()  === last
      )
      if (match) {
        result.push({
          rowIndex:     i,
          firstName:    String(row.first_name),
          lastName:     String(row.last_name),
          existingId:   match.id as string,
          existingAdm:  match.admission_number as string,
          existingClass: match.class_id ? `class_id:${match.class_id}` : undefined,
          resolution:   'update',
        })
      }
    })
    return result
  }

  // ── Student import handler ──────────────────────────────────────────────────
  async function handleStudentImport(rows: ParsedRow[]): Promise<ImportResult> {
    // Detect collisions first
    const detected = await detectStudentCollisions(rows)

    if (detected.length > 0 && !showCollisionStep) {
      // Stash rows and show collision review
      setPendingRows(rows)
      setCollisions(detected)
      setShowCollisionStep(true)
      // Return a "pending" result so the wizard waits — we'll actually return
      // a real result once collisions are resolved by the outer UI below
      return { imported: 0, updated: 0, skipped: 0, failed: [] }
    }

    // Resolve rows based on collision decisions
    const resolvedCollisions = collisions.length > 0 ? collisions : detected
    const failedItems: Array<{ row: number; reason: string }> = []
    let imported = 0
    let updated  = 0
    const newStudentResults: ImportedStudent[] = []

    for (let i = 0; i < rows.length; i++) {
      const r          = rows[i]
      const collision  = resolvedCollisions.find(c => c.rowIndex === i)
      const firstName  = String(r.first_name ?? '').trim()
      const lastName   = String(r.last_name ?? '').trim()
      const admNum     = r.admission_number ? String(r.admission_number).trim() : undefined

      // Normalise gender — DB check constraint is lowercase
      const rawGender = r.gender ? String(r.gender).trim().toLowerCase() : null
      const gender    = rawGender === 'male' || rawGender === 'female' ? rawGender : null

      if (collision?.resolution === 'update') {
        // Update existing record
        const { error } = await supabase
          .from('students')
          .update({
            first_name:    firstName,
            last_name:     lastName,
            dob:           r.dob ? String(r.dob) : undefined,
            gender,
            student_type:  r.student_type ? String(r.student_type).toLowerCase() : undefined,
            nationality:   r.nationality ? String(r.nationality) : undefined,
            religion:      r.religion ? String(r.religion) : undefined,
            previous_school: r.previous_school ? String(r.previous_school) : undefined,
          })
          .eq('id', collision.existingId)

        if (error) {
          failedItems.push({ row: i + 2, reason: error.message })
        } else {
          updated++
          newStudentResults.push({ name: `${firstName} ${lastName}`, admission_number: collision.existingAdm })
        }
      } else {
        // Insert new record — omit admission_number when blank to let DB trigger generate it
        const insertData: Record<string, unknown> = {
          school_id:    user!.schoolId,
          first_name:   firstName,
          last_name:    lastName,
          dob:          r.dob ? String(r.dob) : null,
          gender,
          student_type: r.student_type ? String(r.student_type).toLowerCase() : 'day',
          status:       'active',
          enrolled_at:  new Date().toISOString(),
          nationality:  r.nationality ? String(r.nationality) : 'Ugandan',
          religion:     r.religion ? String(r.religion) : null,
          previous_school: r.previous_school ? String(r.previous_school) : null,
        }
        // Only include admission_number if the user explicitly provided one
        if (admNum) insertData.admission_number = admNum

        const { data: inserted, error } = await supabase
          .from('students')
          .insert(insertData)
          .select('first_name, last_name, admission_number')
          .single()

        if (error) {
          failedItems.push({ row: i + 2, reason: error.message })
        } else {
          imported++
          if (inserted) {
            newStudentResults.push({
              name:             `${inserted.first_name} ${inserted.last_name}`,
              admission_number: inserted.admission_number as string,
            })
          }
        }
      }
    }

    void qc.invalidateQueries({ queryKey: ['students'] })
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

  // ── Collision-resolved re-import ────────────────────────────────────────────
  async function runWithResolvedCollisions(): Promise<ImportResult> {
    if (!pendingRows) return { imported: 0, updated: 0, skipped: 0, failed: [] }
    setShowCollisionStep(false)
    const result = await handleStudentImport(pendingRows)
    setPendingRows(null)
    return result
  }

  // ── Staff import handler ────────────────────────────────────────────────────
  async function handleStaffImport(rows: ParsedRow[]): Promise<ImportResult> {
    const failedItems: Array<{ row: number; reason: string }> = []
    let imported = 0

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const inserts = batch.map(r => {
        const data: Record<string, unknown> = {
          school_id:       user!.schoolId,
          first_name:      String(r.first_name ?? '').trim(),
          last_name:       String(r.last_name ?? '').trim(),
          role:            String(r.role ?? 'teacher').trim(),
          email:           r.email ? String(r.email).trim() : null,
          phone:           r.phone ? String(r.phone).trim() : null,
          national_id:     r.national_id ? String(r.national_id).trim() : null,
          employment_type: r.employment_type ? String(r.employment_type).trim() : 'full_time',
          qualification_level: r.qualification_level ? String(r.qualification_level).trim() : null,
          qualification_title: r.qualification_title ? String(r.qualification_title).trim() : null,
          is_active:       true,
          join_date:       new Date().toISOString().slice(0, 10),
        }
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

    void qc.invalidateQueries({ queryKey: ['staff'] })
    setImportSuccess({ count: imported, type: 'staff' })
    return { imported, updated: 0, skipped: 0, failed: failedItems }
  }

  // ── Collision step overlay — shown between the wizard steps ────────────────
  if (showCollisionStep && pendingRows) {
    const allResolved = collisions.every(c => c.resolution !== undefined)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageHeader />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font2)', fontSize: 16, fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>
            Collision Review
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 16 }}>
            Resolve each name match before completing the import.
          </div>
          <CollisionReview
            collisions={collisions}
            onChange={(existingId, resolution) => {
              setCollisions(prev => prev.map(c => c.existingId === existingId ? { ...c, resolution } : c))
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button
              onClick={() => { setShowCollisionStep(false); setPendingRows(null); setCollisions([]) }}
              style={secondaryBtnStyle}
            >
              ← Cancel Import
            </button>
            <button
              onClick={runWithResolvedCollisions}
              disabled={!allResolved}
              style={{
                ...primaryBtnStyle,
                opacity: allResolved ? 1 : 0.45,
                cursor: allResolved ? 'pointer' : 'not-allowed',
              }}
            >
              Import {pendingRows.length} Records →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader />

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['students', 'staff'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setImportSuccess(null); setImportedStudents([]) }}
            style={{ padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize', border: 'none', background: mode === m ? 'linear-gradient(145deg,var(--brand),var(--brand-dark))' : 'var(--surface2)', color: mode === m ? '#fff' : 'var(--txt2)', boxShadow: mode === m ? '0 3px 12px rgba(13,148,136,.3)' : 'none' }}>
            Import {m}
          </button>
        ))}
      </div>

      {/* Download template bar */}
      <TemplateDownloadBar mode={mode} />

      {/* Wizard */}
      <ImportWizard
        key={mode}
        context={mode}
        requiredFields={mode === 'students' ? STUDENT_REQUIRED : STAFF_REQUIRED}
        optionalFields={mode === 'students' ? STUDENT_OPTIONAL : STAFF_OPTIONAL}
        onComplete={mode === 'students' ? handleStudentImport : handleStaffImport}
        validateRow={mode === 'students' ? validateStudentRow : validateStaffRow}
      />

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
const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none',
  background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
  color: '#fff', fontFamily: 'var(--font1)',
}
const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)',
  fontFamily: 'var(--font1)',
}
