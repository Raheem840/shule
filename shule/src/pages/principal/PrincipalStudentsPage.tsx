import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents } from '../../hooks/useStudents'
import { InitialsAvatar } from '../../components/shared/InitialsAvatar'

export function PrincipalStudentsPage() {
  const navigate = useNavigate()
  const { data: students = [], isLoading } = useStudents()
  const [search, setSearch] = useState('')

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q)
    )
  })

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
            Students
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <input
        placeholder="Search by name or admission number…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="sui-input"
        style={{ maxWidth: 360 }}
      />

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading students…</div>}

      {!isLoading && filtered.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--txt3)',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        }}>
          No students found.
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Student', 'Adm #', 'Class', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)',
                    textAlign: 'left',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 600 }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const s = filtered[vRow.index]
                return (
                  <div
                    key={s.id}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                      height: 56, display: 'flex', alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      padding: '0 14px',
                    }}
                    onClick={() => navigate(`/principal/students/${s.id}`)}
                    className="sui-tr"
                  >
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <InitialsAvatar name={`${s.firstName} ${s.lastName}`} photoUrl={s.photoUrl} size="sm" />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>
                        {s.firstName} {s.lastName}
                      </span>
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
                      {s.admissionNumber}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--txt2)' }}>
                      {s.classId ?? '—'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: s.status === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: s.status === 'active' ? 'var(--success)' : 'var(--danger)',
                        textTransform: 'capitalize',
                      }}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
