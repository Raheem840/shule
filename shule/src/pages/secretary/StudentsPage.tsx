import { useState, useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents, type StudentFilters } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useGenerateParentAccess, type GeneratedAccess } from '../../hooks/useParentPortal'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Avatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'

// ── Generate Portal Access Modal ───────────────────────────────
function GenerateAccessModal({
  student,
  onClose,
}: {
  student: Student
  onClose: () => void
}) {
  const { mutateAsync, isPending } = useGenerateParentAccess()
  const [result, setResult] = useState<GeneratedAccess | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(p => ({ ...p, [key]: true }))
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000)
  }

  const handleGenerate = async () => {
    setError(null)
    try {
      const r = await mutateAsync({ id: student.id, admissionNumber: student.admissionNumber })
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate access')
    }
  }

  return (
    <div
      className="sui-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--modal-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        className="sui-modal-dialog"
        style={{
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          borderTop: '1px solid var(--modal-border-t)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: 'var(--modal-shadow)',
          borderRadius: 'var(--r-xl)',
          padding: '1.5rem', width: 420, maxWidth: '90vw',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
              Parent Portal Access
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
              {student.firstName} {student.lastName} · {student.admissionNumber}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, display: 'flex' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!result ? (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              This will auto-generate a parent login using the student's admission number.
              If credentials already exist for this student, they will be returned unchanged.
            </p>
            {error && (
              <div style={{
                background: 'var(--danger-bg)', border: '1px solid var(--danger)',
                borderRadius: 'var(--r)', padding: '0.6rem 0.85rem', marginBottom: '1rem',
                fontSize: 12.5, color: 'var(--danger)', fontFamily: 'var(--font2)',
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleGenerate} disabled={isPending}>
                {isPending ? 'Generating…' : 'Generate Access'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              background: result.isNew ? 'var(--success-bg)' : 'var(--info-bg)',
              border: `1px solid ${result.isNew ? 'var(--success)' : 'var(--info)'}`,
              borderRadius: 'var(--r)', padding: '0.6rem 0.85rem', marginBottom: '1rem',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font2)',
              color: result.isNew ? 'var(--success)' : 'var(--info)',
            }}>
              {result.isNew ? 'New parent account created.' : 'Existing credentials retrieved.'}
            </div>
            {[
              { key: 'email', label: 'Email',    value: result.email },
              { key: 'pw',    label: 'Password', value: result.tempPassword },
            ].map(({ key, label, value }) => (
              <div key={key} style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {label}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r)', padding: '0.5rem 0.75rem',
                }}>
                  <span style={{ fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)' }}>{value}</span>
                  <button
                    onClick={() => copyText(key, value)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
                      color: copied[key] ? 'var(--success)' : 'var(--brand)',
                    }}
                  >
                    {copied[key] ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <Button variant="primary" onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StudentAvatar({ student }: { student: Student }) {
  return (
    <Avatar
      photoPath={student.photoUrl}
      bucket="student-photos"
      name={`${student.firstName} ${student.lastName}`}
      size="sm"
    />
  )
}

// ── Status badge ───────────────────────────────────────────────
const statusVariant: Record<Student['status'], 'green' | 'amber' | 'red'> = {
  active:    'green',
  suspended: 'amber',
  expelled:  'red',
}

// ── Search bar ─────────────────────────────────────────────────
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: '0 0.75rem', height: 34,
        transition: 'border-color 0.18s',
      }}
      onFocus={() => {}}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        className="sui-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search by name or admission no…"
        style={{
          border: 'none', background: 'transparent',
          fontSize: 12.5, color: 'var(--txt)',
          fontFamily: 'var(--font1)', outline: 'none', width: 220,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 2 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Styled select (filter bar) ─────────────────────────────────
function FilterSelect({
  value, onChange, children,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        className="sui-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font2)',
          color: 'var(--txt2)', padding: '0.3rem 1.8rem 0.3rem 0.65rem',
          appearance: 'none', WebkitAppearance: 'none', height: 34, cursor: 'pointer',
        }}
      >
        {children}
      </select>
      <svg
        width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="var(--txt3)" strokeWidth="2"
        style={{ position: 'absolute', right: '0.5rem', pointerEvents: 'none' }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}

// ── Table header ───────────────────────────────────────────────
const TH_STYLE: React.CSSProperties = {
  textAlign: 'left', fontSize: 10, fontWeight: 900,
  letterSpacing: '1px', textTransform: 'uppercase',
  color: 'var(--txt3)', padding: '0.55rem 0.85rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface2)', fontFamily: 'var(--font2)',
  whiteSpace: 'nowrap', userSelect: 'none',
}

const TD_STYLE: React.CSSProperties = {
  padding: '0.6rem 0.85rem', borderBottom: '1px solid var(--border)',
  color: 'var(--txt2)', verticalAlign: 'middle', fontSize: 12.5,
}

// ── Level-based chip colours — identical values to ClassListPage LEVEL_COLORS
//    so S.1 is always the same teal on every screen, S.2 the same blue, etc.
const LEVEL_CHIP: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
  2: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  3: { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  4: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  5: { bg: '#fefce8', border: '#fef08a', text: '#a16207' },
  6: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
}

// ── Virtual row ────────────────────────────────────────────────
// Each row is rendered by the virtualiser, not the browser DOM.
// Height must be fixed — 52px matches the padding in TD_STYLE.
const ROW_HEIGHT = 52

function StudentRow({
  student,
  classes,
  streams,
  onView,
  onPortal,
  style,
}: {
  student: Student
  classes: { id: string; name: string; level: string | null }[]
  streams: { id: string; name: string }[]
  onView:   (s: Student) => void
  onPortal: (s: Student) => void
  style: React.CSSProperties
}) {
  const cls        = classes.find(c => c.id === student.classId)
  const className  = cls?.name ?? '—'
  const streamName = streams.find(s => s.id === student.streamId)?.name ?? '—'
  const levelNum   = cls?.level ? parseInt(cls.level, 10) : null
  const chip       = levelNum ? (LEVEL_CHIP[levelNum] ?? null) : null

  return (
    <tr
      className="sui-tr"
      style={{ ...style, cursor: 'pointer', display: 'table-row' }}
      onClick={() => onView(student)}
    >
      <td style={TD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <StudentAvatar student={student} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 12.5, lineHeight: 1.3 }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--txt3)' }}>
              {student.gender ?? '—'} · {student.dob
                ? new Date(student.dob).getFullYear()
                : '—'}
            </div>
          </div>
        </div>
      </td>
      <td style={TD_STYLE}>
        <span style={{ fontFamily: 'var(--font3)', fontSize: 11.5, color: 'var(--txt3)' }}>
          {student.admissionNumber}
        </span>
      </td>
      <td style={TD_STYLE}>
        {className !== '—' ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 10px', borderRadius: 20,
            background: chip ? chip.bg : 'var(--surface2)',
            border:     `1px solid ${chip ? chip.border : 'var(--border)'}`,
            color:      chip ? chip.text : 'var(--txt2)',
            fontSize: 11, fontWeight: 800,
            fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
          }}>
            {className}
          </span>
        ) : '—'}
      </td>
      <td style={TD_STYLE}>
        {streamName !== '—' ? (
          <span style={{ fontSize: 12.5, color: 'var(--txt2)', fontWeight: 600 }}>{streamName}</span>
        ) : <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>}
      </td>
      <td style={TD_STYLE}>
        <Badge variant={statusVariant[student.status]} dot>
          {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
        </Badge>
      </td>
      <td style={{ ...TD_STYLE, width: 140 }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span
            style={{ fontSize: 12, fontWeight: 800, color: 'var(--info)', cursor: 'pointer', fontFamily: 'var(--font2)' }}
            onClick={e => { e.stopPropagation(); onView(student) }}
          >
            View
          </span>
          <span
            style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', cursor: 'pointer', fontFamily: 'var(--font2)' }}
            onClick={e => { e.stopPropagation(); /* edit handler wired in parent */ }}
          >
            Edit
          </span>
          <span
            title="Generate parent portal access"
            style={{ fontSize: 12, fontWeight: 800, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--font2)' }}
            onClick={e => { e.stopPropagation(); onPortal(student) }}
          >
            Portal
          </span>
        </div>
      </td>
    </tr>
  )
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <tr>
      <td colSpan={6} style={{ ...TD_STYLE, textAlign: 'center', padding: '3.5rem 1rem', borderBottom: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: 'var(--txt3)', opacity: 0.3 }}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 700, color: 'var(--txt)', fontSize: 14 }}>
            {filtered ? 'No students match your filters' : 'No students registered yet'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--txt3)', maxWidth: 280, lineHeight: 1.6 }}>
            {filtered
              ? 'Try clearing the search or changing a filter.'
              : 'Use the Register button to add your first student, or import from Excel.'}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── StudentsPage ───────────────────────────────────────────────
interface Props {
  onRegister: () => void
  onImport:   () => void
  onView:     (student: Student) => void
}

export function StudentsPage({ onRegister, onImport, onView }: Props) {
  const [search,        setSearch]        = useState('')
  const [classId,       setClassId]       = useState('')
  const [streamId,      setStreamId]      = useState('')
  const [status,        setStatus]        = useState('')
  const [portalStudent, setPortalStudent] = useState<Student | null>(null)

  const filters: StudentFilters = useMemo(() => ({
    ...(classId  ? { classId }  : {}),
    ...(streamId ? { streamId } : {}),
    ...(status   ? { status: status as Student['status'] } : {}),
    ...(search   ? { search } : {}),
  }), [classId, streamId, status, search])

  const { data: students = [], isLoading } = useStudents(filters)
  const { data: classes  = [] }            = useClasses()
  const { data: streams  = [] }            = useStreams(classId || undefined)

  // Reset stream when class changes
  const handleClassChange = useCallback((v: string) => {
    setClassId(v)
    setStreamId('')
  }, [])

  // ── Virtualisation (only when > 50 rows) ───────────────────
  const useVirtual = students.length > 50
  const parentRef  = useRef<HTMLDivElement>(null)

  const virtualiser = useVirtualizer({
    count:           students.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => ROW_HEIGHT,
    overscan:        8,
    enabled:         useVirtual,
  })

  const isFiltered = !!(search || classId || streamId || status)

  return (
    <div style={{ padding: '1.4rem 1.5rem' }}>
      {/* Page header */}
      <PageHeader
        title="Students"
        subtitle={isLoading ? 'Loading…' : `${students.length} student${students.length !== 1 ? 's' : ''}`}
        action={
          <>
            <Button
              variant="secondary"
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              }
              onClick={onImport}
            >
              Import Excel
            </Button>
            <Button
              variant="primary"
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              }
              onClick={onRegister}
            >
              Register Student
            </Button>
          </>
        }
      />

      <Card>
        {/* Toolbar */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
          }}
        >
          <SearchBar value={search} onChange={setSearch} />

          <FilterSelect value={classId} onChange={handleClassChange}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>

          <FilterSelect value={streamId} onChange={setStreamId}>
            <option value="">All Streams</option>
            {streams
              .filter(s => !classId || s.classId === classId)
              .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </FilterSelect>

          <FilterSelect value={status} onChange={setStatus}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="expelled">Expelled</option>
          </FilterSelect>

          {isFiltered && (
            <button
              onClick={() => { setSearch(''); setClassId(''); setStreamId(''); setStatus('') }}
              style={{
                fontSize: 11.5, fontWeight: 700, color: 'var(--danger)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font2)', padding: '0 0.25rem',
              }}
            >
              Clear filters
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--txt3)' }}>
            {students.length} result{students.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table — virtualised when > 50 rows */}
        {useVirtual ? (
          <div
            ref={parentRef}
            style={{ height: Math.min(students.length * ROW_HEIGHT + 1, 520), overflowY: 'auto', overflowX: 'auto' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={TH_STYLE}>Student</th>
                  <th style={TH_STYLE}>Adm. No.</th>
                  <th style={TH_STYLE}>Class</th>
                  <th style={TH_STYLE}>Stream</th>
                  <th style={TH_STYLE}>Status</th>
                  <th style={TH_STYLE}></th>
                </tr>
              </thead>
              <tbody
                style={{
                  height: virtualiser.getTotalSize(),
                  position: 'relative',
                  display: 'block',
                }}
              >
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} style={{ height: ROW_HEIGHT, display: 'table-row' }}>
                        {[140, 100, 70, 60, 70, 60].map((w, j) => (
                          <td key={j} style={TD_STYLE}>
                            <span className="shule-skeleton" style={{ display: 'block', height: 13, width: w }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : students.length === 0
                  ? <EmptyState filtered={isFiltered} />
                  : virtualiser.getVirtualItems().map(vRow => (
                      <StudentRow
                        key={students[vRow.index].id}
                        student={students[vRow.index]}
                        classes={classes}
                        streams={streams}
                        onView={onView}
                        onPortal={setPortalStudent}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: ROW_HEIGHT,
                          transform: `translateY(${vRow.start}px)`,
                        }}
                      />
                    ))
                }
              </tbody>
            </table>
          </div>
        ) : (
          /* Non-virtual — simple DOM table for ≤ 50 rows */
          <div className="hscroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>Student</th>
                  <th style={TH_STYLE}>Adm. No.</th>
                  <th style={TH_STYLE}>Class</th>
                  <th style={TH_STYLE}>Stream</th>
                  <th style={TH_STYLE}>Status</th>
                  <th style={TH_STYLE}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {[140, 100, 70, 60, 70, 60].map((w, j) => (
                          <td key={j} style={TD_STYLE}>
                            <span className="shule-skeleton" style={{ display: 'block', height: 13, width: w }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : students.length === 0
                  ? <EmptyState filtered={isFiltered} />
                  : students.map(s => (
                      <StudentRow
                        key={s.id}
                        student={s}
                        classes={classes}
                        streams={streams}
                        onView={onView}
                        onPortal={setPortalStudent}
                        style={{}}
                      />
                    ))
                }
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {portalStudent && (
        <GenerateAccessModal
          student={portalStudent}
          onClose={() => setPortalStudent(null)}
        />
      )}
    </div>
  )
}
