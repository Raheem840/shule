import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { TermPicker } from '../../components/ui/TermPicker'

type SurveyResponse = {
  id: string; studentName: string; className: string
  overallRating: number; teacherRating: number
  hardestSubject: string | null; favouriteSubject: string | null
  suggestions: string | null; submittedAt: string
}
type SurveySummary = {
  total: number; avgOverall: number; avgTeacher: number
  hardestSubjects: { name: string; count: number }[]
  favouriteSubjects: { name: string; count: number }[]
}

function useSurveyResponses(term: string, year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['survey-responses', user?.schoolId, term, year],
    enabled: !!user?.schoolId,
    queryFn: async (): Promise<{ responses: SurveyResponse[]; summary: SurveySummary }> => {
      const { data, error } = await supabase.from('student_surveys').select('id, rating, teacher_rating, hardest_subject_id, favourite_subject_id, suggestions, submitted_at, term, year, student_id').eq('school_id', user!.schoolId).eq('term', term).eq('year', year).order('submitted_at', { ascending: false })
      if (error?.code === '42P01') return { responses: [], summary: { total: 0, avgOverall: 0, avgTeacher: 0, hardestSubjects: [], favouriteSubjects: [] } }
      if (error) throw error
      const rows = data ?? []

      // Resolve subject UUIDs and student names in parallel
      const subjectIds  = [...new Set(rows.flatMap((r: any) => [r.hardest_subject_id, r.favourite_subject_id].filter(Boolean) as string[]))]
      const studentIds  = [...new Set(rows.map((r: any) => r.student_id as string).filter(Boolean))]
      const subjectMap  = new Map<string, string>()
      const studentMap  = new Map<string, { name: string; classId: string | null }>()
      const classMap    = new Map<string, string>()

      const [subjectsRes, studentsRes] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name').eq('school_id', user!.schoolId).in('id', subjectIds)
          : Promise.resolve({ data: [] }),
        studentIds.length > 0
          ? supabase.from('students').select('id, first_name, last_name, class_id').eq('school_id', user!.schoolId).in('id', studentIds)
          : Promise.resolve({ data: [] }),
      ])
      for (const s of (subjectsRes as any).data ?? []) subjectMap.set(s.id, s.name)
      const classIds = [...new Set(((studentsRes as any).data ?? []).map((s: any) => s.class_id as string).filter(Boolean))]
      if (classIds.length > 0) {
        const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', user!.schoolId).in('id', classIds)
        for (const c of classes ?? []) classMap.set((c as any).id, (c as any).name)
      }
      for (const s of (studentsRes as any).data ?? []) {
        studentMap.set(s.id, { name: `${s.first_name} ${s.last_name}`, classId: s.class_id ?? null })
      }

      const responses: SurveyResponse[] = rows.map((r: any) => {
        const stu = studentMap.get(r.student_id)
        return {
          id: r.id,
          studentName: stu?.name ?? `Student ${r.student_id?.slice(0, 8) ?? 'Unknown'}`,
          className:   stu?.classId ? (classMap.get(stu.classId) ?? '—') : '—',
          overallRating: r.rating ?? 0,
          teacherRating: r.teacher_rating ?? 0,
          hardestSubject:   r.hardest_subject_id ? (subjectMap.get(r.hardest_subject_id) ?? r.hardest_subject_id) : null,
          favouriteSubject: r.favourite_subject_id ? (subjectMap.get(r.favourite_subject_id) ?? r.favourite_subject_id) : null,
          suggestions: r.suggestions ?? null,
          submittedAt: r.submitted_at,
        }
      })
      const total      = responses.length
      const avgOverall = total > 0 ? Math.round((responses.reduce((s, r) => s + r.overallRating, 0) / total) * 10) / 10 : 0
      const avgTeacher = total > 0 ? Math.round((responses.reduce((s, r) => s + r.teacherRating, 0) / total) * 10) / 10 : 0
      function topItems(items: (string | null)[]): { name: string; count: number }[] {
        const counts: Record<string, number> = {}
        for (const i of items) { if (i) counts[i] = (counts[i] ?? 0) + 1 }
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
      }
      return { responses, summary: { total, avgOverall, avgTeacher, hardestSubjects: topItems(responses.map(r => r.hardestSubject)), favouriteSubjects: topItems(responses.map(r => r.favouriteSubject)) } }
    },
    staleTime: 5 * 60_000,
  })
}

function Stars({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: 13, color: i <= Math.round(value) ? 'var(--warning)' : 'var(--border)' }}>★</span>
      ))}
    </div>
  )
}

function RatingBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct  = (value / max) * 100
  const col  = value >= 4 ? 'var(--success)' : value >= 3 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 99, transition: 'width .5s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: col, fontFamily: 'var(--font3)', flexShrink: 0, minWidth: 24 }}>{value}</span>
    </div>
  )
}

