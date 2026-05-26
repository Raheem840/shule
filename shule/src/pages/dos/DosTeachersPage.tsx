import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useDosTeacherPerformance } from '../../hooks/useDos'

export function DosTeachersPage() {
  const { data = [], isLoading, isError } = useDosTeacherPerformance()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'passRate' | 'coverage'>('passRate')

  const rows = useMemo(() => {
    let r = data
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(t => t.name.toLowerCase().includes(q))
    }
    return [...r].sort((a, b) => {
      if (sort === 'passRate') return b.passRate - a.passRate
      if (sort === 'coverage') return b.curriculumCoverage - a.curriculumCoverage
      return a.name.localeCompare(b.name)
    })
  }, [data, search, sort])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Teachers"
        subtitle="Teacher performance — pass rates and curriculum coverage."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sui-input" placeholder="Search teacher…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="sui-input" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="passRate">Sort by Pass Rate</option>
          <option value="coverage">Sort by Curriculum Coverage</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}
      {isError   && <div style={{ color: 'var(--danger)', padding: 16 }}>Failed to load teacher data.</div>}

      {!isLoading && !isError && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Teacher', 'Subjects', 'Assessments', 'Pass Rate', 'Curriculum'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No teacher data available.</td></tr>
                ) : (
                  <>
                    <tr style={{ height: virtualiser.getVirtualItems()[0]?.start ?? 0 }}><td colSpan={5} /></tr>
                    {virtualiser.getVirtualItems().map(vi => {
                      const t = rows[vi.index]
                      return (
                        <tr key={t.staffId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{t.name}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>{t.subjects.length}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>{t.assessmentsThisTerm}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <RateBar value={t.passRate} />
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <RateBar value={t.curriculumCoverage} />
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ height: virtualiser.getTotalSize() - (virtualiser.getVirtualItems().at(-1)?.end ?? 0) }}><td colSpan={5} /></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
              {rows.length} teacher{rows.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RateBar({ value }: { value: number }) {
  const color = value >= 70 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font3)', color }}>{value}%</span>
    </div>
  )
}
