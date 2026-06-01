import { useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents, type StudentFilters } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useGenerateParentAccess, type GeneratedAccess } from '../../hooks/useParentPortal'
import { Avatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'

// ── GenerateAccessModal ──────────────────────────────────────────────────────
function GenerateAccessModal({ student, onClose }: { student: Student; onClose: () => void }) {
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

  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', padding: '28px', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Parent Portal Access</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{student.firstName} {student.lastName} · {student.admissionNumber}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, borderRadius: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {!result ? (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.65, marginBottom: 16 }}>
              This will auto-generate a parent login using the student's admission number. If credentials already exist, they will be returned unchanged.
            </p>
            {error && (
              <div style={{ background: 'rgba(244,63,94,.08)', border: '.5px solid var(--danger)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--danger)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void handleGenerate()} disabled={isPending}
                style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,.35)' }}>
                {isPending ? 'Generating…' : 'Generate Access'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: result.isNew ? 'rgba(16,185,129,.08)' : 'rgba(14,165,233,.08)', border: `.5px solid ${result.isNew ? '#10b981' : '#0ea5e9'}`, borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12.5, fontWeight: 700, color: result.isNew ? '#065f46' : '#0369a1' }}>
              {result.isNew ? 'New parent account created.' : 'Existing credentials retrieved.'}
            </div>
            {([{ key: 'email', label: 'Email', value: result.email }, { key: 'pw', label: 'Password', value: result.tempPassword }] as const).map(({ key, label, value }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .6 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                  <span style={{ fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)' }}>{value}</span>
                  <button onClick={() => copyText(key, value)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', color: copied[key] ? '#10b981' : 'var(--brand)' }}>
                    {copied[key] ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,.35)' }}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const statusConfig: Record<Student['status'], { bg: string; color: string; dot: string }> = {
  active:    { bg: 'rgba(16,185,129,.12)',  color: '#065f46', dot: '#10b981' },
  suspended: { bg: 'rgba(245,158,11,.12)', color: '#92400e', dot: '#f59e0b' },
  expelled:  { bg: 'rgba(244,63,94,.12)',  color: '#9f1239', dot: '#f43f5e' },
}

const LEVEL_COLORS: Record<number, { bg: string; border: string; text: string; accent: string }> = {
  1: { bg: 'rgba(13,148,136,.10)',  border: 'rgba(13,148,136,.25)',  text: '#0f766e', accent: '#0d9488' },
  2: { bg: 'rgba(14,165,233,.10)', border: 'rgba(14,165,233,.25)', text: '#0369a1', accent: '#0ea5e9' },
  3: { bg: 'rgba(139,92,246,.10)', border: 'rgba(139,92,246,.25)', text: '#6d28d9', accent: '#8b5cf6' },
  4: { bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.25)', text: '#b45309', accent: '#f59e0b' },
  5: { bg: 'rgba(244,63,94,.10)',  border: 'rgba(244,63,94,.25)',  text: '#be123c', accent: '#f43f5e' },
  6: { bg: 'rgba(16,185,129,.10)', border: 'rgba(16,185,129,.25)', text: '#065f46', accent: '#10b981' },
}

const ROW_HEIGHT = 56

const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 10.5, fontWeight: 800, letterSpacing: .8,
  textTransform: 'uppercase', color: 'var(--txt3)', padding: '11px 16px',
  borderBottom: '.5px solid var(--border)', background: 'var(--surface2)',
  whiteSpace: 'nowrap', fontFamily: 'var(--font2)',
}
const TD: React.CSSProperties = {
  padding: '0 16px', borderBottom: '.5px solid var(--border)',
  color: 'var(--txt2)', verticalAlign: 'middle', fontSize: 12.5,
}

// ── Student Row ───────────────────────────────────────────────────────────────
function StudentRow({ student, classes, streams, onView, onPortal, style }: {
  student: Student
  classes: { id: string; name: string; level: string | null }[]
  streams: { id: string; name: string }[]
  onView: (s: Student) => void
  onPortal: (s: Student) => void
  style: React.CSSProperties
}) {
  const [hovered, setHovered] = useState(false)
  const cls        = classes.find(c => c.id === student.classId)
  const className  = cls?.name ?? '—'
  const streamName = streams.find(s => s.id === student.streamId)?.name ?? '—'
  const levelNum   = cls?.level ? parseInt(cls.level, 10) : null
  const lvl        = levelNum ? (LEVEL_COLORS[levelNum] ?? null) : null
  const sc         = statusConfig[student.status]

  return (
    <tr
      style={{
        ...style,
        cursor: 'pointer',
        background: hovered ? 'var(--brand-light)' : 'transparent',
        transition: 'background 0.12s',
        display: 'table-row',
      }}
      onClick={() => onView(student)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: lvl
              ? `linear-gradient(135deg, ${lvl.accent}, ${lvl.text})`
              : 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
            padding: 2,
          }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)' }}>
              <Avatar photoPath={student.photoUrl} bucket="student-photos" name={`${student.firstName} ${student.lastName}`} size="sm" />
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 13, lineHeight: 1.3 }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 1 }}>
              {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'}
              {student.dob ? ` · ${new Date(student.dob).getFullYear()}` : ''}
            </div>
          </div>
        </div>
      </td>
      <td style={TD}>
        <span style={{ fontFamily: 'var(--font3)', fontSize: 11.5, color: 'var(--txt3)', letterSpacing: .3 }}>
          {student.admissionNumber}
        </span>
      </td>
      <td style={TD}>
        {className !== '—' ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20,
            background: lvl ? lvl.bg : 'var(--surface2)',
            border: `.5px solid ${lvl ? lvl.border : 'var(--border)'}`,
            color: lvl ? lvl.text : 'var(--txt2)',
            fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
          }}>
            {className}
          </span>
        ) : <span style={{ color: 'var(--txt3)' }}>—</span>}
      </td>
      <td style={TD}>
        {streamName !== '—'
          ? <span style={{ fontSize: 12.5, color: 'var(--txt2)', fontWeight: 600 }}>{streamName}</span>
          : <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>}
      </td>
      <td style={TD}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
          background: sc.bg, color: sc.color,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
          {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
        </span>
      </td>
      <td style={{ ...TD, width: 160 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); onView(student) }}
            style={{
              padding: '4px 11px', borderRadius: 99, border: '.5px solid rgba(14,165,233,.3)',
              background: 'rgba(14,165,233,.08)', color: '#0369a1', fontWeight: 700, fontSize: 11,
              cursor: 'pointer', fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
            }}
          >
            View
          </button>
          <button
            onClick={e => { e.stopPropagation(); onPortal(student) }}
            style={{
              padding: '4px 11px', borderRadius: 99, border: '.5px solid rgba(139,92,246,.3)',
              background: 'rgba(139,92,246,.08)', color: '#6d28d9', fontWeight: 700, fontSize: 11,
              cursor: 'pointer', fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
            }}
          >
            Portal
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr style={{ height: ROW_HEIGHT }}>
      {[{ w: 160 }, { w: 90 }, { w: 56 }, { w: 56 }, { w: 70 }, { w: 100 }].map((col, i) => (
        <td key={i} style={TD}>
          <span className="shule-skeleton" style={{ display: 'block', height: 13, width: col.w, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ isFiltered, onRegister }: { isFiltered: boolean; onRegister: () => void }) {
  return (
    <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface2)', border: '.5px solid var(--border)',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', textAlign: 'center' }}>
          {isFiltered ? 'No students match your filters' : 'No students yet'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', marginTop: 5 }}>
          {isFiltered ? 'Try adjusting your search or clearing filters.' : 'Register the first student to get started.'}
        </div>
      </div>
      {!isFiltered && (
        <button
          onClick={onRegister}
          style={{
            marginTop: 6, padding: '10px 22px', borderRadius: 11, border: 'none',
            background: 'linear-gradient(135deg, #0d9488, #0ea5e9)',
            color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(13,148,136,.35)',
          }}
        >
          Register First Student
        </button>
      )}
    </div>
  )
}

// ── Props & Main Page ─────────────────────────────────────────────────────────
interface Props { onRegister: () => void; onImport: () => void; onView: (student: Student) => void }

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

  const handleClassChange = useCallback((v: string) => { setClassId(v); setStreamId('') }, [])

  const useVirtual = students.length > 50
  const parentRef  = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({
    count: students.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    enabled: useVirtual,
  })

  const isFiltered = !!(search || classId || streamId || status)

  const totalStudents = students.length
  const activeCount   = students.filter(s => s.status === 'active').length
  const dayCount      = students.filter(s => s.studentType === 'day').length
  const boarderCount  = students.filter(s => s.studentType === 'boarder').length

  const selStyle: React.CSSProperties = {
    padding: '7px 30px 7px 12px', fontSize: 12.5,
    background: 'var(--surface2)', border: '.5px solid var(--border)',
    borderRadius: 10, color: 'var(--txt2)', appearance: 'none', outline: 'none',
    fontFamily: 'var(--font2)', cursor: 'pointer',
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Band ─────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)',
        padding: '28px 28px 24px',
        position: 'relative',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 200, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
          {/* Left: title + stats */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.18)',
                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>
                Students
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
              {isLoading ? 'Loading enrollment data…' : 'Enrolled student roster'}
            </p>

            {/* Stat chips */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total', value: isLoading ? '—' : totalStudents },
                { label: 'Active', value: isLoading ? '—' : activeCount },
                { label: 'Day Scholars', value: isLoading ? '—' : dayCount },
                { label: 'Boarders', value: isLoading ? '—' : boarderCount },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)',
                  border: '.5px solid rgba(255,255,255,.25)', borderRadius: 12,
                  padding: '10px 16px', minWidth: 80,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.7)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            <button
              onClick={onImport}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11,
                border: '1.5px solid rgba(255,255,255,.55)', background: 'rgba(255,255,255,.12)',
                backdropFilter: 'blur(8px)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.12)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import Excel
            </button>
            <button
              onClick={onRegister}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 11,
                border: 'none', background: '#fff', color: '#0f766e',
                fontWeight: 800, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(0,0,0,.18)',
                transition: 'box-shadow 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.22)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,.18)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              Register Student
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface2)', border: '.5px solid var(--border)',
          borderRadius: 10, padding: '0 12px', height: 36, flex: '1 1 200px', minWidth: 180,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or admission no…"
            style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', flex: 1 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* Class / Stream / Status selects */}
        {[
          {
            value: classId, fn: handleClassChange,
            opts: [{ value: '', label: 'All Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))],
          },
          {
            value: streamId, fn: setStreamId,
            opts: [{ value: '', label: 'All Streams' }, ...streams.filter(s => !classId || s.classId === classId).map(s => ({ value: s.id, label: s.name }))],
          },
          {
            value: status, fn: setStatus,
            opts: [
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'expelled', label: 'Expelled' },
            ],
          },
        ].map((f, i) => (
          <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
            <select value={f.value} onChange={e => f.fn(e.target.value)} style={selStyle}>
              {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5"
              style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        ))}

        {isFiltered && (
          <button
            onClick={() => { setSearch(''); setClassId(''); setStreamId(''); setStatus('') }}
            style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', padding: '0 4px', flexShrink: 0 }}
          >
            Clear filters
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--txt3)', flexShrink: 0, fontFamily: 'var(--font2)' }}>
          {isLoading ? '…' : `${students.length} result${students.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Table Card ────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
        {useVirtual ? (
          <div ref={parentRef} style={{ height: Math.min(students.length * ROW_HEIGHT + 46, 540), overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  {['Student', 'Adm. No.', 'Class', 'Stream', 'Status', 'Actions'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ height: virtualiser.getTotalSize(), position: 'relative', display: 'block' }}>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : students.length === 0
                  ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState isFiltered={isFiltered} onRegister={onRegister} />
                      </td>
                    </tr>
                  )
                  : virtualiser.getVirtualItems().map(vRow => (
                    <StudentRow
                      key={students[vRow.index].id}
                      student={students[vRow.index]}
                      classes={classes}
                      streams={streams}
                      onView={onView}
                      onPortal={setPortalStudent}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: ROW_HEIGHT, transform: `translateY(${vRow.start}px)` }}
                    />
                  ))
                }
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr>
                  {['Student', 'Adm. No.', 'Class', 'Stream', 'Status', 'Actions'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : students.length === 0
                  ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState isFiltered={isFiltered} onRegister={onRegister} />
                      </td>
                    </tr>
                  )
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
      </div>

      {portalStudent && (
        <GenerateAccessModal student={portalStudent} onClose={() => setPortalStudent(null)} />
      )}
    </div>
  )
}
