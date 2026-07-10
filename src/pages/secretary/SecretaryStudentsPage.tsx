import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { StudentsPage } from './StudentsPage'
import { StudentRegistrationWizard } from './StudentRegistrationWizard'
import { ImportWizard, type ParsedRow, type ImportResult, type ConflictStrategy } from '../../components/shared/ImportWizard'
import { PromoteStudentsSection } from '../../components/shared/PromoteStudentsSection'
import { Modal } from '../../components/ui/Modal'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useAuth } from '../../store/AuthContext'
import { useStudentById } from '../../hooks/useStudents'
import { Avatar } from '../../components/shared/Avatar'
import { importStudentsFromCsv, STUDENT_IMPORT_REQUIRED, STUDENT_IMPORT_OPTIONAL } from '../../lib/studentImport'
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '1rem' }}>
      <div className="sui-modal-dialog" style={{ background: 'var(--surface)', width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header with avatar */}
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, padding: '24px 24px 20px', position: 'relative', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 104, height: 104, borderRadius: '50%', background: 'rgba(255,255,255,.25)', padding: 4, flexShrink: 0 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff' }}>
                <Avatar photoPath={student.photoUrl} bucket="student-photos" name={`${student.firstName} ${student.lastName}`} size="xl" />
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
          {detail && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12, color: accent, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>
                Guardian{detail.guardians.length !== 1 ? 's' : ''}
              </div>
              {detail.guardians.length > 0 ? detail.guardians.map(g => (
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
              )) : (
                <div style={{ padding: '14px', textAlign: 'center', color: 'var(--txt3)', fontSize: 12.5, background: 'var(--surface2)', border: '.5px dashed var(--border)', borderRadius: 10 }}>
                  No guardians on file yet — add one from Edit Student.
                </div>
              )}
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
// Shared with ImportDataPage.tsx so both import entry points behave
// identically — same columns, same match/overwrite rule, same guardians.
const REQUIRED = STUDENT_IMPORT_REQUIRED
const OPTIONAL = STUDENT_IMPORT_OPTIONAL

// ── Orchestrator ──────────────────────────────────────────────
export function SecretaryStudentsPage() {
  const navigate = useNavigate()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [viewed,     setViewed]     = useState<Student | null>(null)
  const [showPromote, setShowPromote] = useState(false)

  const qc                     = useQueryClient()
  const { user }               = useAuth()
  const { data: classes = [] } = useClasses()
  const { data: streams = [] } = useStreams()

  // ── Import handler ────────────────────────────────────────
  // Delegates to the shared importStudentsFromCsv() — see src/lib/studentImport.ts.
  async function handleImportComplete(
    rows: ParsedRow[],
    strategy: ConflictStrategy,
  ): Promise<ImportResult> {
    if (!user) throw new Error('Not authenticated')
    const outcome = await importStudentsFromCsv(rows, user.schoolId, new Date().getFullYear(), strategy)

    if (outcome.imported > 0 || outcome.updated > 0) {
      qc.invalidateQueries({ queryKey: ['students', user.schoolId] })
    }

    return { imported: outcome.imported, updated: outcome.updated, skipped: outcome.skipped, failed: outcome.failed }
  }

  return (
    <>
      {/* ── End-of-year promotion ─────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => setShowPromote(v => !v)}
          className="sui-btn-primary"
          style={{ fontSize: 12.5 }}
        >
          {showPromote ? 'Hide Promotion' : 'Promote Students'}
        </button>
      </div>
      {showPromote && <div style={{ marginBottom: 20 }}><PromoteStudentsSection /></div>}

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
          onEdit={() => { setViewed(null); navigate(`/secretary/students/${viewed.id}`) }}
        />
      )}

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
