import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useClasses, useSubjects } from '../../hooks/useClasses'
import type { CurriculumTopic } from '../../types/week9'

function useMyTopics() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-curriculum', user?.schoolId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CurriculumTopic[]> => {
      const { data: staffRow } = await supabase.from('staff').select('id, subjects').eq('auth_user_id', user!.id).maybeSingle()
      if (!staffRow) return []
      const mySubjects = new Set<string>(((staffRow as any).subjects ?? []) as string[])
      const { data, error } = await supabase.from('curriculum_plan').select('id, school_id, subject_id, class_id, topic, term, year, expected_date, covered, covered_at, covered_by').eq('school_id', user!.schoolId).order('expected_date', { ascending: true, nullsFirst: false })
      if (error) throw new Error(error.message)
      return (data ?? []).filter((r: any) => mySubjects.size === 0 || mySubjects.has(r.subject_id as string)).map((r: any, idx: number): CurriculumTopic => ({ id: r.id, schoolId: r.school_id, subjectId: r.subject_id, classId: r.class_id, topicName: r.topic, ncdcCode: null, term: r.term, year: r.year, plannedDate: r.expected_date, coveredAt: r.covered_at, coveredBy: r.covered_by, teacherId: null, sequenceOrder: idx + 1 }))
    },
    staleTime: 2 * 60_000,
  })
}

// Hook to fetch teacher's own staff record (subjects + classes assigned)
function useMyStaffRecord() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-staff-record', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('staff').select('id, subjects, classes').eq('auth_user_id', user!.id).eq('school_id', user!.schoolId).maybeSingle()
      return data as { id: string; subjects: string[]; classes: string[] } | null
    },
    staleTime: 5 * 60_000,
  })
}

function useAddCurriculumTopic() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { subjectId: string; classId: string; topic: string; term: string; year: number; plannedDate?: string | null; ncdcCode?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('curriculum_plan').insert({
        school_id:     user.schoolId,
        subject_id:    input.subjectId,
        class_id:      input.classId,
        topic:         input.topic,
        term:          input.term,
        year:          input.year,
        expected_date: input.plannedDate ?? null,
        covered:       false,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-curriculum'] }),
  })
}

