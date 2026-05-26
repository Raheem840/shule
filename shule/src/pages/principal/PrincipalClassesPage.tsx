import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudents } from '../../hooks/useStudents'

function StreamList({ classId, studentsByStream }: { classId: string; studentsByStream: Map<string, number> }) {
  const { data: streams = [] } = useStreams(classId)
  if (streams.length === 0) return (
    <div style={{ padding: '8px 14px 8px 36px', fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>
      No streams
    </div>
  )
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {streams.map(s => (
        <div key={s.id} style={{
          padding: '8px 14px 8px 36px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border)', background: 'var(--bg)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600 }}>{s.name}</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
              {studentsByStream.get(s.id) ?? 0} students
            </span>
            <span style={{ fontSize: 11, color: s.classTeacherId ? 'var(--success)' : 'var(--txt3)' }}>
              {s.classTeacherId ? 'Class teacher assigned' : 'No class teacher'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PrincipalClassesPage() {
  const { data: classes = [], isLoading } = useClasses()
  const { data: students = [] } = useStudents()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Count students per class and per stream
  const studentsByClass  = new Map<string, number>()
  const studentsByStream = new Map<string, number>()
  for (const s of students) {
    if (s.classId)  studentsByClass.set(s.classId,   (studentsByClass.get(s.classId)   ?? 0) + 1)
    if (s.streamId) studentsByStream.set(s.streamId, (studentsByStream.get(s.streamId) ?? 0) + 1)
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Classes"
        subtitle="All classes and their streams."
      />

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <LoadingSpinner size="md" />
        </div>
      )}

      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)' }}>No classes found.</div>
          ) : classes.map(c => (
            <div key={c.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div
                onClick={() => toggle(c.id)}
                style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{expanded.has(c.id) ? '▼' : '▶'}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{c.name}</span>
                  {c.level && (
                    <span style={{ padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'var(--surface2)', color: 'var(--txt3)' }}>
                      {c.level}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                    {studentsByClass.get(c.id) ?? 0} students
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
                    {expanded.has(c.id) ? 'Collapse' : 'View streams'}
                  </span>
                </div>
              </div>
              {expanded.has(c.id) && <StreamList classId={c.id} studentsByStream={studentsByStream} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
