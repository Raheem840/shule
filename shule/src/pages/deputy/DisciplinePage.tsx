import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useDisciplineRecords, useAddDisciplineRecord,
  useUpdateDisciplineRecord, useDeleteDisciplineRecord,
} from '../../hooks/useDeputy'
import { useStudents } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { DisciplineRecord, DisciplineNature } from '../../types/week9'

const NATURES: DisciplineNature[] = ['lateness','absenteeism','misconduct','violence','other']

const NATURE_META: Record<DisciplineNature,{label:string;color:string;bg:string;icon:string}> = {
  lateness:    { label:'Lateness',    color:'#f59e0b', bg:'rgba(245,158,11,.1)',   icon:'M12 6v6l4 2M12 22a10 10 0 100-20 10 10 0 000 20z' },
  absenteeism: { label:'Absenteeism', color:'#0ea5e9', bg:'rgba(14,165,233,.1)',   icon:'M12 22a10 10 0 100-20 10 10 0 000 20zM12 8v4M12 16h.01' },
  misconduct:  { label:'Misconduct',  color:'#f43f5e', bg:'rgba(244,63,94,.1)',    icon:'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
  violence:    { label:'Violence',    color:'#ef4444', bg:'rgba(239,68,68,.1)',    icon:'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
  other:       { label:'Other',       color:'#94a3b8', bg:'rgba(148,163,184,.1)', icon:'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
}

// ─── Nature badge ────────────────────────────────────────────────────────────────
function NatureBadge({ nature }: { nature: DisciplineNature }) {
  const m = NATURE_META[nature]
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:99, fontSize:10.5, fontWeight:700, background:m.bg, color:m.color, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  )
}

// ─── Student typeahead ────────────────────────────────────────────────────────────
function StudentTypeahead({ value, onChange }: {
  value: { id:string; name:string } | null
  onChange: (s:{ id:string; name:string; classId:string|null }|null)=>void
}) {
  const { data: allStudents=[] } = useStudents()
  const [query, setQuery] = useState(value?.name ?? '')
  const [open,  setOpen]  = useState(false)

  const matches = useMemo(()=>{
    if(!query.trim()) return []
    const q = query.toLowerCase()
    return allStudents.filter(s=>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)||
      s.admissionNumber.toLowerCase().includes(q)
    ).slice(0,8)
  },[allStudents,query])

  function select(s: typeof allStudents[number]) {
    onChange({ id:s.id, name:`${s.firstName} ${s.lastName}`, classId:s.classId??null })
    setQuery(`${s.firstName} ${s.lastName}`)
    setOpen(false)
  }

  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', opacity:.45 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <input className="sui-input" value={query}
          onChange={e=>{ setQuery(e.target.value); setOpen(true); if(!e.target.value.trim()) onChange(null) }}
          onFocus={()=>query.trim()&&setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),150)}
          placeholder="Search by name or admission number…"
          style={{ width:'100%', paddingLeft:36 }}
          autoComplete="off"
        />
      </div>
      {open && matches.length>0 && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:400, background:'var(--surface)', border:'.5px solid var(--border)', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,.14)', overflow:'hidden' }}>
          {matches.map(s=>(
            <div key={s.id} onMouseDown={()=>select(s)} style={{ padding:'10px 14px', cursor:'pointer', display:'flex', gap:10, alignItems:'center', borderBottom:'.5px solid var(--border)' }}
              className="sui-tr">
              <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(145deg,var(--brand),var(--brand-dark))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'#fff', flexShrink:0 }}>
                {`${s.firstName[0]}${s.lastName[0]}`.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'var(--txt)' }}>{s.firstName} {s.lastName}</div>
                <div style={{ fontSize:11, color:'var(--txt3)', fontFamily:'var(--font3)' }}>{s.admissionNumber}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Field label ─────────────────────────────────────────────────────────────────
const Lbl = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ fontSize:11.5, fontWeight:700, color:'var(--txt3)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:.6 }}>
    {children}{required && <span style={{ color:'var(--danger)', marginLeft:2 }}>*</span>}
  </label>
)

