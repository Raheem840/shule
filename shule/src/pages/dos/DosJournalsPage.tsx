import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useClasses, useSubjects } from '../../hooks/useClasses'

type JournalRow = {
  id: string
  assessmentType: string
  subjectId: string | null
  classId: string | null
  term: string
  year: number
  totalMarks: number
  passMark: number
  status: string
  createdAt: string
  teacherName: string
}

function useAllJournals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dos-all-journals', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<JournalRow[]> => {
      const sid = user!.schoolId

      const [journalsRes, staffRes] = await Promise.all([
        supabase
          .from('exam_journal')
          .select('id, assessment_type, subject_id, class_id, term, year, total_marks, pass_mark, status, created_at, teacher_id')
          .eq('school_id', sid)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('staff')
          .select('id, first_name, last_name')
          .eq('school_id', sid),
      ])

      if (journalsRes.error) throw new Error(journalsRes.error.message)

      const staffMap = new Map<string, string>((staffRes.data ?? []).map((s: any) => [
        s.id as string,
        `${s.first_name} ${s.last_name}`,
      ]))

      return (journalsRes.data ?? []).map((r: any): JournalRow => ({
        id:             r.id,
        assessmentType: r.assessment_type,
        subjectId:      r.subject_id ?? null,
        classId:        r.class_id ?? null,
        term:           r.term,
        year:           r.year,
        totalMarks:     r.total_marks,
        passMark:       r.pass_mark,
        status:         r.status ?? 'draft',
        createdAt:      r.created_at,
        teacherName:    staffMap.get(r.teacher_id) ?? '—',
      }))
    },
    staleTime: 2 * 60_000,
  })
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Draft',     bg: 'var(--surface2)',   color: 'var(--txt3)'    },
  published: { label: 'Published', bg: 'var(--success-bg)', color: 'var(--success)' },
  locked:    { label: 'Locked',    bg: 'var(--warning-bg)', color: 'var(--warning)' },
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

  const classMap   = useMemo(() => new Map(classes.map(c  => [c.id, c.name])),   [classes])
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])),   [subjects])

  const rows = useMemo(() => {
    let r = data
    if (classFilter)   r = r.filter(j => j.classId   === classFilter)
    if (subjectFilter) r = r.filter(j => j.subjectId === subjectFilter)
    if (statusFilter)  r = r.filter(j => j.status     === statusFilter)
    if (termFilter)    r = r.filter(j => String(j.term) === termFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(j =>
        j.teacherName.toLowerCase().includes(q) ||
        (subjectMap.get(j.subjectId ?? '') ?? '').toLowerCase().includes(q)
      )
    }
    return r
  }, [data, classFilter, subjectFilter, statusFilter, termFilter, search, subjectMap])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="All Journals"
        subtitle="Read-only view of all exam journals across the school."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sui-input" placeholder="Search teacher, subject…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="sui-input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="sui-input" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="sui-input" value={termFilter} onChange={e => setTermFilter(e.target.value)}>
          <option value="">All Terms</option>
          <option value="1">Term 1</option>
          <option value="2">Term 2</option>
          <option value="3">Term 3</option>
        </select>
        <select className="sui-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="locked">Locked</option>
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}
      {isError   && <div style={{ color: 'var(--danger)', padding: 16 }}>Failed to load journals.</div>}

      {!isLoading && !isError && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Subject', 'Class', 'Type', 'Term', 'Teacher', 'Total / Pass', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No journals match the current filters.</td></tr>
              ) : rows.map(j => {
                const cfg = STATUS_CFG[j.status] ?? STATUS_CFG['draft']
                return (
                  <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
                      {subjectMap.get(j.subjectId ?? '') ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>
                      {classMap.get(j.classId ?? '') ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{j.assessmentType}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>T{j.term} {j.year}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{j.teacherName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>
                      {j.totalMarks} / {j.passMark}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
              Showing {rows.length} of {data.length} journals
            </div>
          )}
        </div>
      )}
    </div>
  )
}
