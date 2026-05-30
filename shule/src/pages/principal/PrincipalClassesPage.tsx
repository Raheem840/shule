import { useState } from 'react'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudents } from '../../hooks/useStudents'

// ─── Level colour palette ─────────────────────────────────────────────────────
const LEVEL_META: Record<string, { color: string; bg: string; label: string }> = {
  '1': { color: '#0d9488', bg: 'rgba(13,148,136,0.10)', label: 'S.1' },
  '2': { color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)', label: 'S.2' },
  '3': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'S.3' },
  '4': { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'S.4' },
  '5': { color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',  label: 'S.5' },
  '6': { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'S.6' },
}
function levelMeta(level: string | null) {
  return LEVEL_META[level ?? ''] ?? { color: 'var(--brand)', bg: 'rgba(13,148,136,0.08)', label: level ?? '—' }
}

// ─── Stream row (lazy-loaded per class) ───────────────────────────────────────
function StreamRows({ classId, studentsByStream }: {
  classId: string
  studentsByStream: Map<string, number>
}) {
  const { data: streams = [] } = useStreams(classId)

  if (streams.length === 0) return (
    <div style={{ padding: '14px 24px 14px 80px', fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>
      No streams configured for this class.
    </div>
  )

  return (
    <div>
      {streams.map((s, idx) => {
        const count = studentsByStream.get(s.id) ?? 0
        const hasTeacher = !!s.classTeacherId
        return (
          <div key={s.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            alignItems: 'center',
            gap: 16,
            padding: '12px 24px 12px 80px',
            borderTop: '1px solid var(--border)',
            background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)',
          }}>
            {/* Stream name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: hasTeacher ? '#10b981' : '#94a3b8',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                {s.name}
              </span>
            </div>

            {/* Class teacher status */}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: hasTeacher ? 'rgba(16,185,129,0.10)' : 'var(--surface2)',
              color: hasTeacher ? '#10b981' : 'var(--txt3)',
              border: `1px solid ${hasTeacher ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
            }}>
              {hasTeacher ? 'Teacher assigned' : 'No teacher'}
            </span>

            {/* Student count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, justifyContent: 'flex-end' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
                {count}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Class card ───────────────────────────────────────────────────────────────
function ClassCard({ c, studentCount, studentsByStream, expanded, onToggle }: {
  c: { id: string; name: string; level: string | null }
  studentCount: number
  studentsByStream: Map<string, number>
  expanded: boolean
  onToggle: () => void
}) {
  const meta = levelMeta(c.level)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: expanded ? '0 4px 20px rgba(0,0,0,0.06)' : '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s ease',
    }}>
      {/* ── Header row ── */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 0,
          padding: '0',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Level accent stripe */}
        <div style={{
          width: 56, alignSelf: 'stretch',
          background: `linear-gradient(180deg, ${meta.color}22 0%, ${meta.color}0a 100%)`,
          borderRight: `2px solid ${meta.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: meta.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.2" strokeLinecap="round">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
          </div>
        </div>

        {/* Name + level badge */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
              {c.name}
            </span>
            {c.level && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 800,
                background: meta.bg, color: meta.color,
                textTransform: 'uppercase', letterSpacing: 0.6,
                border: `1px solid ${meta.color}30`,
              }}>
                Year {c.level}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--txt3)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <strong style={{ fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>{studentCount}</strong> students
            </span>
          </div>
        </div>

        {/* Chevron */}
        <div style={{ padding: '0 20px 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)' }}>
            {expanded ? 'Collapse' : 'View streams'}
          </span>
          <div style={{
            width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Streams panel ── */}
      {expanded && (
        <div style={{ borderTop: `2px solid ${meta.color}20` }}>
          {/* Streams header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 16,
            padding: '8px 24px 8px 80px',
            background: 'var(--surface2)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Stream', 'Class teacher', 'Students'].map((h, i) => (
              <div key={h} style={{
                fontSize: 9, fontWeight: 800, color: 'var(--txt3)',
                textTransform: 'uppercase', letterSpacing: 0.8,
                textAlign: i === 2 ? 'right' : 'left',
              }}>{h}</div>
            ))}
          </div>
          <StreamRows classId={c.id} studentsByStream={studentsByStream} />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function PrincipalClassesPage() {
  const { data: classes  = [], isLoading } = useClasses()
  const { data: students = [] }            = useStudents()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const studentsByClass  = new Map<string, number>()
  const studentsByStream = new Map<string, number>()
  for (const s of students) {
    if (s.classId)  studentsByClass.set(s.classId,   (studentsByClass.get(s.classId)   ?? 0) + 1)
    if (s.streamId) studentsByStream.set(s.streamId, (studentsByStream.get(s.streamId) ?? 0) + 1)
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalStudents = students.length
  const totalClasses  = classes.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
            Classes
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
            {totalClasses} class{totalClasses !== 1 ? 'es' : ''} · {totalStudents.toLocaleString()} students enrolled
          </div>
        </div>

        {/* Expand / Collapse all */}
        {classes.length > 0 && (
          <button
            onClick={() => {
              if (expanded.size === classes.length) setExpanded(new Set())
              else setExpanded(new Set(classes.map(c => c.id)))
            }}
            style={{
              padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--txt2)', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt2)' }}
          >
            {expanded.size === classes.length ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {/* ── KPI strip ──────────────────────────────────────────── */}
      {!isLoading && classes.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {classes.map(c => {
            const meta  = levelMeta(c.level)
            const count = studentsByClass.get(c.id) ?? 0
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                  background: expanded.has(c.id) ? meta.bg : 'var(--surface)',
                  border: `1px solid ${expanded.has(c.id) ? `${meta.color}40` : 'var(--border)'}`,
                  transition: 'all 0.15s',
                  boxShadow: expanded.has(c.id) ? `0 2px 10px ${meta.color}20` : 'none',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: meta.color, fontFamily: 'var(--font2)' }}>
                  {c.name}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font3)',
                  color: expanded.has(c.id) ? meta.color : 'var(--txt3)',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shule-skeleton" style={{ height: 72, borderRadius: 16 }} />
          ))}
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────── */}
      {!isLoading && classes.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: '60px 24px', background: 'var(--surface)',
          borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18, background: 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No classes yet</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Classes will appear here once created.</div>
        </div>
      )}

      {/* ── Class cards ─────────────────────────────────────────── */}
      {!isLoading && classes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {classes.map(c => (
            <ClassCard
              key={c.id}
              c={c}
              studentCount={studentsByClass.get(c.id) ?? 0}
              studentsByStream={studentsByStream}
              expanded={expanded.has(c.id)}
              onToggle={() => toggle(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