// ─── Record modal ─────────────────────────────────────────────────────────────────
function RecordModal({ initial, onClose }: { initial: DisciplineRecord|null; onClose:()=>void }) {
  const addMut    = useAddDisciplineRecord()
  const updateMut = useUpdateDisciplineRecord()
  const isEdit    = !!initial
  const isMobile  = useIsMobile()
  const { data: classes=[] } = useClasses()
  const arEl = useMemo(()=>document.querySelector('.ar') as HTMLElement ?? document.body, [])

  const [student,      setStudent]      = useState<{id:string;name:string;classId:string|null}|null>(
    initial ? { id:initial.studentId, name:initial.studentName??initial.studentId, classId:initial.classId??null } : null
  )
  const [classId,      setClassId]      = useState(initial?.classId??'')
  const [incidentDate, setIncidentDate] = useState(initial?.incidentDate??new Date().toISOString().slice(0,10))
  const [nature,       setNature]       = useState<DisciplineNature>(initial?.nature??'misconduct')
  const [resolution,   setResolution]   = useState(initial?.resolution??'')
  const [notes,        setNotes]        = useState(initial?.notes??'')
  const [err,          setErr]          = useState('')

  // Trap body scroll while modal is open
  useEffect(()=>{ document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow='' } },[])

  const isPending = addMut.isPending || updateMut.isPending
  const m = NATURE_META[nature]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if(!student||!resolution.trim()){ setErr('Please select a student and enter a resolution.'); return }
    setErr('')
    try {
      if(isEdit) {
        await updateMut.mutateAsync({ id:initial!.id, incidentDate, nature, resolution, notes:notes||null })
      } else {
        await addMut.mutateAsync({ studentId:student.id, classId:classId||student.classId, incidentDate, nature, resolution, notes:notes||null })
      }
      onClose()
    } catch(ex:any){ setErr(ex.message??'Failed to save') }
  }

  const modal = (
    /* ── Scrim ── */
    <div
      style={{
        position:'fixed', inset:0, zIndex:500,
        background:'rgba(0,0,0,.55)',
        backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
        display:'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent:'center',
        padding: isMobile ? 0 : 20,
        animation:'discModalIn .22s ease both',
      }}
      onClick={e=>e.target===e.currentTarget&&onClose()}
    >
      <style>{`
        @keyframes discModalIn{from{opacity:0}to{opacity:1}}
        @keyframes discSheetUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
        @keyframes discCenterIn{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}
      `}</style>

      {/* ── Card shell — overflow:hidden clips all children at border-radius ── */}
      <div style={{
        width:'100%', maxWidth:560,
        maxHeight: isMobile ? '94dvh' : '90dvh',
        borderRadius: isMobile ? '28px 28px 0 0' : 24,
        overflow:'hidden',
        display:'flex', flexDirection:'column',
        boxShadow: isMobile
          ? `0 -16px 64px rgba(0,0,0,.28), 0 -2px 0 ${m.color}20`
          : `0 28px 80px rgba(0,0,0,.28), 0 0 0 .5px ${m.color}18`,
        background:'var(--surface)',
        animation: isMobile ? 'discSheetUp .3s cubic-bezier(.32,.72,0,1) both' : 'discCenterIn .28s cubic-bezier(.32,.72,0,1) both',
      }}>

        {/* ── Gradient accent header ── */}
        <div style={{
          padding: isMobile ? '10px 22px 18px' : '22px 24px 18px',
          background:`linear-gradient(150deg,${m.color}18 0%,${m.color}08 60%,transparent 100%)`,
          borderBottom:`.5px solid ${m.color}1e`,
          flexShrink:0, position:'relative', overflow:'hidden',
        }}>
          {/* Ambient glow */}
          <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', filter:'blur(50px)', background:`${m.color}28`, pointerEvents:'none' }}/>

          {/* Handle bar — mobile only */}
          {isMobile && (
            <div style={{ width:40, height:4, borderRadius:2, background:`${m.color}40`, margin:'0 auto 16px', position:'relative', zIndex:1 }}/>
          )}

          {/* Header row */}
          <div style={{ display:'flex', alignItems:'center', gap:14, position:'relative', zIndex:1 }}>
            <div style={{
              width:50, height:50, borderRadius:17, flexShrink:0,
              background:`linear-gradient(145deg,${m.color},${m.color}bb)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:`0 6px 24px ${m.color}4a`,
            }}>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1"><path d={m.icon}/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:19, color:'var(--txt)', letterSpacing:-.4, lineHeight:1.1 }}>
                {isEdit ? 'Edit Record' : 'Log Incident'}
              </div>
              <div style={{ fontSize:12, color:'var(--txt3)', marginTop:3 }}>
                {isEdit ? `Editing ${initial?.studentName ?? 'record'}` : 'Complete the incident report below'}
              </div>
            </div>
            <button
              type="button" onClick={onClose}
              style={{ width:34, height:34, borderRadius:11, border:'none', background:`${m.color}14`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:m.color, flexShrink:0, transition:'background .13s' }}
              onMouseEnter={e=>(e.currentTarget.style.background=`${m.color}26`)}
              onMouseLeave={e=>(e.currentTarget.style.background=`${m.color}14`)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable body — safe from overflow clipping since outer card clips ── */}
        <form
          id="disc-record-form"
          onSubmit={e=>{void submit(e)}}
          style={{
            flex:1, overflowY:'auto', padding:'20px 24px',
            display:'flex', flexDirection:'column', gap:18,
            WebkitOverflowScrolling:'touch',
          }}
        >
          {/* Student */}
          <div>
            <Lbl required>Student</Lbl>
            {isEdit ? (
              <div className="sui-input" style={{ color:'var(--txt2)', cursor:'default', opacity:.75 }}>{initial?.studentName??initial?.studentId}</div>
            ) : (
              <StudentTypeahead value={student} onChange={s=>{ setStudent(s); if(s?.classId) setClassId(s.classId) }}/>
            )}
          </div>

          {/* Nature pills */}
          <div>
            <Lbl required>Nature of Incident</Lbl>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
              {NATURES.map(n=>{
                const nm=NATURE_META[n], active=nature===n
                return (
                  <button key={n} type="button" onClick={()=>setNature(n)} style={{
                    padding:'7px 14px', borderRadius:99,
                    border:`.5px solid ${active?nm.color:'var(--border)'}`,
                    background: active ? nm.bg : 'var(--surface2)',
                    color: active ? nm.color : 'var(--txt3)',
                    fontSize:13, fontWeight: active ? 800 : 600,
                    cursor:'pointer', transition:'all .15s cubic-bezier(.34,1.56,.64,1)',
                    transform: active ? 'scale(1.03)' : 'scale(1)',
                    WebkitTapHighlightColor:'transparent',
                  }}>
                    {nm.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date + class */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <Lbl required>Incident Date</Lbl>
              <input type="date" className="sui-input" value={incidentDate} onChange={e=>setIncidentDate(e.target.value)} style={{ width:'100%' }}/>
            </div>
            {!isEdit && (
              <div>
                <Lbl>Class</Lbl>
                <select className="sui-input" value={classId} onChange={e=>setClassId(e.target.value)} style={{ width:'100%' }}>
                  <option value="">Auto from student</option>
                  {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Resolution */}
          <div>
            <Lbl required>Resolution / Action Taken</Lbl>
            <textarea
              className="sui-input"
              value={resolution} onChange={e=>setResolution(e.target.value)}
              rows={3}
              placeholder="E.g. Parent notified, detention issued, counselling referral…"
              style={{ width:'100%', resize:'vertical', minHeight:80 }}
            />
          </div>

          {/* Notes */}
          <div>
            <Lbl>Additional Notes</Lbl>
            <textarea
              className="sui-input"
              value={notes} onChange={e=>setNotes(e.target.value)}
              rows={2}
              placeholder="Optional context or follow-up notes…"
              style={{ width:'100%', resize:'vertical' }}
            />
          </div>
        </form>

        {/* ── Fixed footer ── */}
        <div style={{
          padding:`14px 24px calc(14px + env(safe-area-inset-bottom, 0px))`,
          borderTop:'.5px solid var(--border)',
          background:'var(--surface)',
          flexShrink:0, display:'flex', flexDirection:'column', gap:10,
        }}>
          {err && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:11, background:'rgba(244,63,94,.07)', border:'.5px solid rgba(244,63,94,.2)', color:'var(--danger)', fontSize:12.5, fontWeight:600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {err}
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <button
              type="button" form="disc-record-form" onClick={onClose}
              style={{ flex:1, padding:'11px 0', background:'var(--surface2)', color:'var(--txt2)', border:'.5px solid var(--border)', borderRadius:13, fontWeight:600, fontSize:14, cursor:'pointer', transition:'background .13s' }}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--border)')}
              onMouseLeave={e=>(e.currentTarget.style.background='var(--surface2)')}
            >
              Cancel
            </button>
            <button
              type="submit" form="disc-record-form"
              onClick={e=>{void submit(e as any)}}
              disabled={isPending}
              style={{
                flex:2, padding:'11px 0',
                background:isPending?'var(--border)':`linear-gradient(145deg,${m.color},${m.color}cc)`,
                color:'#fff', border:'none', borderRadius:13, fontWeight:800, fontSize:14,
                cursor:isPending?'default':'pointer', transition:'all .18s',
                boxShadow:isPending?'none':`0 4px 18px ${m.color}42`,
              }}
            >
              {isPending ? 'Saving…' : isEdit ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, arEl)
}

// ─── Delete modal ─────────────────────────────────────────────────────────────────
function DeleteModal({ record, onClose }: { record:DisciplineRecord; onClose:()=>void }) {
  const deleteMut = useDeleteDisciplineRecord()
  const isMobile  = useIsMobile()
  const arEl = useMemo(()=>document.querySelector('.ar') as HTMLElement ?? document.body, [])
  const [err, setErr] = useState('')

  useEffect(()=>{ document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow='' } },[])

  async function confirm() {
    try { await deleteMut.mutateAsync(record.id); onClose() }
    catch(ex:any){ setErr(ex.message??'Failed to delete') }
  }

  return createPortal(
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center', zIndex:500, padding: isMobile ? 0 : 20 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}
    >
      <div style={{
        width:'100%', maxWidth:440,
        borderRadius: isMobile ? '28px 28px 0 0' : 22,
        overflow:'hidden',
        boxShadow: isMobile ? '0 -12px 56px rgba(0,0,0,.26)' : '0 24px 72px rgba(0,0,0,.26)',
        background:'var(--surface)',
        animation: isMobile ? 'discSheetUp .3s cubic-bezier(.32,.72,0,1) both' : 'discCenterIn .28s cubic-bezier(.32,.72,0,1) both',
      }}>
        {/* Header */}
        <div style={{ padding: isMobile ? '12px 22px 18px' : '24px 24px 18px', background:'linear-gradient(150deg,rgba(244,63,94,.1) 0%,rgba(244,63,94,.04) 100%)', borderBottom:'.5px solid rgba(244,63,94,.15)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', filter:'blur(40px)', background:'rgba(244,63,94,.2)', pointerEvents:'none' }}/>
          {isMobile && <div style={{ width:40, height:4, borderRadius:2, background:'rgba(244,63,94,.3)', margin:'0 auto 16px', position:'relative', zIndex:1 }}/>}
          <div style={{ display:'flex', alignItems:'center', gap:13, position:'relative', zIndex:1 }}>
            <div style={{ width:50, height:50, borderRadius:17, background:'linear-gradient(145deg,#f43f5e,#e11d48)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 24px rgba(244,63,94,.44)', flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </div>
            <div>
              <div style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:18, color:'var(--txt)', letterSpacing:-.3 }}>Delete Record?</div>
              <div style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>This cannot be undone</div>
            </div>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding:'20px 24px' }}>
          <p style={{ fontSize:14, color:'var(--txt2)', lineHeight:1.65, margin:0 }}>
            Permanently delete the discipline record for{' '}
            <strong style={{ color:'var(--txt)', fontWeight:800 }}>{record.studentName??record.studentId}</strong>{' '}
            logged on {new Date(record.incidentDate).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}.
          </p>
          {err && <div style={{ color:'var(--danger)', fontSize:12, marginTop:12, padding:'8px 12px', background:'rgba(244,63,94,.07)', borderRadius:8, border:'.5px solid rgba(244,63,94,.2)' }}>{err}</div>}
        </div>
        {/* Footer */}
        <div style={{ padding:`0 24px calc(18px + env(safe-area-inset-bottom, 0px))`, display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px 0', background:'var(--surface2)', border:'.5px solid var(--border)', borderRadius:13, fontWeight:600, fontSize:14, cursor:'pointer', color:'var(--txt2)', transition:'background .13s' }}
            onMouseEnter={e=>(e.currentTarget.style.background='var(--border)')}
            onMouseLeave={e=>(e.currentTarget.style.background='var(--surface2)')}>
            Cancel
          </button>
          <button disabled={deleteMut.isPending} onClick={()=>{void confirm()}} style={{ flex:1.4, padding:'12px 0', background:'linear-gradient(145deg,#f43f5e,#e11d48)', color:'#fff', border:'none', borderRadius:13, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 4px 18px rgba(244,63,94,.42)', transition:'opacity .13s', opacity:deleteMut.isPending?.6:1 }}>
            {deleteMut.isPending ? 'Deleting…' : 'Delete Record'}
          </button>
        </div>
      </div>
    </div>,
    arEl
  )
}

// ─── Mobile discipline card ───────────────────────────────────────────────────────
function DisciplineCard({ record, onEdit, onDelete }: { record:DisciplineRecord; onEdit:()=>void; onDelete:()=>void }) {
  const m = NATURE_META[record.nature]
  return (
    <div style={{ background:'var(--surface)', borderRadius:16, border:'.5px solid var(--border)', overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,.06)', borderLeft:`3px solid ${m.color}` }}>
      <div style={{ padding:'13px 15px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:m.bg, border:`.5px solid ${m.color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.2"><path d={m.icon}/></svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14.5, color:'var(--txt)', letterSpacing:-.2, marginBottom:2 }}>{record.studentName??'—'}</div>
            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
              <NatureBadge nature={record.nature}/>
              <span style={{ fontSize:11.5, color:'var(--txt3)' }}>{new Date(record.incidentDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}</span>
              {record.className && <span style={{ fontSize:11.5, color:'var(--txt3)' }}>· {record.className}</span>}
            </div>
          </div>
        </div>
        <div style={{ fontSize:13, color:'var(--txt2)', lineHeight:1.5, marginBottom:10, paddingLeft:46 }}>{record.resolution}</div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onEdit} style={{ padding:'6px 16px', borderRadius:10, border:'.5px solid var(--border)', background:'var(--surface2)', color:'var(--txt2)', fontSize:12.5, fontWeight:600, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>Edit</button>
          <button onClick={onDelete} style={{ padding:'6px 16px', borderRadius:10, border:'.5px solid rgba(244,63,94,.3)', background:'rgba(244,63,94,.06)', color:'var(--danger)', fontSize:12.5, fontWeight:600, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════
// DISCIPLINE PAGE
// ═══════════════════════════════════════════════════════════════════════════════════
export function DisciplinePage() {
  const isMobile = useIsMobile()
  const [classFilter,  setClassFilter]  = useState('')
  const [search,       setSearch]       = useState('')
  const [natureFilter, setNature]       = useState<DisciplineNature|''>('')
  const [modal,        setModal]        = useState<'add'|'edit'|'delete'|null>(null)
  const [selected,     setSelected]     = useState<DisciplineRecord|null>(null)

  const { data: records=[], isLoading } = useDisciplineRecords({ classId:classFilter||undefined })
  const { data: classes=[] } = useClasses()

  const filtered = useMemo(()=>{
    let r = records
    if(natureFilter) r = r.filter(x=>x.nature===natureFilter)
    if(search.trim()){
      const q = search.toLowerCase()
      r = r.filter(x=>(x.studentName??x.studentId).toLowerCase().includes(q)||x.resolution.toLowerCase().includes(q))
    }
    return r
  },[records,natureFilter,search])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({ count:filtered.length, getScrollElement:()=>parentRef.current, estimateSize:()=>60, overscan:5 })

  function openEdit(r:DisciplineRecord){ setSelected(r); setModal('edit') }
  function openDelete(r:DisciplineRecord){ setSelected(r); setModal('delete') }
  function closeModal(){ setModal(null); setSelected(null) }

  function exportCsv(){
    const rows = filtered.map(r=>`"${r.incidentDate}","${r.nature}","${r.studentName??r.studentId}","${r.className??''}","${r.resolution}"`).join('\n')
    const blob = new Blob(['Date,Nature,Student,Class,Resolution\n'+rows],{type:'text/csv'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='discipline-records.csv'; a.click()
  }

  // Nature counts for pill filter
  const natureCounts = useMemo(()=>{
    const m = new Map<string,number>()
    records.forEach(r=>m.set(r.nature,(m.get(r.nature)??0)+1))
    return m
  },[records])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(145deg,#f59e0b,#d97706)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(245,158,11,.36)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
            <h1 style={{ fontSize:isMobile?17:20, fontWeight:900, fontFamily:'var(--font2)', color:'var(--txt)', margin:0, letterSpacing:-.3 }}>Discipline Records</h1>
          </div>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:0 }}>{filtered.length} record{filtered.length!==1?'s':''} · {records.length} total</p>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {!isMobile && <button onClick={exportCsv} style={{ padding:'8px 16px', borderRadius:10, border:'.5px solid var(--border)', background:'var(--surface)', color:'var(--txt2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>Export CSV</button>}
          <button onClick={()=>setModal('add')} style={{ padding:'9px 18px', background:'linear-gradient(145deg,var(--brand),var(--brand-dark))', color:'#fff', border:'none', borderRadius:11, fontWeight:700, fontSize:13.5, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(13,148,136,.4)', WebkitTapHighlightColor:'transparent' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Record
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ position:'relative' }}>
          <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', opacity:.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search student or resolution…" value={search} onChange={e=>setSearch(e.target.value)} className="sui-input" style={{ paddingLeft:36, width:'100%' }}/>
        </div>
        {/* Nature pill filters */}
        <div style={{ display:'flex', gap:7, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
          {(['',  ...NATURES] as const).map(n=>{
            const active = natureFilter===n
            const m      = n ? NATURE_META[n] : null
            const count  = n ? (natureCounts.get(n)??0) : records.length
            return (
              <button key={n||'all'} onClick={()=>setNature(n as DisciplineNature|'')} style={{
                flexShrink:0, padding:'6px 13px', borderRadius:99,
                border:`.5px solid ${active?(m?.color??'var(--brand)'):'var(--border)'}`,
                background: active ? (m?m.bg:'rgba(13,148,136,.1)') : 'var(--surface)',
                color: active ? (m?.color??'var(--brand)') : 'var(--txt3)',
                fontSize:12.5, fontWeight: active?700:600, cursor:'pointer',
                transition:'all .14s', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5,
                WebkitTapHighlightColor:'transparent',
              }}>
                {n ? m!.label : 'All Types'}
                {count>0 && <span style={{ fontSize:10, fontWeight:800, opacity:.7 }}>{count}</span>}
              </button>
            )
          })}
          {!isMobile && (
            <select className="sui-input" value={classFilter} onChange={e=>setClassFilter(e.target.value)} style={{ marginLeft:'auto', width:180, flexShrink:0 }}>
              <option value="">All Classes</option>
              {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3,4].map(i=><div key={i} className="shule-skeleton" style={{ height:72, borderRadius:16 }}/>)}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && filtered.length===0 && (
        <div style={{ padding:'48px 24px', textAlign:'center', background:'var(--surface)', borderRadius:18, border:'.5px solid var(--border)' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <div style={{ fontSize:15, fontWeight:800, color:'var(--txt)', fontFamily:'var(--font2)', marginBottom:6 }}>
            {search||natureFilter||classFilter ? 'No matching records' : 'No discipline records yet'}
          </div>
          <div style={{ fontSize:13, color:'var(--txt3)', marginBottom:18 }}>
            {search||natureFilter||classFilter ? 'Try adjusting your filters.' : 'Records will appear here once incidents are logged.'}
          </div>
          {!search && !natureFilter && !classFilter && (
            <button onClick={()=>setModal('add')} style={{ padding:'9px 22px', background:'linear-gradient(145deg,var(--brand),var(--brand-dark))', color:'#fff', border:'none', borderRadius:11, fontWeight:700, fontSize:13.5, cursor:'pointer', boxShadow:'0 4px 14px rgba(13,148,136,.4)' }}>
              Add First Record
            </button>
          )}
        </div>
      )}

      {/* ── Mobile: cards ── */}
      {!isLoading && filtered.length>0 && isMobile && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(r=>(
            <DisciplineCard key={r.id} record={r} onEdit={()=>openEdit(r)} onDelete={()=>openDelete(r)}/>
          ))}
        </div>
      )}

      {/* ── Desktop: virtualised table ── */}
      {!isLoading && filtered.length>0 && !isMobile && (
        <div style={{ background:'var(--surface)', border:'.5px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.06)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Date','Nature','Student','Class','Resolution',''].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', background:'var(--surface2)', fontWeight:800, fontSize:10, color:'var(--txt3)', textAlign:'left', textTransform:'uppercase', letterSpacing:.8, borderBottom:'.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ overflowY:'auto', maxHeight:520 }}>
            <div style={{ height:virtualizer.getTotalSize(), position:'relative' }}>
              {virtualizer.getVirtualItems().map(vRow=>{
                const r: DisciplineRecord = filtered[vRow.index]
                return (
                  <div key={r.id} style={{ position:'absolute', top:0, left:0, width:'100%', transform:`translateY(${vRow.start}px)`, height:60, display:'flex', alignItems:'center', borderBottom:'.5px solid var(--border)', cursor:'pointer' }}
                    onClick={()=>openEdit(r)} className="sui-tr">
                    <div style={{ flex:'0 0 100px', padding:'0 14px', fontSize:12, color:'var(--txt3)' }}>{new Date(r.incidentDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}</div>
                    <div style={{ flex:'0 0 120px', padding:'0 14px' }}><NatureBadge nature={r.nature}/></div>
                    <div style={{ flex:1.5, padding:'0 14px', fontSize:13, fontWeight:700, color:'var(--txt)' }}>{r.studentName??r.studentId.slice(0,8)+'…'}</div>
                    <div style={{ flex:1, padding:'0 14px', fontSize:12, color:'var(--txt2)' }}>{r.className??'—'}</div>
                    <div style={{ flex:2, padding:'0 14px', fontSize:12, color:'var(--txt2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.resolution}</div>
                    <div style={{ flex:'0 0 90px', padding:'0 14px', display:'flex', gap:6 }}>
                      <button onClick={e=>{e.stopPropagation();openEdit(r)}} style={{ padding:'4px 10px', fontSize:11.5, border:'.5px solid var(--border)', borderRadius:8, background:'var(--surface2)', cursor:'pointer', color:'var(--txt2)', fontWeight:600 }}>Edit</button>
                      <button onClick={e=>{e.stopPropagation();openDelete(r)}} style={{ padding:'4px 10px', fontSize:11.5, border:'.5px solid rgba(244,63,94,.3)', borderRadius:8, background:'rgba(244,63,94,.06)', cursor:'pointer', color:'var(--danger)', fontWeight:600 }}>Del</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ padding:'8px 14px', borderTop:'.5px solid var(--border)', fontSize:11, color:'var(--txt3)' }}>{filtered.length} record{filtered.length!==1?'s':''}</div>
        </div>
      )}

      {modal==='add'    && <RecordModal initial={null}     onClose={closeModal}/>}
      {modal==='edit'   && <RecordModal initial={selected} onClose={closeModal}/>}
      {modal==='delete' && selected && <DeleteModal record={selected} onClose={closeModal}/>}
    </div>
  )
}
