import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useDosTeacherPerformance, useAssignClassTeacher, useAssignTeacherSubjects, useAssignTeacherClasses } from '../../hooks/useDos'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../store/AuthContext'
import type { TeacherPerfRow } from '../../types/week9'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PALETTE = [
  ['#0d9488','rgba(13,148,136,.18)'],['#8b5cf6','rgba(139,92,246,.18)'],
  ['#0ea5e9','rgba(14,165,233,.18)'],['#f59e0b','rgba(245,158,11,.18)'],
  ['#f43f5e','rgba(244,63,94,.18)'], ['#10b981','rgba(16,185,129,.18)'],
] as const
function pal(s: string) { const i=((s.charCodeAt(0)||65)+(s.charCodeAt(1)||65))%PALETTE.length; return PALETTE[i] }
function ini(n: string) { return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() }

// ─── Rate bar ─────────────────────────────────────────────────────────────────
function RateBar({ value }: { value: number }) {
  const c = value>=70?'var(--success)':value>=50?'var(--warning)':'var(--danger)'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:80, height:6, borderRadius:3, background:'var(--surface2)', overflow:'hidden' }}>
        <div style={{ width:`${value}%`, height:'100%', borderRadius:3, background:c, transition:'width .4s' }}/>
      </div>
      <span style={{ fontSize:12, fontWeight:700, fontFamily:'var(--font3)', color:c }}>{value}%</span>
    </div>
  )
}

// ─── Modal shell (premium, centered, portal) ──────────────────────────────────
function Modal({ onClose, children, maxWidth=560 }: { onClose:()=>void; children:React.ReactNode; maxWidth?:number }) {
  const arEl = useMemo(()=>document.querySelector('.ar') as HTMLElement??document.body,[])
  useEffect(()=>{ document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow='' } },[])
  return createPortal(
    <div
      style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,.52)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'fadeUp .18s ease both' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}
    >
      <div style={{ width:'100%', maxWidth, maxHeight:'90dvh', borderRadius:24, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.24)', background:'var(--surface)', animation:'discCenterIn .26s cubic-bezier(.32,.72,0,1) both' }}>
        {children}
      </div>
    </div>,
    arEl
  )
}

