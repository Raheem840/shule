import { useState } from 'react'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useTimetableSlots } from '../../hooks/useTimetableSlots'

const DAYS: [number, string][] = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri']]
const PERIODS = [1,2,3,4,5,6,7,8]

export function DeputyTimetablePage() {
  const { data: classes = [] } = useClasses()
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const { data: streams = [] } = useStreams(selectedClass)
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [term, setTerm] = useState('Term 1')
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: slots = [], isLoading } = useTimetableSlots({
    classId:   selectedClass,
    streamId:  selectedStream,
    term, year,
    published: true,
  })

  const slotMap = new Map<string, typeof slots[number]>()
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.periodNumber}`, s)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          Timetable
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>Read-only view of the published timetable.</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Class</label>
          <select
            value={selectedClass ?? ''}
            onChange={e => { setSelectedClass(e.target.value || null); setSelectedStream(null) }}
            className="sui-input" style={{ width: 180 }}
          >
            <option value="">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {streams.length > 0 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Stream</label>
            <select value={selectedStream ?? ''} onChange={e => setSelectedStream(e.target.value || null)} className="sui-input" style={{ width: 160 }}>
              <option value="">All streams</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Term</label>
          <select value={term} onChange={e => setTerm(e.target.value)} className="sui-input" style={{ width: 120 }}>
            {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="sui-input" style={{ width: 100 }} />
        </div>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading timetable…</div>}

      {!isLoading && slots.length === 0 && (
        <div style={{ color: 'var(--txt3)', padding: 32, textAlign: 'center', fontSize: 13,
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
          No published timetable found for this selection.
        </div>
      )}

      {!isLoading && slots.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 700,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 16px', background: 'var(--surface2)',
                  fontWeight: 700, fontSize: 12, color: 'var(--txt2)', minWidth: 70 }}>Period</th>
                {DAYS.map(([d, label]) => (
                  <th key={d} style={{ padding: '10px 16px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)', minWidth: 130 }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period} className="sui-tr">
                  <td style={{ padding: '8px 16px', fontWeight: 700, fontSize: 12,
                    color: 'var(--txt3)', textAlign: 'center', background: 'var(--surface2)',
                    borderRight: '1px solid var(--border)' }}>
                    P{period}
                  </td>
                  {DAYS.map(([day]) => {
                    const s = slotMap.get(`${day}-${period}`)
                    return (
                      <td key={day} style={{ padding: 6, border: '1px solid var(--border)', verticalAlign: 'top' }}>
                        {s ? (
                          <div style={{ background: 'var(--brand-light)', borderRadius: 8, padding: '4px 8px' }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--brand)' }}>
                              {s.subjectName ?? '—'}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{s.teacherName ?? '—'}</div>
                            {s.startTime && (
                              <div style={{ fontSize: 9, color: 'var(--txt3)' }}>{s.startTime}–{s.endTime}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