// Modal to add a new curriculum topic
function AddTopicModal({ onClose, mySubjectIds, myClassIds }: {
  onClose: () => void
  mySubjectIds: string[]
  myClassIds: string[]
}) {
  const { data: classes = [] }  = useClasses()
  const { data: subjects = [] } = useSubjects()
  const addMut = useAddCurriculumTopic()
  const { success: ok, error: err } = useToast()

  const availableSubjects = mySubjectIds.length > 0 ? subjects.filter(s => mySubjectIds.includes(s.id)) : subjects
  const availableClasses  = myClassIds.length  > 0 ? classes.filter(c => myClassIds.includes(c.id))  : classes

  const [form, setForm] = useState({ subjectId: '', classId: '', topic: '', term: '1', year: new Date().getFullYear().toString(), plannedDate: '', ncdcCode: '' })
  const [saving, setSaving] = useState(false)

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (!form.subjectId || !form.classId || !form.topic.trim()) { err('Subject, class and topic are required'); return }
    setSaving(true)
    try {
      await addMut.mutateAsync({ subjectId: form.subjectId, classId: form.classId, topic: form.topic.trim(), term: form.term, year: parseInt(form.year), plannedDate: form.plannedDate || null, ncdcCode: form.ncdcCode.trim() || null })
      ok('Topic added to curriculum plan')
      onClose()
    } catch (e: any) { err(e.message ?? 'Failed to add topic') }
    finally { setSaving(false) }
  }

  const Lbl = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .6 }}>
      {children}{req && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
    </label>
  )

  const portal = document.querySelector('.ar') as HTMLElement ?? document.body
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '90dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 18px', background: 'linear-gradient(150deg,rgba(13,148,136,.1),transparent)', borderBottom: '.5px solid rgba(13,148,136,.2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(13,148,136,.4)', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>Add Curriculum Topic</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Plan topics you'll cover this term</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Lbl req>Subject</Lbl>
              <select value={form.subjectId} onChange={e => f('subjectId', e.target.value)} className="sui-input" style={{ width: '100%' }}>
                <option value="">Select subject…</option>
                {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Lbl req>Class</Lbl>
              <select value={form.classId} onChange={e => f('classId', e.target.value)} className="sui-input" style={{ width: '100%' }}>
                <option value="">Select class…</option>
                {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Lbl req>Topic Name</Lbl>
            <input value={form.topic} onChange={e => f('topic', e.target.value)} className="sui-input" style={{ width: '100%' }} placeholder="e.g. Photosynthesis and Respiration" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Lbl req>Term</Lbl>
              <select value={form.term} onChange={e => f('term', e.target.value)} className="sui-input" style={{ width: '100%' }}>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
            <div>
              <Lbl req>Year</Lbl>
              <input type="number" value={form.year} onChange={e => f('year', e.target.value)} className="sui-input" style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Lbl>Planned Date</Lbl>
              <input type="date" value={form.plannedDate} onChange={e => f('plannedDate', e.target.value)} className="sui-input" style={{ width: '100%' }} />
            </div>
            <div>
              <Lbl>NCDC Code</Lbl>
              <input value={form.ncdcCode} onChange={e => f('ncdcCode', e.target.value)} className="sui-input" style={{ width: '100%' }} placeholder="e.g. BIO-S3-T1-01" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
            <button disabled={saving || !form.subjectId || !form.classId || !form.topic.trim()} onClick={() => { void save() }}
              style={{ flex: 2, padding: '11px 0', background: !saving && form.subjectId && form.classId && form.topic.trim() ? 'linear-gradient(145deg,#0d9488,#0f766e)' : 'var(--border)', color: !saving && form.subjectId && form.classId && form.topic.trim() ? '#fff' : 'var(--txt3)', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: !saving && form.subjectId && form.classId && form.topic.trim() ? '0 4px 14px rgba(13,148,136,.4)' : 'none', transition: 'all .18s' }}>
              {saving ? 'Adding…' : 'Add Topic'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portal
  )
}

function useMarkTopicCovered() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (topicId: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('curriculum_plan').update({ covered_at: new Date().toISOString(), covered_by: user.id }).eq('id', topicId).eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
      const { data: dosStaff } = await supabase.from('staff').select('auth_user_id').eq('school_id', user.schoolId).eq('role', 'dos').maybeSingle()
      if ((dosStaff as any)?.auth_user_id) {
        await supabase.from('notifications').insert({ school_id: user.schoolId, user_id: (dosStaff as any).auth_user_id, type: 'general', body: 'A teacher has marked a curriculum topic as covered.', link: '/dos/curriculum', read_at: null })
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-curriculum', user?.schoolId, user?.id] }),
  })
}

