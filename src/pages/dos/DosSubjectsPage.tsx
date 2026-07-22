import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSubjects, useAddSubject, useUpdateSubject, useToggleSubjectActive } from '../../hooks/useClasses'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { useToast } from '../../components/ui/Toast'

type SubjectForm = { name: string; curriculumCode: string; level: string; isPleCore: boolean }
const EMPTY: SubjectForm = { name: '', curriculumCode: '', level: '', isPleCore: false }

// ─── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ title, subtitle, color, onClose, children }: {
  title: string; subtitle: string; color: string
  onClose: () => void; children: React.ReactNode
}) {
  const arEl = useMemo(() => document.querySelector('.ar') as HTMLElement ?? document.body, [])
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 500, maxHeight: '90dvh', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.24)', background: 'var(--surface)' }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 18px', background: `linear-gradient(150deg,${color}14,${color}06,transparent)`, borderBottom: `.5px solid ${color}20`, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', filter: 'blur(40px)', background: `${color}28`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: `linear-gradient(145deg,${color},${color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 5px 20px ${color}44`, flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: 'var(--txt)', letterSpacing: -.3 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{subtitle}</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: `${color}14`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, flexShrink: 0, transition: 'background .13s' }}
              onMouseEnter={e => (e.currentTarget.style.background = `${color}26`)}
              onMouseLeave={e => (e.currentTarget.style.background = `${color}14`)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    arEl
  )
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────
function SubjectModal({ initial, onClose }: {
  initial: { id: string; name: string; curriculumCode: string | null; level: string | null; isPleCore: boolean } | null
  onClose: () => void
}) {
  const addMut = useAddSubject()
  const updMut = useUpdateSubject()
  const { data: school } = useSchoolSettings()
  const { success: ok, error: err } = useToast()
  const isEdit = !!initial
  const isPrimarySchool = school?.educationLevel === 'primary'

  const [form, setForm] = useState<SubjectForm>(
    initial ? { name: initial.name, curriculumCode: initial.curriculumCode ?? '', level: initial.level ?? '', isPleCore: initial.isPleCore } : EMPTY
  )
  const [saving, setSaving] = useState(false)

  const f = (k: keyof SubjectForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (saving) return
    if (!form.name.trim()) { err('Subject name is required'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await updMut.mutateAsync({ id: initial!.id, name: form.name.trim(), curriculumCode: form.curriculumCode.trim(), level: form.level, isPleCore: form.isPleCore })
        ok(`${form.name} updated`)
      } else {
        await addMut.mutateAsync({ name: form.name.trim(), curriculumCode: form.curriculumCode.trim(), level: form.level, isPleCore: form.isPleCore })
        ok(`${form.name} added`)
      }
      onClose()
    } catch (e: any) { err(e?.message ?? 'Failed to save') }
    finally { setSaving(false) }
  }

  const Lbl = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>
      {children}
    </label>
  )

  return (
    <ModalShell
      title={isEdit ? 'Edit Subject' : 'Add Subject'}
      subtitle={isEdit ? `Editing ${initial!.name}` : 'Add a new subject to the school curriculum'}
      color="#0d9488"
      onClose={onClose}
    >
      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Lbl>Subject Name *</Lbl>
          <input className="sui-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Mathematics" style={{ width: '100%' }} />
        </div>
        <div>
          <Lbl>NCDC Curriculum Code</Lbl>
          <input className="sui-input" value={form.curriculumCode} onChange={e => f('curriculumCode', e.target.value)} placeholder="e.g. MAT001" style={{ width: '100%' }} />
        </div>
        {!isPrimarySchool && (
          <div>
            <Lbl>Level</Lbl>
            <select className="sui-input" value={form.level} onChange={e => f('level', e.target.value)} style={{ width: '100%' }}>
              <option value="">Both O-Level & A-Level</option>
              <option value="O-Level">O-Level (S.1–S.4)</option>
              <option value="A-Level">A-Level (S.5–S.6)</option>
            </select>
          </div>
        )}
        {isPrimarySchool && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--surface2)', border: '.5px solid var(--border)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isPleCore} onChange={e => setForm(p => ({ ...p, isPleCore: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Core PLE subject</div>
              <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>
                Check this for exactly English, Mathematics, Science, and Social
                Studies — the 4 subjects PLE's official aggregate/division is
                computed from. Other subjects are graded but don't count
                toward it.
              </div>
            </div>
          </label>
        )}
      </div>
      {/* Footer */}
      <div style={{ padding: '14px 24px 18px', borderTop: '.5px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, height: 46, borderRadius: 13, background: 'var(--surface2)', border: '.5px solid var(--border)', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--txt2)', transition: 'background .13s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
        >Cancel</button>
        <button disabled={saving || !form.name.trim()} onClick={save}
          style={{ flex: 2, height: 46, borderRadius: 13, background: saving || !form.name.trim() ? 'var(--border)' : 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: saving || !form.name.trim() ? 'default' : 'pointer', boxShadow: saving || !form.name.trim() ? 'none' : '0 4px 16px rgba(13,148,136,.38)', transition: 'all .18s' }}
        >{saving ? 'Saving…' : isEdit ? 'Update Subject' : 'Add Subject'}</button>
      </div>
    </ModalShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function DosSubjectsPage() {
  const [levelFilter,   setLevelFilter]   = useState('')
  const [search,        setSearch]        = useState('')
  const [showInactive,  setShowInactive]  = useState(false)
  const [modal, setModal] = useState<'add' | { id: string; name: string; curriculumCode: string | null; level: string | null; isPleCore: boolean } | null>(null)

  // Fetch all subjects including inactive to allow management
  const { data: allSubjects = [], isLoading } = useSubjects(levelFilter || undefined)
  const toggle = useToggleSubjectActive()
  const { success: ok, error: err } = useToast()

  const subjects = showInactive ? allSubjects : allSubjects.filter(s => s.isActive)

  const filtered = useMemo(() => {
    if (!search.trim()) return subjects
    const q = search.toLowerCase()
    return subjects.filter(s => s.name.toLowerCase().includes(q) || (s.curriculumCode ?? '').toLowerCase().includes(q))
  }, [subjects, search])

  const activeCount   = allSubjects.filter(s => s.isActive).length
  const inactiveCount = allSubjects.filter(s => !s.isActive).length

  async function handleToggle(id: string, currentActive: boolean, name: string) {
    try {
      await toggle.mutateAsync({ id, isActive: !currentActive })
      ok(currentActive ? `${name} deactivated` : `${name} reactivated`)
    } catch (e: any) { err(e?.message ?? 'Failed') }
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Hero Band */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        padding: '28px 28px 24px', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Icon + title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.20)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>Subjects</h1>
            </div>
            <button
              onClick={() => setModal('add')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', color: '#fff', border: '.5px solid rgba(255,255,255,.35)', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'background .15s', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.28)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.18)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Subject
            </button>
          </div>

          <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
            Manage the school subject catalogue — activate, edit, or add subjects.
          </p>

          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {[
              { label: 'Total', value: isLoading ? '—' : allSubjects.length },
              { label: 'Active', value: isLoading ? '—' : activeCount },
              { label: 'Inactive', value: isLoading ? '—' : inactiveCount },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.28)', borderRadius: 12, padding: '10px 16px', minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Search + filters inside banner */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .6 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                placeholder="Search name or code…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, width: '100%', background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.28)', borderRadius: 10, padding: '0 12px 0 36px', height: 40, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              style={{ minWidth: 180, height: 40, background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.28)', borderRadius: 10, color: '#fff', fontSize: 13, padding: '0 12px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="" style={{ background: '#059669', color: '#fff' }}>All Levels</option>
              <option value="O-Level" style={{ background: '#059669', color: '#fff' }}>O-Level (S.1–S.4)</option>
              <option value="A-Level" style={{ background: '#059669', color: '#fff' }}>A-Level (S.5–S.6)</option>
            </select>
            {inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive(v => !v)}
                style={{ height: 40, padding: '0 14px', borderRadius: 10, border: `.5px solid ${showInactive ? '#fff' : 'rgba(255,255,255,.35)'}`, background: showInactive ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap' }}
              >
                {showInactive ? 'Hide' : 'Show'} {inactiveCount} inactive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="shule-skeleton" style={{ height: 56, borderRadius: 14 }} />)}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 20, overflow: 'hidden', overflowX: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 110px', gap: 12, padding: '10px 20px', background: 'var(--surface2)', borderBottom: '.5px solid var(--border)', minWidth: 500 }}>
            {['Subject', 'Curriculum Code', 'Level', ''].map(h => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, fontFamily: 'var(--font2)' }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 6, fontFamily: 'var(--font2)' }}>No subjects found</div>
              <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Try adjusting your search or add a new subject.</div>
            </div>
          ) : filtered.map((s, i) => (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 130px 110px',
              gap: 12, padding: '12px 20px', alignItems: 'center', minWidth: 500,
              borderBottom: i < filtered.length - 1 ? '.5px solid var(--border)' : 'none',
              opacity: s.isActive ? 1 : .5,
              transition: 'background .1s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.isActive ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>{s.name}</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{s.curriculumCode ?? '—'}</div>
              <div>
                {s.level ? (
                  <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    background: s.level === 'A-Level' ? 'rgba(139,92,246,.1)' : 'rgba(14,165,233,.1)',
                    color: s.level === 'A-Level' ? '#8b5cf6' : '#0ea5e9',
                    border: `.5px solid ${s.level === 'A-Level' ? 'rgba(139,92,246,.25)' : 'rgba(14,165,233,.25)'}`,
                  }}>{s.level}</span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>Both</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setModal({ id: s.id, name: s.name, curriculumCode: s.curriculumCode ?? null, level: s.level ?? null, isPleCore: s.isPleCore })}
                  style={{ padding: '5px 12px', borderRadius: 9, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', transition: 'all .13s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >Edit</button>
                <button
                  onClick={() => { void handleToggle(s.id, s.isActive, s.name) }}
                  disabled={toggle.isPending}
                  style={{ padding: '5px 12px', borderRadius: 9, border: `.5px solid ${s.isActive ? 'rgba(244,63,94,.3)' : 'rgba(16,185,129,.3)'}`, background: s.isActive ? 'rgba(244,63,94,.06)' : 'rgba(16,185,129,.06)', color: s.isActive ? 'var(--danger)' : 'var(--success)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', transition: 'all .13s' }}
                >{s.isActive ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </div>
          ))}

          {filtered.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '.5px solid var(--border)', background: 'var(--surface2)', fontSize: 11.5, color: 'var(--txt3)', fontWeight: 700 }}>
              {filtered.length} subject{filtered.length !== 1 ? 's' : ''} shown
            </div>
          )}
        </div>
      )}

      {modal === 'add' && (
        <SubjectModal initial={null} onClose={() => setModal(null)} />
      )}
      {modal && modal !== 'add' && (
        <SubjectModal initial={modal} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