export function DosSurveysPage() {
  const currentYear = new Date().getFullYear()
  const [term, setTerm] = useState('2')
  const [year, setYear] = useState(currentYear)

  const { data, isLoading } = useSurveyResponses(term, year)
  const responses = data?.responses ?? []
  const summary   = data?.summary

  const parentRef   = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({ count: responses.length, getScrollElement: () => parentRef.current, estimateSize: () => 56, overscan: 5 })

  async function exportExcel() {
    if (!responses.length) return
    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Shule Management System'
    wb.created = new Date()
    const ws = wb.addWorksheet('Survey Results')

    const lastCol = 'H'
    const title = `Student Survey Results — Term ${term}, Year ${year}`

    ws.mergeCells(`A1:${lastCol}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = title
    titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 28

    ws.mergeCells(`A2:${lastCol}2`)
    const dateCell = ws.getCell('A2')
    dateCell.value = `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    dateCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF64748B' } }
    dateCell.alignment = { horizontal: 'right' }
    ws.getRow(2).height = 14

    const headers = ['Student Name', 'Class', 'Overall Rating', 'Teacher Rating', 'Hardest Subject', 'Favourite Subject', 'Suggestions', 'Submitted']
    const headerRow = ws.addRow(headers)
    headerRow.height = 20
    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF8B5CF6' } } }
    })

    responses.forEach((r, i) => {
      const dataRow = ws.addRow([
        r.studentName,
        r.className,
        r.overallRating,
        r.teacherRating,
        r.hardestSubject ?? '—',
        r.favouriteSubject ?? '—',
        r.suggestions ?? '',
        new Date(r.submittedAt).toLocaleDateString('en-GB'),
      ])
      dataRow.height = 16
      dataRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
        cell.font = { name: 'Calibri', size: 10 }
        cell.alignment = { vertical: 'middle' }
        if (colNum === 3 || colNum === 4) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })
    })

    const colWidths = [24, 12, 14, 14, 20, 20, 36, 14]
    ws.columns.forEach((col, i) => { col.width = colWidths[i] ?? 14 })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `survey-results-T${term}-${year}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    const header = 'Student,Class,Overall,Teacher,Hardest,Favourite,Suggestions,Submitted\n'
    const csvRows = responses.map(r => `"${r.studentName}","${r.className}","${r.overallRating}","${r.teacherRating}","${r.hardestSubject ?? ''}","${r.favouriteSubject ?? ''}","${(r.suggestions ?? '').replace(/"/g, '""')}","${r.submittedAt}"`).join('\n')
    const blob   = new Blob([header + csvRows], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a'); a.href = url; a.download = `surveys-t${term}-${year}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,var(--violet),#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(139,92,246,.45)', flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Survey Responses</h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>End-of-term student satisfaction surveys.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => exportExcel()} disabled={!responses.length}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,var(--violet),#7c3aed)', cursor: responses.length ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, color: '#fff', opacity: responses.length ? 1 : 0.5, boxShadow: '0 3px 12px rgba(139,92,246,.35)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Excel
            </button>
            <button onClick={exportCSV} disabled={!responses.length}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: '.5px solid var(--border)', background: 'var(--surface)', cursor: responses.length ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', opacity: responses.length ? 1 : 0.5 }}>
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Term</div>
          <TermPicker value={term} onChange={setTerm} />
        </div>
        <div style={{ flex: '0 0 88px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Year</div>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="sui-input" style={{ width: '100%' }}>
            {[currentYear, currentYear-1, currentYear-2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 60, borderRadius: 12 }} />)}</div>}

      {!isLoading && summary && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Responses',        value: summary.total,      color: 'var(--violet)',  glow: 'rgba(139,92,246,.18)' },
              { label: 'Avg Overall',       value: summary.avgOverall, color: 'var(--warning)', glow: 'rgba(245,158,11,.18)', sub: '/ 5' },
              { label: 'Avg Teacher',       value: summary.avgTeacher, color: 'var(--brand)',   glow: 'rgba(13,148,136,.18)', sub: '/ 5' },
            ].map(k => (
              <div key={k.label} style={{ flex: '1 1 120px', padding: '16px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
                <div style={{ position: 'absolute', top: -14, right: -14, width: 60, height: 60, borderRadius: '50%', background: k.glow, filter: 'blur(18px)', pointerEvents: 'none' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: k.color, letterSpacing: -1 }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 13, color: 'var(--txt3)' }}>{k.sub}</div>}
                </div>
                {(k.sub) && <RatingBar value={k.value as number} />}
              </div>
            ))}
          </div>

          {/* Subject insights */}
          {(summary.hardestSubjects.length > 0 || summary.favouriteSubjects.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
              {summary.hardestSubjects.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '.5px solid rgba(244,63,94,.2)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(244,63,94,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                    </div>
                    <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Most Difficult</div>
                  </div>
                  {summary.hardestSubjects.map(({ name, count }, i) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < summary.hardestSubjects.length - 1 ? '.5px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500 }}>{name}</span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--danger)', fontFamily: 'var(--font3)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {summary.favouriteSubjects.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '.5px solid rgba(16,185,129,.2)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    </div>
                    <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Most Loved</div>
                  </div>
                  {summary.favouriteSubjects.map(({ name, count }, i) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < summary.favouriteSubjects.length - 1 ? '.5px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500 }}>{name}</span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--success)', fontFamily: 'var(--font3)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Responses list */}
          {responses.length === 0 ? (
            <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 8 }}>No survey responses yet</div>
              <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 360, margin: '0 auto' }}>Enable the survey in Academic Year settings so students can submit responses for Term {term} {year}.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Student','Class','Overall','Teacher','Hardest','Favourite','Suggestions'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', background: 'var(--surface2)', fontWeight: 700, fontSize: 10.5, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, borderBottom: '.5px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
              </table>
              <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 520 }}>
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map(vRow => {
                    const r = responses[vRow.index]
                    return (
                      <div key={r.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)`, height: 56, display: 'flex', alignItems: 'center', borderBottom: '.5px solid var(--border)', padding: '0 14px', gap: 8 }}>
                        <div style={{ flex: 1.5, fontSize: 13, fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.studentName}</div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.className}</div>
                        <div style={{ flex: 1, flexShrink: 0 }}><Stars value={r.overallRating} /></div>
                        <div style={{ flex: 1, flexShrink: 0 }}><Stars value={r.teacherRating} /></div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.hardestSubject ?? '—'}</div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.favouriteSubject ?? '—'}</div>
                        <div style={{ flex: 2, fontSize: 11, color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.suggestions ?? '—'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
