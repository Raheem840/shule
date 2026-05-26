import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useClasses, useStreams } from '../../hooks/useClasses'

function StreamList({ classId }: { classId: string }) {
  const { data: streams = [] } = useStreams(classId)
  if (streams.length === 0) return <div style={{ padding: '8px 14px 8px 36px', fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No streams</div>
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {streams.map(s => (
        <div key={s.id} style={{ padding: '8px 14px 8px 36px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <span style={{ fontSize: 12, color: 'var(--txt2)' }}>{s.name}</span>
          <span style={{ fontSize: 11, color: s.classTeacherId ? 'var(--success)' : 'var(--txt3)' }}>
            {s.classTeacherId ? 'Class teacher assigned' : 'No class teacher'}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PrincipalClassesPage() {
  const { data: classes = [], isLoading } = useClasses()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)' }}>No classes found.</div>
          ) : classes.map(c => (
            <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div
                onClick={() => toggle(c.id)}
                style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{expanded.has(c.id) ? '▼' : '▶'}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
                  {expanded.has(c.id) ? 'Collapse' : 'Expand streams'}
                </span>
              </div>
              {expanded.has(c.id) && <StreamList classId={c.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
