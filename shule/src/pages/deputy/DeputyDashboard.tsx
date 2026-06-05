import { useDeputyKpis, useRecentDiscipline, useDeputyOverview } from '../../hooks/useDeputy'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { DisciplineNature } from '../../types/week9'

const NATURE_COLOR: Record<DisciplineNature, [string, string]> = {
  lateness:    ['#f59e0b', 'rgba(245,158,11,.12)'],
  absenteeism: ['#0ea5e9', 'rgba(14,165,233,.12)'],
  misconduct:  ['#f43f5e', 'rgba(244,63,94,.12)'],
  violence:    ['#f43f5e', 'rgba(244,63,94,.12)'],
  other:       ['#94a3b8', 'rgba(148,163,184,.12)'],
}

// ─── KPI card ────────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon, grad, glow, loading=false }: {
  label: string; value: string|number; sub?: string
  icon: React.ReactNode; grad: string; glow: string; loading?: boolean
}) {
  return (
    <div style={{
      flex:1, minWidth:150,
      background:'var(--surface)',
      border:'.5px solid var(--border)',
      borderRadius:18,
      padding:'20px 20px 18px',
      display:'flex', flexDirection:'column', gap:10,
      boxShadow:'0 2px 16px rgba(0,0,0,.06)',
      position:'relative', overflow:'hidden',
    }}>
      {/* Gradient glow top-right */}
      <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:glow, filter:'blur(32px)', pointerEvents:'none' }}/>
      <div style={{ width:42, height:42, borderRadius:14, background:grad, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 16px ${glow}` }}>
        <div style={{ width:20, height:20, color:'#fff' }}>{icon}</div>
      </div>
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:.9, marginBottom:6 }}>{label}</div>
        <div style={{ fontSize:28, fontWeight:900, fontFamily:'var(--font2)', color:'var(--txt)', letterSpacing:-1, lineHeight:1 }}>
          {loading ? <span style={{ opacity:.25, fontSize:22 }}>—</span> : value}
        </div>
        {sub && <div style={{ fontSize:11.5, color:'var(--txt3)', marginTop:5 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Recent discipline ────────────────────────────────────────────────────────────
function RecentDisciplinePanel() {
  const { data: records=[], isLoading } = useRecentDiscipline()
  return (
    <div style={{ flex:1, minWidth:260, background:'var(--surface)', border:'.5px solid var(--border)', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,.06)' }}>
      <div style={{ padding:'18px 20px 14px', borderBottom:'.5px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:11, background:'linear-gradient(145deg,#f59e0b,#d97706)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 12px rgba(245,158,11,.36)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:14, color:'var(--txt)', fontFamily:'var(--font2)' }}>Recent Incidents</div>
          <div style={{ fontSize:11, color:'var(--txt3)' }}>Last 5 discipline records</div>
        </div>
        {records.length>0 && <div style={{ padding:'3px 10px', borderRadius:99, fontSize:10, fontWeight:800, background:'rgba(245,158,11,.12)', color:'#d97706', border:'.5px solid rgba(245,158,11,.25)' }}>{records.length}</div>}
      </div>
      {isLoading && (
        <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i=><div key={i} className="shule-skeleton" style={{ height:44, borderRadius:12 }}/>)}
        </div>
      )}
      {!isLoading && records.length===0 && (
        <div style={{ padding:'32px 20px', textAlign:'center' }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
          </div>
          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--txt2)', marginBottom:4 }}>All clear</div>
          <div style={{ fontSize:12, color:'var(--txt3)' }}>No discipline incidents recorded</div>
        </div>
      )}
      {!isLoading && records.map((r, i) => {
        const [clr, bg] = NATURE_COLOR[r.nature]
        return (
          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:i<records.length-1?'.5px solid var(--border)':'none' }}>
            <div style={{ width:36, height:36, borderRadius:11, background:bg, border:`.5px solid ${clr}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={clr} strokeWidth="2.2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)', marginBottom:2 }}>{r.studentName}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:10, fontWeight:700, color:clr, background:bg, padding:'1px 7px', borderRadius:99, textTransform:'capitalize' }}>{r.nature}</span>
                <span style={{ fontSize:10.5, color:'var(--txt3)' }}>{new Date(r.incidentDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Attendance overview ──────────────────────────────────────────────────────────
function AttendancePanel() {
  const { data: classSummaries=[], isLoading } = useDeputyOverview()

  const below = classSummaries.filter(c=>c.isBelowThreshold).sort((a,b)=>a.attendanceRate-b.attendanceRate)
  const hasAnyData = classSummaries.some(c=>c.attendanceRate>0||c.isBelowThreshold)

  return (
    <div style={{ flex:1, minWidth:260, background:'var(--surface)', border:'.5px solid var(--border)', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,.06)' }}>
      <div style={{ padding:'18px 20px 14px', borderBottom:'.5px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:11, background:'linear-gradient(145deg,#0ea5e9,#0284c7)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 12px rgba(14,165,233,.36)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:14, color:'var(--txt)', fontFamily:'var(--font2)' }}>Attendance Alerts</div>
          <div style={{ fontSize:11, color:'var(--txt3)' }}>Classes below 80% threshold</div>
        </div>
        {below.length>0 && <div style={{ padding:'3px 10px', borderRadius:99, fontSize:10, fontWeight:800, background:'rgba(244,63,94,.1)', color:'var(--danger)', border:'.5px solid rgba(244,63,94,.25)' }}>{below.length} alert{below.length>1?'s':''}</div>}
      </div>

      {isLoading && (
        <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i=><div key={i} className="shule-skeleton" style={{ height:44, borderRadius:12 }}/>)}
        </div>
      )}

      {!isLoading && !hasAnyData && (
        <div style={{ padding:'32px 20px', textAlign:'center' }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--txt2)', marginBottom:4 }}>No attendance data</div>
          <div style={{ fontSize:12, color:'var(--txt3)' }}>Start recording attendance to see class alerts</div>
        </div>
      )}

      {!isLoading && hasAnyData && below.length===0 && (
        <div style={{ padding:'20px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:'rgba(16,185,129,.1)', border:'.5px solid rgba(16,185,129,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize:13.5, fontWeight:700, color:'var(--success)', marginBottom:2 }}>All classes on track</div>
            <div style={{ fontSize:11.5, color:'var(--txt3)' }}>Every class is above the 80% threshold</div>
          </div>
        </div>
      )}

      {!isLoading && below.map((c,i)=>{
        const pct = c.attendanceRate
        const danger = pct<60
        return(
          <div key={c.classId} style={{ padding:'12px 20px', borderBottom:i<below.length-1?'.5px solid var(--border)':'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)' }}>{c.className}</div>
                {c.level && <div style={{ fontSize:11, color:'var(--txt3)', marginTop:1 }}>{c.level}</div>}
              </div>
              <span style={{ fontSize:13, fontWeight:900, color:danger?'var(--danger)':'var(--warning)', fontFamily:'var(--font2)' }}>{pct}%</span>
            </div>
            <div style={{ height:5, borderRadius:99, background:'var(--surface2)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, borderRadius:99, background:danger?'linear-gradient(90deg,#f43f5e,#e11d48)':'linear-gradient(90deg,#f59e0b,#d97706)', transition:'width .6s ease' }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════
// DEPUTY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════════
export function DeputyDashboard() {
  const isMobile = useIsMobile()
  const { data:kpis, isLoading:kl } = useDeputyKpis()

  const incidents   = kl ? '—' : (kpis?.disciplineIncidents ?? 0)
  const belowCount  = kl ? '—' : (kpis?.studentsBelowThreshold ?? 0)
  const teachers    = kl ? '—' : (kpis?.activeClassTeachers ?? 0)

  return (
    <div className="sui-page-enter stagger-sections" style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* ── Hero ── */}
      <div className="sui-hero-band" style={{ position:'relative', overflow:'hidden' }}>
        {/* Decorative orbs */}
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(13,148,136,.18),transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-30, left:60, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle,rgba(14,165,233,.14),transparent 70%)', filter:'blur(36px)', pointerEvents:'none' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:40, height:40, borderRadius:13, background:'linear-gradient(145deg,var(--brand),var(--brand-dark))', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(13,148,136,.4)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                </div>
                <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:isMobile?18:22, margin:0, lineHeight:1.2 }}>
                  <span className="gradient-text">Deputy Principal</span>
                </h1>
              </div>
              <p style={{ fontSize:13, color:'var(--txt3)', margin:0, maxWidth:480 }}>
                Attendance oversight, student discipline tracking and timetable management.
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:99, background:'rgba(16,185,129,.1)', color:'var(--success)', fontSize:11, fontWeight:700, border:'.5px solid rgba(16,185,129,.25)', whiteSpace:'nowrap', flexShrink:0 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', display:'inline-block' }}/>
              Live data
            </div>
          </div>
        </div>
      </div>

      {/* ── Term timeline ── */}
      <SafeTermProgressTimeline />

      {/* ── KPI row ── */}
      <div className="stagger-cards sui-kpi-grid" style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
        <KPI
          label="Discipline Incidents"
          value={incidents}
          sub="Total recorded this term"
          loading={kl}
          grad="linear-gradient(145deg,#f59e0b,#d97706)"
          glow="rgba(245,158,11,.22)"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>}
        />
        <KPI
          label="Below Threshold"
          value={belowCount}
          sub="Students below 80% attendance"
          loading={kl}
          grad={typeof belowCount==='number'&&belowCount>0?'linear-gradient(145deg,#f43f5e,#e11d48)':'linear-gradient(145deg,#10b981,#059669)'}
          glow={typeof belowCount==='number'&&belowCount>0?'rgba(244,63,94,.22)':'rgba(16,185,129,.22)'}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
        />
        <KPI
          label="Class Teachers"
          value={teachers}
          sub="Actively assigned to streams"
          loading={kl}
          grad="linear-gradient(145deg,#0d9488,#0f766e)"
          glow="rgba(13,148,136,.22)"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <KPI
          label="Timetable Gaps"
          value="—"
          sub="Analysis coming soon"
          grad="linear-gradient(145deg,#8b5cf6,#7c3aed)"
          glow="rgba(139,92,246,.22)"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
        />
      </div>

      {/* ── Side panels ── */}
      <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
        <RecentDisciplinePanel />
        <AttendancePanel />
      </div>

    </div>
  )
}