// ─── Assign class teacher modal ───────────────────────────────────────────────
function AssignClassTeacherModal({ teacher, onClose }: { teacher: TeacherPerfRow; onClose:()=>void }) {
  const { data: allClasses=[] } = useClasses()
  const { data: allStreams=[] } = useStreams(null)
  const assignMut = useAssignClassTeacher()
  const { success: ok, error: err } = useToast()
  const [classId, setClassId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [done, setDone] = useState(false)

  const streamsForClass = classId
    ? allStreams.filter(s => s.classId===classId && (!s.classTeacherId || s.classTeacherId===teacher.staffId))
    : []

  async function confirm() {
    if (!streamId) return
    const stream = allStreams.find(s=>s.id===streamId)
    if (!stream) return
    try {
      await assignMut.mutateAsync({ streamId, classId: stream.classId, teacherId: teacher.staffId })
      ok(`${teacher.name} assigned as class teacher`)
      setDone(true)
    } catch(e:any){ err(e?.message??'Failed to assign') }
  }

  return (
    <Modal onClose={onClose} maxWidth={440}>
      {/* Header */}
      <div style={{ padding:'20px 24px 16px', background:'linear-gradient(135deg,rgba(13,148,136,.1),transparent)', borderBottom:'.5px solid var(--border)', flexShrink:0 }}>
        <div style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:17, color:'var(--txt)' }}>Assign as Class Teacher</div>
        <div style={{ fontSize:12, color:'var(--txt3)', marginTop:3 }}>Assigning <strong style={{color:'var(--txt)'}}>{teacher.name}</strong> to a class stream</div>
      </div>
      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
        {done ? (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:14, background:'rgba(16,185,129,.08)', border:'.5px solid rgba(16,185,129,.25)' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(16,185,129,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)' }}>{teacher.name} has been assigned.</div>
          </div>
        ) : (
          <>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:.6, display:'block', marginBottom:6 }}>Class</label>
              <select className="sui-input" value={classId} onChange={e=>{ setClassId(e.target.value); setStreamId('') }} style={{ width:'100%' }}>
                <option value="">Choose class…</option>
                {allClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {classId && (
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:.6, display:'block', marginBottom:6 }}>Stream</label>
                {streamsForClass.length===0
                  ? <div style={{ fontSize:12, color:'var(--txt3)', padding:'10px 14px', background:'var(--surface2)', borderRadius:10 }}>No available streams for this class.</div>
                  : <select className="sui-input" value={streamId} onChange={e=>setStreamId(e.target.value)} style={{ width:'100%' }}>
                      <option value="">Choose stream…</option>
                      {streamsForClass.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>}
              </div>
            )}
          </>
        )}
      </div>
      {/* Footer */}
      <div style={{ padding:'14px 24px 18px', borderTop:'.5px solid var(--border)', flexShrink:0, display:'flex', gap:10 }}>
        <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, background:'var(--surface2)', border:'.5px solid var(--border)', fontWeight:600, fontSize:13.5, cursor:'pointer', color:'var(--txt2)', transition:'background .13s' }}
          onMouseEnter={e=>(e.currentTarget.style.background='var(--border)')}
          onMouseLeave={e=>(e.currentTarget.style.background='var(--surface2)')}
        >{done?'Close':'Cancel'}</button>
        {!done && (
          <button onClick={()=>{void confirm()}} disabled={!streamId||assignMut.isPending}
            style={{ flex:2, height:44, borderRadius:12, background:streamId?'linear-gradient(145deg,var(--brand),var(--brand-dark))':'var(--border)', color:streamId?'#fff':'var(--txt3)', border:'none', fontWeight:800, fontSize:13.5, cursor:streamId?'pointer':'default', boxShadow:streamId?'0 4px 14px rgba(13,148,136,.38)':'none', transition:'all .18s' }}
          >{assignMut.isPending?'Assigning…':'Confirm Assignment'}</button>
        )}
      </div>
    </Modal>
  )
}

