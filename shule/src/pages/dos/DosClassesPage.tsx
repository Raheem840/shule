import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudents } from '../../hooks/useStudents'
import { useAssignClassTeacher } from '../../hooks/useDos'
import { useStaff } from '../../hooks/useStaff'
import { useToast } from '../../components/ui/Toast'
import type { Stream } from '../../types/app'

// ─── Assign Teacher Modal ─────────────────────────────────────────────────────
function AssignTeacherModal({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  const { success: ok, error: err } = useToast()
  const { data: staff = [] } = useStaff()
  const assign = useAssignClassTeacher()
  const [selectedId, setSelectedId] = useState('')
  const teachers = staff.filter(s => s.role === 'teacher' || s.role === 'class_teacher')

  async function handleAssign() {
    if (!selectedId) return
    try {
      await assign.mutateAsync({ streamId: stream.id, classId: stream.classId, teacherId: selectedId })
      ok('Class teacher assigned.')
      onClose()
    } catch (e: any) { err(e.message) }
  }

  const portal = document.querySelector('.ar') as HTMLElement ?? document.body
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 18px', background: 'linear-gradient(150deg,rgba(139,92,246,.1),transparent)', borderBottom: '.5px solid rgba(139,92,246,.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(139,92,246,.4)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)', letterSpacing: -.2 }}>Assign Class Teacher</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Stream: {stream.name}</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: '18px 24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Select Teacher</div>
            <select className="sui-input" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
            <button disabled={!selectedId || assign.isPending} onClick={() => { void handleAssign() }}
              style={{ flex: 2, padding: '10px 0', background: selectedId ? 'linear-gradient(145deg,#8b5cf6,#7c3aed)' : 'var(--border)', color: selectedId ? '#fff' : 'var(--txt3)', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: selectedId ? 'pointer' : 'default', boxShadow: selectedId ? '0 4px 14px rgba(139,92,246,.4)' : 'none', transition: 'all .18s' }}>
              {assign.isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portal
  )
}

// ─── Class detail panel ───────────────────────────────────────────────────────
function ClassDetail({ classId, className }: { classId: string; className: string }) {
  const { data: streams = [] }  = useStreams(classId)
  const [streamFilter, setStreamFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [assignStream, setAssignStream] = useState<Stream | null>(null)

  const { data: students = [], isLoading } = useStudents({ classId, streamId: streamFilter || undefined, status: 'active' })

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.admissionNumber?.toLowerCase().includes(q)
    )
  }, [students, search])

  const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const PALETTE = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#f43f5e','#8b5cf6','#ec4899','#0d9488']
  function sColor(id: string) { let h=0; for (let i=0;i<id.length;i++) h=id.charCodeAt(i)+((h<<5)-h); return PALETTE[Math.abs(h)%PALETTE.length] }

  return (
    <div style={{ padding: '0 20px 20px', borderBottom: '.5px solid var(--border)' }}>
      {/* Streams + assign */}
      {streams.length > 0 && (
        <div style={{ padding: '14px 0 16px', borderBottom: '.5px solid var(--border)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Streams</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {streams.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 12, border: '.5px solid var(--border)', background: 'var(--surface2)', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{s.name}</span>
                {s.classTeacherId ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.2)' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Teacher assigned
                  </span>
                ) : (
                  <button onClick={() => setAssignStream(s)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, border: '.5px solid rgba(139,92,246,.3)', background: 'rgba(139,92,246,.06)', color: '#8b5cf6', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Assign Teacher
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)}
          className="sui-input" style={{ flex: '1 1 180px', maxWidth: 260 }} />
        {streams.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setStreamFilter('')}
              style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, border: `.5px solid ${!streamFilter ? 'rgba(139,92,246,.5)' : 'var(--border)'}`, background: !streamFilter ? 'rgba(139,92,246,.1)' : 'var(--surface2)', color: !streamFilter ? '#8b5cf6' : 'var(--txt3)', cursor: 'pointer' }}>All</button>
            {streams.map(s => (
              <button key={s.id} onClick={() => setStreamFilter(streamFilter === s.id ? '' : s.id)}
                style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, border: `.5px solid ${streamFilter === s.id ? 'rgba(139,92,246,.5)' : 'var(--border)'}`, background: streamFilter === s.id ? 'rgba(139,92,246,.1)' : 'var(--surface2)', color: streamFilter === s.id ? '#8b5cf6' : 'var(--txt3)', cursor: 'pointer' }}>{s.name}</button>
            ))}
          </div>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)', flexShrink: 0 }}>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[1,2,3,4,5,6].map(i => <div key={i} className="shule-skeleton" style={{ width: 140, height: 70, borderRadius: 12 }} />)}</div>}

      {!isLoading && filtered.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No students found{search ? ` matching "${search}"` : ''}.</div>
      )}

      {/* Student pill grid */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
          {filtered.map(s => {
            const col = sColor(s.id)
            const name = `${s.firstName} ${s.lastName}`
            return (
              <div key={s.id} style={{ padding: '10px 12px', borderRadius: 12, border: `.5px solid ${col}25`, background: `${col}08`, display: 'flex', alignItems: 'center', gap: 9, transition: 'all .14s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.background = `${col}15`; e.currentTarget.style.borderColor = `${col}45` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${col}08`; e.currentTarget.style.borderColor = `${col}25` }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${col}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: col, flexShrink: 0, fontFamily: 'var(--font2)' }}>{ini(name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.firstName}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.lastName}</div>
                  {s.admissionNumber && <div style={{ fontSize: 9.5, color: col, fontFamily: 'var(--font3)', marginTop: 1 }}>{s.admissionNumber}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {assignStream && <AssignTeacherModal stream={assignStream} onClose={() => setAssignStream(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export function DosClassesPage() {
  const { data: classes = [], isLoading } = useClasses()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(139,92,246,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Classes</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Expand a class to view students, streams, and assign class teachers.</p>
          </div>
        </div>
      </div>

      {/* KPI */}
      {!isLoading && classes.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Total Classes</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', letterSpacing: -1 }}>{classes.length}</div>
          </div>
          <div style={{ flex: 1, padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Expanded</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', letterSpacing: -1 }}>{expanded.size}</div>
          </div>
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 64, borderRadius: 14 }} />)}</div>}

      {!isLoading && classes.length === 0 && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>No classes found</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Classes appear here after students are registered by the Secretary.</div>
        </div>
      )}

      {/* Class cards */}
      {!isLoading && classes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {classes.map(c => {
            const isOpen = expanded.has(c.id)
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: `.5px solid ${isOpen ? 'rgba(139,92,246,.35)' : 'var(--border)'}`, borderRadius: 18, overflow: 'hidden', boxShadow: isOpen ? '0 4px 24px rgba(139,92,246,.1)' : '0 1px 6px rgba(0,0,0,.04)', transition: 'all .18s' }}>
                {/* Class header */}
                <div onClick={() => toggle(c.id)} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: isOpen ? 'linear-gradient(135deg,rgba(139,92,246,.06),transparent)' : 'transparent', transition: 'background .15s' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: isOpen ? 'linear-gradient(145deg,#8b5cf6,#7c3aed)' : 'linear-gradient(145deg,rgba(139,92,246,.2),rgba(139,92,246,.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .18s', boxShadow: isOpen ? '0 4px 14px rgba(139,92,246,.4)' : 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isOpen ? '#fff' : '#8b5cf6'} strokeWidth="2.2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)', letterSpacing: -.2 }}>{c.name}</div>
                    {c.level && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>Level {c.level}</div>}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5" style={{ transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                {isOpen && <ClassDetail classId={c.id} className={c.name} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
