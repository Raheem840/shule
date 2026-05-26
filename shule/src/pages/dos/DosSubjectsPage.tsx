import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useSubjects } from '../../hooks/useClasses'

export function DosSubjectsPage() {
  const [levelFilter, setLevelFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: subjects = [], isLoading } = useSubjects(levelFilter || undefined)

  const filtered = search.trim()
    ? subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : subjects

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Subjects"
        subtitle="All subjects offered across the school."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sui-input" placeholder="Search subject…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="sui-input" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
          <option value="">All Levels</option>
          <option value="O-Level">O-Level (S.1–S.4)</option>
          <option value="A-Level">A-Level (S.5–S.6)</option>
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Subject', 'Curriculum Code', 'Level'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No subjects found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--txt)', fontSize: 13 }}>{s.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{s.curriculumCode ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {s.level ? (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: s.level === 'A-Level' ? 'var(--violet-bg)' : 'var(--info-bg)',
                        color: s.level === 'A-Level' ? 'var(--violet)' : 'var(--info)',
                      }}>
                        {s.level}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Both</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
              {filtered.length} subject{filtered.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