// ─── Manage subjects modal ────────────────────────────────────────────────────
function ManageSubjectsModal({ teacher, onClose }: { teacher: TeacherPerfRow; onClose:()=>void }) {
  const { data: allSubjects=[] } = useSubjects()
  const assignMut = useAssignTeacherSubjects()
  const { success: ok, error: err } = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set(teacher.subjectIds))

  function toggle(id: string) {
    setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  }

  async function save() {
    try {
      await assignMut.mutateAsync({ staffId: teacher.staffId, subjectIds: [...selected] })
      ok(`Subjects updated for ${teacher.name}`)
      onClose()
    } catch(e:any){ err(e?.message??'Failed to update') }
  }

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <div style={{ padding:'20px 24px 16px', background:'linear-gradient(135deg,rgba(139,92,246,.1),transparent)', borderBottom:'.5px solid var(--border)', flexShrink:0 }}>
        <div style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:17, color:'var(--txt)' }}>Manage Subjects</div>
        <div style={{ fontSize:12, color:'var(--txt3)', marginTop:3 }}>Select subjects assigned to <strong style={{color:'var(--txt)'}}>{teacher.name}</strong></div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:8 }}>
        {allSubjects.filter(s=>s.isActive).map(s => {
          const on = selected.has(s.id)
          return (
            <div key={s.id} onClick={()=>toggle(s.id)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, border:`.5px solid ${on?'rgba(139,92,246,.4)':'var(--border)'}`, background:on?'rgba(139,92,246,.06)':'var(--surface2)', cursor:'pointer', transition:'all .13s' }}
            >
              <div style={{ width:20, height:20, borderRadius:6, border:`.5px solid ${on?'#8b5cf6':'var(--border)'}`, background:on?'#8b5cf6':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .13s' }}>
                {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--txt)' }}>{s.name}</div>
                {s.curriculumCode && <div style={{ fontSize:11, color:'var(--txt3)', fontFamily:'var(--font3)' }}>{s.curriculumCode}</div>}
              </div>
              {s.level && (
                <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700, background:s.level==='A-Level'?'rgba(139,92,246,.1)':'rgba(14,165,233,.1)', color:s.level==='A-Level'?'#8b5cf6':'#0ea5e9' }}>{s.level}</span>
              )}
            </div>
          )
        })}
        {allSubjects.filter(s=>s.isActive).length===0 && (
          <div style={{ padding:24, textAlign:'center', color:'var(--txt3)', fontSize:13 }}>No active subjects found.</div>
        )}
      </div>
      <div style={{ padding:'14px 24px 18px', borderTop:'.5px solid var(--border)', flexShrink:0, display:'flex', gap:10, alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--txt3)', flex:1 }}>{selected.size} subject{selected.size!==1?'s':''} selected</span>
        <button onClick={onClose} style={{ height:44, padding:'0 18px', borderRadius:12, background:'var(--surface2)', border:'.5px solid var(--border)', fontWeight:600, fontSize:13.5, cursor:'pointer', color:'var(--txt2)' }}>Cancel</button>
        <button onClick={save} disabled={assignMut.isPending}
          style={{ height:44, padding:'0 24px', borderRadius:12, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', color:'#fff', border:'none', fontWeight:800, fontSize:13.5, cursor:'pointer', boxShadow:'0 4px 14px rgba(139,92,246,.38)', transition:'all .18s' }}
        >{assignMut.isPending?'Saving…':'Save Subjects'}</button>
      </div>
    </Modal>
  )
}

// ─── Manage classes modal ─────────────────────────────────────────────────────
function ManageClassesModal({ teacher, onClose }: { teacher: TeacherPerfRow; onClose:()=>void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: allClasses=[] } = useClasses()
  const assignMut = useAssignTeacherClasses()
  const { success: ok, error: err } = useToast()
  // Fetch actual staff.classes (not journal-derived) so we init with the real assignment
  const { data: staffRecord } = useQuery({
    queryKey: ['staff-classes-raw', teacher.staffId],
    enabled: !!user && !!teacher.staffId,
    queryFn: async () => {
      const { data } = await supabase.from('staff').select('classes').eq('id', teacher.staffId).eq('school_id', user!.schoolId).maybeSingle()
      return ((data as any)?.classes ?? []) as string[]
    },
    staleTime: 0,
  })
  const [selected, setSelected] = useState<Set<string>>(new Set(teacher.classes))
  // Sync from fetched raw data once loaded
  useEffect(() => {
    if (staffRecord) setSelected(new Set(staffRecord))
  }, [staffRecord])

  function toggle(id: string) {
    setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  }

  async function save() {
    try {
      await assignMut.mutateAsync({ staffId: teacher.staffId, classIds: [...selected] })
      // Invalidate the raw staff-classes cache so reopening the modal is fresh
      void qc.invalidateQueries({ queryKey: ['staff-classes-raw', teacher.staffId] })
      ok(`Teaching classes updated for ${teacher.name}`)
      onClose()
    } catch(e:any){ err(e?.message??'Failed to update') }
  }

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <div style={{ padding:'20px 24px 16px', background:'linear-gradient(135deg,rgba(14,165,233,.1),transparent)', borderBottom:'.5px solid var(--border)', flexShrink:0 }}>
        <div style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:17, color:'var(--txt)' }}>Manage Teaching Classes</div>
        <div style={{ fontSize:12, color:'var(--txt3)', marginTop:3 }}>Select classes <strong style={{color:'var(--txt)'}}>{teacher.name}</strong> teaches</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:8 }}>
        {allClasses.map(c => {
          const on = selected.has(c.id)
          return (
            <div key={c.id} onClick={()=>toggle(c.id)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, border:`.5px solid ${on?'rgba(14,165,233,.4)':'var(--border)'}`, background:on?'rgba(14,165,233,.06)':'var(--surface2)', cursor:'pointer', transition:'all .13s' }}
            >
              <div style={{ width:20, height:20, borderRadius:6, border:`.5px solid ${on?'#0ea5e9':'var(--border)'}`, background:on?'#0ea5e9':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .13s' }}>
                {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--txt)' }}>{c.name}</div>
                {c.level && <div style={{ fontSize:11, color:'var(--txt3)', marginTop:1 }}>Level {c.level}</div>}
              </div>
            </div>
          )
        })}
        {allClasses.length===0 && <div style={{ padding:24, textAlign:'center', color:'var(--txt3)', fontSize:13 }}>No classes found.</div>}
      </div>
      <div style={{ padding:'14px 24px 18px', borderTop:'.5px solid var(--border)', flexShrink:0, display:'flex', gap:10, alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--txt3)', flex:1 }}>{selected.size} class{selected.size!==1?'es':''} selected</span>
        <button onClick={onClose} style={{ height:44, padding:'0 18px', borderRadius:12, background:'var(--surface2)', border:'.5px solid var(--border)', fontWeight:600, fontSize:13.5, cursor:'pointer', color:'var(--txt2)' }}>Cancel</button>
        <button onClick={save} disabled={assignMut.isPending}
          style={{ height:44, padding:'0 24px', borderRadius:12, background:'linear-gradient(145deg,#0ea5e9,#0284c7)', color:'#fff', border:'none', fontWeight:800, fontSize:13.5, cursor:'pointer', boxShadow:'0 4px 14px rgba(14,165,233,.38)', transition:'all .18s' }}
        >{assignMut.isPending?'Saving…':'Save Classes'}</button>
      </div>
    </Modal>
  )
}

