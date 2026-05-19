import { useState } from 'react'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import { useStudents } from '../../hooks/useStudents'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

// ── Level label helper ────────────────────────────────────────
function levelLabel(level: string | null): string {
  if (!level) return '—'
  const n = parseInt(level, 10)
  if (n <= 4) return `S.${n} (O-Level)`
  if (n === 5) return 'S.5 (A-Level)'
  if (n === 6) return 'S.6 (A-Level)'
  return `Level ${n}`
}

// Teal shades cycling per class level for visual distinction
const LEVEL_COLORS = [
  { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fefce8', border: '#fef08a', text: '#a16207' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
]

// ── Stream row inside a class card ────────────────────────────
function StreamRow({
  streamId,
  streamName,
  staffList,
  classId,
}: {
  streamId:   string
  streamName: string
  staffList:  { id: string; firstName: string; lastName: string; role: string }[]
  classId:    string
}) {
  const { data: students = [] } = useStudents({ classId, streamId })
  const count = students.length

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.85rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
          {streamName}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600 }}>
          {count} student{count !== 1 ? 's' : ''}
        </span>

        {(() => {
          const teacher = staffList.find(s => s.role === 'class_teacher')
          return teacher ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: 'var(--font2)', flexShrink: 0 }}>
                {teacher.firstName[0]}{teacher.lastName[0]}
              </div>
              <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600 }}>
                {teacher.firstName} {teacher.lastName}
              </span>
            </div>
          ) : (
            <Badge variant="amber">No teacher assigned</Badge>
          )
        })()}
      </div>
    </div>
  )
}

// ── Class card ────────────────────────────────────────────────
function ClassCard({
  cls,
  colorIdx,
  staffList,
}: {
  cls:       { id: string; name: string; level: string | null; academicYearId: string | null }
  colorIdx:  number
  staffList: { id: string; firstName: string; lastName: string; role: string }[]
}) {
  const [expanded, setExpanded] = useState(true)
  const { data: streams = [] }   = useStreams(cls.id)
  const { data: students = [] }  = useStudents({ classId: cls.id })

  const color = LEVEL_COLORS[colorIdx % LEVEL_COLORS.length]!

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Card header */}
      <div
        style={{ padding: '1rem 1.25rem', background: color.bg, borderBottom: `1px solid ${color.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: color.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 14, color: color.text }}>
              {cls.name}
            </span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', letterSpacing: '-0.2px' }}>
              {cls.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
              {levelLabel(cls.level)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: color.text }}>{students.length}</div>
              <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600 }}>students</div>
            </div>
            <div style={{ width: 1, background: color.border }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: color.text }}>{streams.length}</div>
              <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600 }}>streams</div>
            </div>
          </div>

          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Streams list */}
      {expanded && (
        <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {streams.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No streams configured for this class</div>
            </div>
          ) : (
            streams.map(stream => (
              <StreamRow
                key={stream.id}
                streamId={stream.id}
                streamName={stream.name}
                classId={cls.id}
                staffList={staffList}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function ClassListPage() {
  const { data: classes = [], isLoading } = useClasses()
  const { data: staffList = [] }          = useStaff({ isActive: true })

  const sortedClasses = [...classes].sort((a, b) => {
    const la = parseInt(a.level ?? '0', 10)
    const lb = parseInt(b.level ?? '0', 10)
    return la - lb
  })

  return (
    <div>
      <PageHeader
        title="Class List"
        subtitle={`${classes.length} class${classes.length !== 1 ? 'es' : ''} · ${new Date().getFullYear()}`}
      />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <LoadingSpinner />
        </div>
      ) : classes.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>
            No classes yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
            Classes are managed by the Director of Studies or Principal.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedClasses.map((cls, i) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              colorIdx={i}
              staffList={staffList.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, role: s.role }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
