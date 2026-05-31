import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSubjects, useAddSubject, useUpdateSubject, useToggleSubjectActive } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'

type SubjectForm = { name: string; curriculumCode: string; level: string }
const EMPTY: SubjectForm = { name: '', curriculumCode: '', level: '' }

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
  initial: { id: string; name: string; curriculumCode: string | null; level: string | null } | null
  onClose: () => void
}) {
  const addMut = useAddSubject()
  const updMut = useUpdateSubject()
  const { success: ok, error: err } = useToast()
  const isEdit = !!initial

  const [form, setForm] = useState<SubjectForm>(
    initial ? { name: initial.name, curriculumCode: initial.curriculumCode ?? '', level: initial.level ?? '' } : EMPTY
  )
  const [saving, setSaving] = useState(false)

  const f = (k: keyof SubjectForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (!form.name.trim()) { err('Subject name is required'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await updMut.mutateAsync({ id: initial!.id, name: form.name.trim(), curriculumCode: form.curriculumCode.trim(), level: form.level })
        ok(`${form.name} updated`)
      } else {
        await addMut.mutateAsync({ name: form.name.trim(), curriculumCode: form.curriculumCode.trim(), level: form.level })
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
        <div>
          <Lbl>Level</Lbl>
          <select className="sui-input" value={form.level} onChange={e => f('level', e.target.value)} style={{ width: '100%' }}>
            <option value="">Both O-Level & A-Level</option>
            <option value="O-Level">O-Level (S.1–S.4)</option>
            <option value="A-Level">A-Level (S.5–S.6)</option>
          </select>
        </div>
      </div>
      {/* Footer */}
      <div style={{ padding: '14px 24px 18px', borderTop: '.5px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, height: 46, borderRadius: 13, background: 'var(--surface2)', border: '.5px solid var(--border)', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--txt2)', transition: 'background .13s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2))')}
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
  const [modal, setModal] = useState<'add' | { id: string; name: string; curriculumCode: string | null; level: string | null } | null>(null)

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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(13,148,136,.36)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', margin: 0, letterSpacing: -.3 }}>Subjects</h1>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
              {activeCount} active{inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ''}
            </div>
          </div>
        </div>
        <button
          onClick={() => setModal('add')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.38)', WebkitTapHighlightColor: 'transparent', transition: 'transform .18s cubic-bezier(.34,1.56,.64,1)' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Subject
        </button>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="sui-input" placeholder="Search name or code…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
        </div>
        <select className="sui-input" value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">All Levels</option>
          <option value="O-Level">O-Level (S.1–S.4)</option>
          <option value="A-Level">A-Level (S.5–S.6)</option>
        </select>
        {inactiveCount > 0 && (
          <button
            onClick={() => setShowInactive(v => !v)}
            style={{ padding: '0 14px', height: 46, borderRadius: 12, border: `.5px solid ${showInactive ? 'rgba(139,92,246,.4)' : 'var(--border)'}`, background: showInactive ? 'rgba(139,92,246,.08)' : 'var(--surface)', color: showInactive ? '#8b5cf6' : 'var(--txt2)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap' }}
          >
            {showInactive ? 'Hide' : 'Show'} {inactiveCount} inactive
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="shule-skeleton" style={{ height: 56, borderRadius: 14 }} />)}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 110px', gap: 12, padding: '10px 20px', background: 'var(--surface2)', borderBottom: '.5px solid var(--border)' }}>
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
              gap: 12, padding: '12px 20px', alignItems: 'center',
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
                  onClick={() => setModal({ id: s.id, name: s.name, curriculumCode: s.curriculumCode ?? null, level: s.level ?? null })}
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