// ─── Teacher detail modal ──────────────────────────────────────────────────────
function TeacherDetailModal({ teacher, onClose }: { teacher: TeacherPerfRow; onClose:()=>void }) {
  const [tab, setTab] = useState<'performance'|'contact'|'subjects'|'classes'>('performance')
  const [showAssign,         setShowAssign]         = useState(false)
  const [showManageSubj,     setShowManageSubj]     = useState(false)
  const [showManageClasses,  setShowManageClasses]  = useState(false)
  // null = all years — resolves staff.classes[] which can reference a class
  // from any past year the teacher was assigned to.
  const { data: allClasses=[] } = useClasses(null)
  const classMap = Object.fromEntries(allClasses.map(c=>[c.id,c.name]))
  const { data: allSubjects=[] } = useSubjects()
  const subjectNameMap = Object.fromEntries(allSubjects.map(s=>[s.id,s.name]))
  const [col] = pal(teacher.name)

  return (
    <>
      <Modal onClose={onClose} maxWidth={560}>
        {/* Header */}
        <div style={{ padding:'22px 24px 0', flexShrink:0, background:`linear-gradient(135deg,${col}10,transparent)` }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:20 }}>
            <div style={{ width:52, height:52, borderRadius:16, background:`linear-gradient(135deg,${col}cc,${col}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', fontFamily:'var(--font2)', flexShrink:0, boxShadow:`0 4px 16px ${col}40` }}>
              {ini(teacher.name)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:18, color:'var(--txt)', letterSpacing:-.3 }}>{teacher.name}</div>
              <div style={{ fontSize:12, color:'var(--txt3)', marginTop:3 }}>
                {teacher.assessmentsThisTerm} assessments · {teacher.subjectIds.length} subject{teacher.subjectIds.length!==1?'s':''}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setShowAssign(true)}
                style={{ padding:'7px 14px', background:'linear-gradient(145deg,var(--brand),var(--brand-dark))', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:11.5, cursor:'pointer', boxShadow:'0 3px 10px rgba(13,148,136,.35)', whiteSpace:'nowrap' }}
              >{teacher.isClassTeacher ? 'Change Class' : 'Assign Class'}</button>
              <button onClick={onClose}
                style={{ width:32, height:32, border:'none', background:'var(--surface2)', borderRadius:9, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt3)', flexShrink:0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:0, borderBottom:'.5px solid var(--border)', overflowX:'auto' }}>
            {(['performance','contact','subjects','classes'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{ padding:'9px 18px', border:'none', background:'none', cursor:'pointer', fontWeight:700, fontSize:12.5, color:tab===t?'var(--brand)':'var(--txt3)', borderBottom:tab===t?'2px solid var(--brand)':'2px solid transparent', marginBottom:-1, transition:'all .14s', textTransform:'capitalize' }}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Performance tab */}
          {tab==='performance' && (
            <>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {[
                  { label:'Pass Rate', node:<RateBar value={teacher.passRate}/> },
                  { label:'Curriculum Coverage', node:<RateBar value={teacher.curriculumCoverage}/> },
                  { label:'Assessments This Term', node:<div style={{ fontSize:28, fontWeight:900, fontFamily:'var(--font2)', color:'var(--txt)', lineHeight:1 }}>{teacher.assessmentsThisTerm}</div> },
                ].map(({ label, node }) => (
                  <div key={label} style={{ flex:'1 1 140px', background:'var(--surface2)', borderRadius:14, padding:'14px 16px', border:'.5px solid var(--border)' }}>
                    <div style={{ fontSize:10.5, color:'var(--txt3)', fontWeight:800, textTransform:'uppercase', letterSpacing:.8, marginBottom:10 }}>{label}</div>
                    {node}
                  </div>
                ))}
              </div>
              <div style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px', border:'.5px solid var(--border)' }}>
                <div style={{ fontSize:10.5, color:'var(--txt3)', fontWeight:800, textTransform:'uppercase', letterSpacing:.8, marginBottom:10 }}>Classes Assigned</div>
                {teacher.classes.length>0 ? (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {teacher.classes.map((cId,i)=>(
                      <span key={i} style={{ padding:'3px 10px', borderRadius:99, fontSize:11.5, fontWeight:700, background:'rgba(13,148,136,.08)', color:'var(--brand)', border:'.5px solid rgba(13,148,136,.2)' }}>
                        {classMap[cId]??cId.slice(0,8)}
                      </span>
                    ))}
                  </div>
                ) : <span style={{ fontSize:13, color:'var(--txt3)' }}>No classes assigned yet</span>}
              </div>
            </>
          )}

          {/* Contact tab */}
          {tab==='contact' && (
            <>
              {[
                { label:'Staff Number', value: teacher.staffNumber, icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
                { label:'Phone',        value: teacher.phone,       icon:'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .82h3a2 2 0 012 1.72c.13.96.4 1.9.71 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.31 1.85.58 2.81.71A2 2 0 0122 16.92z' },
                { label:'Email',        value: teacher.email,       icon:'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px', border:'.5px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:11, background:`${col}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round"><path d={icon}/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:10.5, color:'var(--txt3)', fontWeight:800, textTransform:'uppercase', letterSpacing:.8, marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:value?'var(--txt)':'var(--txt3)' }}>{value??'—'}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Subjects tab */}
          {tab==='subjects' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)' }}>
                  {teacher.subjectIds.length} subject{teacher.subjectIds.length!==1?'s':''} assigned
                </div>
                <button onClick={()=>setShowManageSubj(true)}
                  style={{ padding:'6px 14px', border:'none', borderRadius:9, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', boxShadow:'0 3px 10px rgba(139,92,246,.35)' }}
                >Manage Subjects</button>
              </div>
              {teacher.subjectIds.length>0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {teacher.subjectIds.map(id=>{
                    const name = subjectNameMap[id]??id
                    return (
                      <div key={id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background:'var(--surface2)', border:'.5px solid var(--border)' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:'#8b5cf6', flexShrink:0 }}/>
                        <span style={{ fontSize:13.5, fontWeight:700, color:'var(--txt)' }}>{name}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding:'32px 24px', textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--txt)', marginBottom:6, fontFamily:'var(--font2)' }}>No subjects assigned</div>
                  <div style={{ fontSize:13, color:'var(--txt3)', marginBottom:14 }}>Assign subjects so this teacher can appear in the timetable builder.</div>
                  <button onClick={()=>setShowManageSubj(true)}
                    style={{ padding:'8px 20px', border:'none', borderRadius:10, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 3px 12px rgba(139,92,246,.4)' }}
                  >Assign Subjects Now</button>
                </div>
              )}
            </>
          )}

          {/* Classes tab */}
          {tab==='classes' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)' }}>
                  {teacher.classes.length} teaching class{teacher.classes.length!==1?'es':''}
                </div>
                <button onClick={()=>setShowManageClasses(true)}
                  style={{ padding:'6px 14px', border:'none', borderRadius:9, background:'linear-gradient(145deg,#0ea5e9,#0284c7)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', boxShadow:'0 3px 10px rgba(14,165,233,.35)' }}
                >Manage Classes</button>
              </div>
              {teacher.classes.length>0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {teacher.classes.map(id=>{
                    const name = classMap[id]??id
                    return (
                      <div key={id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background:'var(--surface2)', border:'.5px solid var(--border)' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:'#0ea5e9', flexShrink:0 }}/>
                        <span style={{ fontSize:13.5, fontWeight:700, color:'var(--txt)' }}>{name}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding:'32px 24px', textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--txt)', marginBottom:6, fontFamily:'var(--font2)' }}>No teaching classes assigned</div>
                  <div style={{ fontSize:13, color:'var(--txt3)', marginBottom:14 }}>Assign classes so the teacher can plan their curriculum and appear in the timetable builder.</div>
                  <button onClick={()=>setShowManageClasses(true)}
                    style={{ padding:'8px 20px', border:'none', borderRadius:10, background:'linear-gradient(145deg,#0ea5e9,#0284c7)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', boxShadow:'0 3px 12px rgba(14,165,233,.4)' }}
                  >Assign Classes Now</button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {showAssign        && <AssignClassTeacherModal teacher={teacher} onClose={()=>setShowAssign(false)}/>}
      {showManageSubj    && <ManageSubjectsModal    teacher={teacher} onClose={()=>setShowManageSubj(false)}/>}
      {showManageClasses && <ManageClassesModal     teacher={teacher} onClose={()=>setShowManageClasses(false)}/>}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
// ── Teacher performance card ──────────────────────────────────────────────────
function TeacherCard({ t, onManage }: { t: TeacherPerfRow; onManage: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [c1] = pal(t.name)
  const C_TEACHER = '#6366f1'
  const C_CLASS   = '#10b981'
  const accentC   = t.isClassTeacher ? C_CLASS : C_TEACHER

  return (
    <div
      style={{
        borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)',
        overflow: 'hidden',
        transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,.10)' : '0 1px 6px rgba(0,0,0,.05)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accentC}, ${c1})` }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: `linear-gradient(135deg, ${accentC}, ${c1})`, padding: 2.5 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: accentC, fontFamily: 'var(--font2)' }}>{ini(t.name)}</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{t.name}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4, color: accentC, background: `${accentC}18`, padding: '2px 8px', borderRadius: 99 }}>
                {t.isClassTeacher ? 'Class Teacher' : 'Teacher'}
              </span>
              {t.phone && <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{t.phone}</span>}
            </div>
          </div>
        </div>

        {/* Subject chips */}
        {t.subjectNames && t.subjectNames.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
            {t.subjectNames.slice(0, 3).map(s => (
              <span key={s} style={{ fontSize: 10.5, color: 'var(--txt2)', background: 'var(--surface2)', border: '.5px solid var(--border)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{s}</span>
            ))}
            {t.subjectNames.length > 3 && (
              <span style={{ fontSize: 10.5, color: 'var(--txt3)', background: 'var(--surface2)', border: '.5px solid var(--border)', padding: '2px 8px', borderRadius: 6 }}>+{t.subjectNames.length - 3}</span>
            )}
          </div>
        )}

        {/* Performance bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', width: 68, textTransform: 'uppercase', letterSpacing: .4 }}>Pass Rate</span>
            <div style={{ flex: 1 }}><RateBar value={t.passRate} /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', width: 68, textTransform: 'uppercase', letterSpacing: .4 }}>Coverage</span>
            <div style={{ flex: 1 }}><RateBar value={t.curriculumCoverage} /></div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '.5px solid var(--border)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>
            {t.assessmentsThisTerm} assessment{t.assessmentsThisTerm !== 1 ? 's' : ''} this term
          </span>
          <button
            onClick={onManage}
            style={{ padding: '6px 14px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${accentC}, ${c1})`, color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
          >
            Manage
          </button>
        </div>
      </div>
    </div>
  )
}

export function DosTeachersPage() {
  const { data=[], isLoading, isError } = useDosTeacherPerformance()
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState<'passRate'|'coverage'|'name'>('passRate')
  const [selected, setSelected] = useState<TeacherPerfRow|null>(null)

  const rows = useMemo(() => {
    let r = data
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(t => t.name.toLowerCase().includes(q))
    }
    return [...r].sort((a, b) => {
      if (sort === 'passRate')  return b.passRate - a.passRate
      if (sort === 'coverage') return b.curriculumCoverage - a.curriculumCoverage
      return a.name.localeCompare(b.name)
    })
  }, [data, search, sort])

  const teacherCount     = rows.length
  const avgPassRate      = rows.length ? Math.round(rows.reduce((s, t) => s + t.passRate, 0) / rows.length) : 0
  const avgCoverage      = rows.length ? Math.round(rows.reduce((s, t) => s + t.curriculumCoverage, 0) / rows.length) : 0
  const classTeachers    = rows.filter(t => t.isClassTeacher).length

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero band */}
      <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', padding: '28px 28px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, left: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -.4 }}>Teachers</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, margin: '0 0 20px' }}>Pass rates, curriculum coverage and subject assignments</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Teachers',  value: isLoading ? '—' : teacherCount },
              { label: 'Class Teachers',  value: isLoading ? '—' : classTeachers },
              { label: 'Avg Pass Rate',   value: isLoading ? '—' : `${avgPassRate}%` },
              { label: 'Avg Coverage',    value: isLoading ? '—' : `${avgCoverage}%` },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.25)', borderRadius: 12, padding: '10px 16px', minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.7)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="sui-input" placeholder="Search teacher…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
        </div>
        <select className="sui-input" value={sort} onChange={e => setSort(e.target.value as typeof sort)} style={{ minWidth: 200 }}>
          <option value="passRate">Sort by Pass Rate</option>
          <option value="coverage">Sort by Coverage</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
              <span className="shule-skeleton" style={{ display: 'block', height: 4 }} />
              <div style={{ padding: '16px 16px 14px' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <span className="shule-skeleton" style={{ display: 'block', width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span className="shule-skeleton" style={{ display: 'block', height: 13, width: '70%', borderRadius: 6, marginBottom: 8 }} />
                    <span className="shule-skeleton" style={{ display: 'block', height: 18, width: '45%', borderRadius: 99 }} />
                  </div>
                </div>
                <span className="shule-skeleton" style={{ display: 'block', height: 8, width: '100%', borderRadius: 4, marginBottom: 8 }} />
                <span className="shule-skeleton" style={{ display: 'block', height: 8, width: '80%', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--danger)', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14 }}>Failed to load teacher data.</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', textAlign: 'center' }}>
            {search ? 'No teachers match your search' : 'No teacher data yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center' }}>Teachers appear here once they have been assigned subjects.</div>
        </div>
      ) : (
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {rows.map(t => (
            <TeacherCard key={t.staffId} t={t} onManage={() => setSelected(t)} />
          ))}
        </div>
      )}

      {selected && <TeacherDetailModal teacher={data.find(t => t.staffId === selected.staffId) ?? selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
