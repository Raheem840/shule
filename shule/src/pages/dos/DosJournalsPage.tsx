import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useClasses, useSubjects } from '../../hooks/useClasses'

type JournalRow = {
  id: string; assessmentType: string; subjectId: string | null; classId: string | null
  term: string; year: number; totalMarks: number; passMark: number; status: string
  createdAt: string; teacherName: string
}

function useAllJournals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dos-all-journals', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<JournalRow[]> => {
      const sid = user!.schoolId
      const [journalsRes, staffRes] = await Promise.all([
        supabase.from('exam_journal').select('id, assessment_type, subject_id, class_id, term, year, total_marks, pass_mark, status, created_at, teacher_id').eq('school_id', sid).order('created_at', { ascending: false }).limit(300),
        supabase.from('staff').select('id, first_name, last_name').eq('school_id', sid),
      ])
      if (journalsRes.error) throw new Error(journalsRes.error.message)
      const staffMap = new Map<string, string>((staffRes.data ?? []).map((s: any) => [s.id as string, `${s.first_name} ${s.last_name}`]))
      return (journalsRes.data ?? []).map((r: any): JournalRow => ({
        id: r.id, assessmentType: r.assessment_type, subjectId: r.subject_id ?? null, classId: r.class_id ?? null,
        term: r.term, year: r.year, totalMarks: r.total_marks, passMark: r.pass_mark, status: r.status ?? 'draft',
        createdAt: r.created_at, teacherName: staffMap.get(r.teacher_id) ?? '—',
      }))
    },
    staleTime: 2 * 60_000,
  })
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: '#64748b', bg: 'var(--surface2)',        label: 'Draft'     },
  published: { color: '#10b981', bg: 'rgba(16,185,129,.1)',    label: 'Published' },
  locked:    { color: '#f59e0b', bg: 'rgba(245,158,11,.1)',    label: 'Locked'    },
}

const TYPE_COLOR: Record<string, string> = {
  ca: '#0d9488', mid_term: '#8b5cf6', end_of_term: '#f43f5e', beginning_of_term: '#0ea5e9',
  aoi: '#10b981', dit: '#f59e0b', practical: '#ec4899', class_test: '#6366f1', assignment: '#64748b',
}

export function DosJournalsPage() {
  const { data = [], isLoading, isError } = useAllJournals()
  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()

  const [classFilter,   setClassFilter]   = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [termFilter,    setTermFilter]    = useState('')
  const [search,        setSearch]        = useState('')

  const classMap   = useMemo(() => new Map(classes.map(c => [c.id, c.name])),   [classes])
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects])

  const rows = useMemo(() => {
    let r = data
    if (classFilter)   r = r.filter(j => j.classId   === classFilter)
    if (subjectFilter) r = r.filter(j => j.subjectId === subjectFilter)
    if (statusFilter)  r = r.filter(j => j.status    === statusFilter)
    if (termFilter)    r = r.filter(j => String(j.term) === termFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(j => j.teacherName.toLowerCase().includes(q) || (subjectMap.get(j.subjectId ?? '') ?? '').toLowerCase().includes(q))
    }
    return r
  }, [data, classFilter, subjectFilter, statusFilter, termFilter, search, subjectMap])

  const published = data.filter(j => j.status === 'published').length
  const draft     = data.filter(j => j.status === 'draft').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(139,92,246,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>All Journals</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Read-only view of all exam journals across the school.</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Journals', value: data.length, color: '#8b5cf6', glow: 'rgba(139,92,246,.18)' },
            { label: 'Published',      value: published,   color: '#10b981', glow: 'rgba(16,185,129,.18)' },
            { label: 'Drafts',         value: draft,       color: '#f59e0b', glow: 'rgba(245,158,11,.18)' },
          ].map(k => (
            <div key={k.label} style={{ flex: '1 1 120px', padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
              <div style={{ position: 'absolute', top: -14, right: -14, width: 60, height: 60, borderRadius: '50%', background: k.glow, filter: 'blur(18px)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: k.color, letterSpacing: -1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Search</div>
          <input className="sui-input" placeholder="Teacher, subject…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
        </div>
        {[
          { label: 'Class',   val: classFilter,   set: setClassFilter,   opts: [['','All Classes'],...classes.map(c=>[c.id,c.name])] as [string,string][] },
          { label: 'Subject', val: subjectFilter, set: setSubjectFilter, opts: [['','All Subjects'],...subjects.map(s=>[s.id,s.name])] as [string,string][] },
          { label: 'Term',    val: termFilter,    set: setTermFilter,    opts: [['','All Terms'],['1','T1'],['2','T2'],['3','T3']] as [string,string][] },
          { label: 'Status',  val: statusFilter,  set: setStatusFilter,  opts: [['','All'],['draft','Draft'],['published','Published'],['locked','Locked']] as [string,string][] },
        ].map(({ label, val, set, opts }) => (
          <div key={label} style={{ flex: '0 1 120px', minWidth: 100 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>{label}</div>
            <select value={val} onChange={e => set(e.target.value)} className="sui-input" style={{ width: '100%' }}>
              {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 52, borderRadius: 10 }} />)}</div>}
      {isError && <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontSize: 13 }}>Failed to load journals.</div>}

      {!isLoading && !isError && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          <div className="hscroll">
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
              <thead>
                <tr>
                  {['Subject', 'Class', 'Type', 'Term', 'Teacher', 'Marks', 'Status'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', background: 'var(--surface2)', fontWeight: 700, fontSize: 10.5, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, borderBottom: '.5px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No journals match the current filters.</td></tr>
                ) : rows.map(j => {
                  const cfg  = STATUS_META[j.status] ?? STATUS_META['draft']
                  const tCol = TYPE_COLOR[j.assessmentType] ?? '#64748b'
                  return (
                    <tr key={j.id} style={{ borderBottom: '.5px solid var(--border)', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '11px 14px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{subjectMap.get(j.subjectId ?? '') ?? '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--txt2)' }}>{classMap.get(j.classId ?? '') ?? '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: `${tCol}18`, color: tCol, border: `.5px solid ${tCol}30`, whiteSpace: 'nowrap' }}>{j.assessmentType.replace(/_/g,' ')}</span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)', whiteSpace: 'nowrap' }}>T{j.term} {j.year}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--txt2)' }}>{j.teacherName}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{j.totalMarks} / {j.passMark}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `.5px solid ${cfg.color}30` }}>{cfg.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <div style={{ padding: '8px 16px', borderTop: '.5px solid var(--border)', fontSize: 11.5, color: 'var(--txt3)' }}>
              Showing {rows.length} of {data.length} journals
            </div>
          )}
        </div>
      )}
    </div>
  )
}