export function TeacherCurriculumPage() {
  const { data = [], isLoading }   = useMyTopics()
  const { data: classes = [] }     = useClasses()
  const { data: subjects = [] }    = useSubjects()
  const { data: staffRecord }      = useMyStaffRecord()
  const { success: ok, error: err } = useToast()
  const markCovered  = useMarkTopicCovered()
  const [showAddModal, setShowAddModal] = useState(false)

  const mySubjectIds = staffRecord?.subjects ?? []
  const myClassIds   = staffRecord?.classes  ?? []

  const [termFilter,    setTermFilter]    = useState('')
  const [classFilter,   setClassFilter]   = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')

  let filtered = data
  if (termFilter)    filtered = filtered.filter(t => String(t.term) === termFilter)
  if (classFilter)   filtered = filtered.filter(t => t.classId === classFilter)
  if (subjectFilter) filtered = filtered.filter(t => t.subjectId === subjectFilter)

  const covered = filtered.filter(t => t.coveredAt != null).length
  const pct     = filtered.length > 0 ? Math.round((covered / filtered.length) * 100) : 0

  const topicSubjectIds = new Set(data.map(t => t.subjectId))
  const topicClassIds   = new Set(data.map(t => t.classId))
  const mySubjects      = subjects.filter(s => topicSubjectIds.has(s.id))
  const myClasses       = classes.filter(c => topicClassIds.has(c.id))

  async function handleMark(topicId: string) {
    try { await markCovered.mutateAsync(topicId); ok('Topic marked as covered — DoS notified.') }
    catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Curriculum Plan</h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Plan and track topic coverage for your classes.</p>
            </div>
          </div>
          <button onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.4)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Topic
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        {[
          { label: 'Term', val: termFilter, set: setTermFilter, opts: [['','All Terms'],['1','Term 1'],['2','Term 2'],['3','Term 3']] as [string,string][] },
          { label: 'Subject', val: subjectFilter, set: setSubjectFilter, opts: [['','All Subjects'],...mySubjects.map(s => [s.id, s.name])] as [string,string][] },
          { label: 'Class', val: classFilter, set: setClassFilter, opts: [['','All Classes'],...myClasses.map(c => [c.id, c.name])] as [string,string][] },
        ].map(({ label, val, set, opts }) => (
          <div key={label} style={{ flex: '1 1 130px', minWidth: 120 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>{label}</div>
            <select value={val} onChange={e => set(e.target.value)} className="sui-input" style={{ width: '100%' }}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Coverage progress */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Curriculum Coverage</div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font3)', color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', letterSpacing: -.5 }}>{pct}%</div>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 99, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 8 }}>{covered} of {filtered.length} topics covered</div>
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[1,2,3,4].map(i => <div key={i} className="shule-skeleton" style={{ height: 52, borderRadius: 10 }} />)}</div>}

      {!isLoading && filtered.length === 0 && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(13,148,136,.08)', border: '.5px solid rgba(13,148,136,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>No topics found</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>No curriculum topics match the current filters.</div>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          <div className="hscroll">
            <table style={{ borderCollapse: 'collapse', minWidth: 700, width: '100%' }}>
              <thead>
                <tr>
                  {['#', 'Topic', 'Term', 'Planned Date', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', background: 'var(--surface2)', fontWeight: 700, fontSize: 10.5, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, borderBottom: '.5px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} style={{ borderBottom: '.5px solid var(--border)', background: t.coveredAt ? 'rgba(16,185,129,.02)' : 'transparent', transition: 'background .12s' }}>
                    <td style={{ padding: '11px 14px', fontSize: 11.5, fontFamily: 'var(--font3)', color: 'var(--txt3)', width: 40 }}>{t.sequenceOrder}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: t.coveredAt ? 'var(--txt3)' : 'var(--txt)', textDecoration: t.coveredAt ? 'line-through' : 'none', maxWidth: 300 }}>{t.topicName}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--txt2)', whiteSpace: 'nowrap' }}>Term {t.term}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)', whiteSpace: 'nowrap' }}>
                      {t.plannedDate ? new Date(t.plannedDate).toLocaleDateString('en-UG') : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {t.coveredAt ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.25)', whiteSpace: 'nowrap' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          {new Date(t.coveredAt).toLocaleDateString('en-UG')}
                        </span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'var(--surface2)', color: 'var(--txt3)', border: '.5px solid var(--border)' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {!t.coveredAt && (
                        <button disabled={markCovered.isPending} onClick={() => { void handleMark(t.id) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 9, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', boxShadow: '0 2px 8px rgba(13,148,136,.35)', whiteSpace: 'nowrap' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>
                          Mark Covered
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddTopicModal
          onClose={() => setShowAddModal(false)}
          mySubjectIds={mySubjectIds}
          myClassIds={myClassIds}
        />
      )}
    </div>
  )
}
