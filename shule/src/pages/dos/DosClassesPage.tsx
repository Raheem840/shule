import { useState, Fragment } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useAssignClassTeacher } from '../../hooks/useDos'
import { useStaff } from '../../hooks/useStaff'
import { useToast } from '../../components/ui/Toast'
import type { Stream } from '../../types/app'

function AssignTeacherModal({
  stream, onClose,
}: { stream: Stream; onClose: () => void }) {
  const { success: ok, error: err } = useToast()
  const { data: staff = [] } = useStaff()
  const assign = useAssignClassTeacher()
  const [selectedId, setSelectedId] = useState('')

  const teachers = staff.filter(s => s.role === 'teacher' || s.role === 'class_teacher')

  async function handleAssign() {
    if (!selectedId) return
    try {
      await assign.mutateAsync({ streamId: stream.id, classId: stream.classId, teacherId: selectedId })
      ok('Class teacher assigned.')
      onClose()
    } catch (e: any) {
      err(e.message)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>Assign Class Teacher — {stream.name}</h3>
        <select className="sui-input" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ width: '100%', marginBottom: 16 }}>
          <option value="">Select teacher…</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="sui-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sui-btn-primary" onClick={handleAssign} disabled={!selectedId || assign.isPending}>
            {assign.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StreamRows({ classId }: { classId: string }) {
  const { data: streams = [] } = useStreams(classId)
  const [assignStream, setAssignStream] = useState<Stream | null>(null)

  return (
    <>
      {streams.map(s => (
        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
          <td style={{ padding: '8px 14px 8px 36px', fontSize: 12, color: 'var(--txt2)' }}>{s.name}</td>
          <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--txt3)' }}>—</td>
          <td style={{ padding: '8px 14px', fontSize: 12 }}>
            {s.classTeacherId ? (
              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success)' }}>Assigned</span>
            ) : (
              <button className="sui-btn-ghost" style={{ fontSize: 11, padding: '2px 10px' }}
                onClick={() => setAssignStream(s)}>
                Assign Teacher
              </button>
            )}
          </td>
        </tr>
      ))}
      {assignStream && (
        <AssignTeacherModal
          stream={assignStream}
          onClose={() => setAssignStream(null)}
        />
      )}
    </>
  )
}

export function DosClassesPage() {
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
        subtitle="Classes and streams. Assign class teachers per stream."
      />

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Class / Stream', 'Students', 'Class Teacher'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No classes found.</td></tr>
              ) : classes.map(c => (
                <Fragment key={c.id}>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }}
                    onClick={() => toggle(c.id)}>
                    <td style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{expanded.has(c.id) ? '▼' : '▶'}</span>
                      <span style={{ fontWeight: 800, color: 'var(--txt)', fontSize: 14 }}>{c.name}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt3)' }}>—</td>
                    <td style={{ padding: '10px 14px' }}></td>
                  </tr>
                  {expanded.has(c.id) && <StreamRows classId={c.id} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
