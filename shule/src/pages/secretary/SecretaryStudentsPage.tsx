import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { StudentsPage } from './StudentsPage'
import { StudentRegistrationWizard } from './StudentRegistrationWizard'
import { ImportWizard, type ColumnSpec, type ParsedRow, type ImportResult, type ConflictStrategy } from '../../components/shared/ImportWizard'
import { Modal } from '../../components/ui/Modal'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { useStudentById } from '../../hooks/useStudents'
import { Avatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'

// ── Class level accent colours ────────────────────────────────
const LEVEL_ACCENT: Record<number, string> = {
  1: '#0d9488', 2: '#0ea5e9', 3: '#8b5cf6',
  4: '#f59e0b', 5: '#f43f5e', 6: '#10b981',
}

// ── Student Profile Modal ─────────────────────────────────────
function StudentProfileModal({ student, classes, streams, onClose, onEdit }: {
  student: Student
  classes: { id: string; name: string; level: string | null }[]
  streams: { id: string; name: string }[]
  onClose: () => void
  onEdit:  () => void
}) {
  const { data: detail } = useStudentById(student.id)

  const cls        = classes.find(c => c.id === student.classId)
  const className  = cls?.name ?? '—'
  const streamName = streams.find(s => s.id === student.streamId)?.name ?? '—'
  const levelNum   = cls?.level ? parseInt(cls.level, 10) : null
  const accent     = levelNum ? (LEVEL_ACCENT[levelNum] ?? '#0d9488') : '#0d9488'

  const statusColors = {
    active:    { bg: 'rgba(16,185,129,.1)',  color: '#065f46', dot: '#10b981' },
    suspended: { bg: 'rgba(245,158,11,.1)', color: '#92400e', dot: '#f59e0b' },
    expelled:  { bg: 'rgba(244,63,94,.1)',  color: '#9f1239', dot: '#f43f5e' },
  }
  const sc = statusColors[student.status]

  function InfoRow({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null
    return (
      <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '.5px solid var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, minWidth: 120 }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500 }}>{value}</span>
      </div>
    )
  }

  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.28)', overflow: 'hidden' }}>

        {/* Header with avatar */}
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, padding: '24px 24px 20px', position: 'relative', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.25)', padding: 3, flexShrink: 0 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff' }}>
                <Avatar photoPath={student.photoUrl} bucket="student-photos" name={`${student.firstName} ${student.lastName}`} size="lg" />
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: '#fff', lineHeight: 1.2 }}>{student.firstName} {student.lastName}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 3 }}>{student.admissionNumber}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {className !== '—' && <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{className}</span>}
                {streamName !== '—' && <span style={{ background: 'rgba(255,255,255,.15)', color: '#fff', padding: '2px 10px', borderRadius: 99, fontSize: 11 }}>{streamName}</span>}
                <span style={{ background: sc.bg, color: sc.color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />
                  {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {/* Personal details */}
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12, color: accent, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Personal Details</div>
          <InfoRow label="Date of Birth" value={student.dob ? new Date(student.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null} />
          <InfoRow label="Gender"        value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : null} />
          <InfoRow label="Nationality"   value={student.nationality} />
          <InfoRow label="Religion"      value={student.religion} />
          <InfoRow label="Student Type"  value={student.studentType ? student.studentType.charAt(0).toUpperCase() + student.studentType.slice(1) : null} />
          <InfoRow label="Previous School" value={student.previousSchool} />

          {/* Medical notes */}
          {(detail?.medicalNotes || student.medicalNotes) && (
            <div style={{ marginTop: 12, background: 'rgba(245,158,11,.06)', border: '.5px solid rgba(245,158,11,.3)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>Medical Notes</div>
              <div style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.55 }}>{detail?.medicalNotes ?? student.medicalNotes}</div>
            </div>
          )}

          {/* Guardians */}
          {detail?.guardians && detail.guardians.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12, color: accent, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>
                Guardian{detail.guardians.length > 1 ? 's' : ''}
              </div>
              {detail.guardians.map(g => (
                <div key={g.id} style={{ background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--txt)' }}>{g.fullName}</span>
                    {g.isPrimary && <span style={{ background: `${accent}18`, color: accent, borderRadius: 99, padding: '1px 8px', fontSize: 10, fontWeight: 800 }}>Primary</span>}
                    {g.relationship && <span style={{ fontSize: 11, color: 'var(--txt3)', textTransform: 'capitalize' }}>{g.relationship}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {g.phone && <span style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{g.phone}</span>}
                    {g.email && <span style={{ fontSize: 12, color: 'var(--info)' }}>{g.email}</span>}
                    {g.doNotContact && <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>Do Not Contact</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!detail && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--txt3)', fontSize: 13 }}>Loading details…</div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 24px', borderTop: '.5px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Close</button>
          <button onClick={onEdit} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Edit Student
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

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
  const [viewed,     setViewed]     = useState<Student | null>(null)
  const [editing,    setEditing]    = useState<Student | null>(null)

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

      {/* ── Student profile modal (View button) ───────────── */}
      {viewed && (
        <StudentProfileModal
          student={viewed}
          classes={classes}
          streams={streams}
          onClose={() => setViewed(null)}
          onEdit={() => { setEditing(viewed); setViewed(null) }}
        />
      )}

      {/* ── Registration wizard ───────────────────────────── */}
      <StudentRegistrationWizard
        open={wizardOpen || !!editing}
        onClose={() => { setWizardOpen(false); setEditing(null) }}
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
