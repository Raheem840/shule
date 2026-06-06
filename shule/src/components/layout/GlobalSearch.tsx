import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth, type UserRole } from '../../store/AuthContext'
import { ROLE_NAV } from '../../config/roleNav'

// ── Types ────────────────────────────────────────────────────────────────────

type ResultKind = 'page' | 'student' | 'staff'

interface SearchResult {
  id:       string
  kind:     ResultKind
  title:    string
  subtitle: string
  path:     string
  initial?: string
  color?:   string
}

// ── Constants ────────────────────────────────────────────────────────────────

const KIND_META: Record<ResultKind, { label: string; accent: string; bg: string }> = {
  page:    { label: 'Page',    accent: '#8b5cf6', bg: 'rgba(139,92,246,.12)' },
  student: { label: 'Student', accent: '#0ea5e9', bg: 'rgba(14,165,233,.12)' },
  staff:   { label: 'Staff',   accent: '#10b981', bg: 'rgba(16,185,129,.12)' },
}

const STUDENT_ROLES: Set<UserRole> = new Set([
  'principal', 'deputy', 'dos', 'secretary', 'bursar', 'class_teacher', 'teacher',
])
const STAFF_ROLES: Set<UserRole> = new Set(['principal', 'deputy', 'secretary'])

// Student detail route per role (if the role has an individual student view)
const STUDENT_DETAIL: Partial<Record<UserRole, (id: string) => string>> = {
  principal: id => `/principal/students/${id}`,
  deputy:    id => `/deputy/students/${id}`,
}
const STAFF_DETAIL: Partial<Record<UserRole, (id: string) => string>> = {
  principal: id => `/principal/staff/${id}`,
  deputy:    id => `/deputy/staff/${id}`,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const PALETTE = [
  '#0d9488','#0ea5e9','#8b5cf6','#f59e0b','#f43f5e','#10b981',
]
function nameColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return dv
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${color}22`, border: `1.5px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font2)', fontWeight: 800,
      fontSize: size * 0.33, color,
    }}>
      {initials(name)}
    </div>
  )
}

function KindBadge({ kind }: { kind: ResultKind }) {
  const m = KIND_META[kind]
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.7px',
      textTransform: 'uppercase', padding: '2px 7px', borderRadius: 99,
      background: m.bg, color: m.accent, flexShrink: 0,
    }}>
      {m.label}
    </span>
  )
}

// ── Page icon (SVG from nav config, rendered inline) ──────────────────────────
function PageIcon({ svgStr }: { svgStr: string }) {
  const parsed = svgStr.match(/viewBox="([^"]+)"[\s\S]*?>([\s\S]*?)<\/svg>/)
  const vb = parsed?.[1] ?? '0 0 24 24'
  const inner = parsed?.[2] ?? ''
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: 'rgba(139,92,246,.1)', border: '1.5px solid rgba(139,92,246,.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={18} height={18} viewBox={vb} fill="none"
        stroke="#8b5cf6" strokeWidth={2} strokeLinecap="round"
        dangerouslySetInnerHTML={{ __html: inner }} />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  open:    boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)

  const [query,   setQuery]   = useState('')
  const [cursor,  setCursor]  = useState(0)
  const [loading, setLoading] = useState(false)
  const [dbResults, setDbResults] = useState<SearchResult[]>([])

  const dq = useDebounce(query.trim(), 220)

  // ── Nav pages matching ────────────────────────────────────────────────────
  const pageResults = useMemo<SearchResult[]>(() => {
    if (!user?.role || !dq) return []
    const nav  = ROLE_NAV[user.role] ?? []
    const q    = dq.toLowerCase()
    const hits: SearchResult[] = []
    for (const group of nav) {
      for (const item of group.items) {
        if (item.label.toLowerCase().includes(q)) {
          hits.push({
            id:       item.path,
            kind:     'page',
            title:    item.label,
            subtitle: group.label,
            path:     item.path,
          })
        }
      }
    }
    return hits.slice(0, 5)
  }, [dq, user?.role])

  // ── DB search (students + staff) ─────────────────────────────────────────
  useEffect(() => {
    if (!dq || !user?.schoolId) { setDbResults([]); return }
    let cancelled = false
    setLoading(true)

    const role = user.role

    ;(async () => {
      const promises: Promise<SearchResult[]>[] = []

      // Students
      if (STUDENT_ROLES.has(role)) {
        promises.push(
          supabase
            .from('students')
            .select('id, first_name, last_name, admission_number, class_id')
            .eq('school_id', user.schoolId)
            .or(`first_name.ilike.%${dq}%,last_name.ilike.%${dq}%,admission_number.ilike.%${dq}%`)
            .limit(6)
            .then(({ data }) =>
              (data ?? []).map(r => {
                const name  = `${r.first_name} ${r.last_name}`
                const detailFn = STUDENT_DETAIL[role]
                return {
                  id:       r.id,
                  kind:     'student' as ResultKind,
                  title:    name,
                  subtitle: r.admission_number,
                  path:     detailFn ? detailFn(r.id) : `/${role}/students`,
                  initial:  name,
                  color:    nameColor(name),
                }
              })
            )
        )
      }

      // Staff
      if (STAFF_ROLES.has(role)) {
        promises.push(
          supabase
            .from('staff')
            .select('id, first_name, last_name, staff_number, role')
            .eq('school_id', user.schoolId)
            .or(`first_name.ilike.%${dq}%,last_name.ilike.%${dq}%,staff_number.ilike.%${dq}%`)
            .limit(5)
            .then(({ data }) =>
              (data ?? []).map(r => {
                const name = `${r.first_name} ${r.last_name}`
                const detailFn = STAFF_DETAIL[role]
                return {
                  id:       r.id,
                  kind:     'staff' as ResultKind,
                  title:    name,
                  subtitle: `${r.role} · ${r.staff_number}`,
                  path:     detailFn ? detailFn(r.id) : `/${role}/staff`,
                  initial:  name,
                  color:    nameColor(name),
                }
              })
            )
        )
      }

      const groups = await Promise.all(promises)
      if (!cancelled) {
        setDbResults(groups.flat())
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [dq, user?.schoolId, user?.role])

  const results = useMemo<SearchResult[]>(
    () => [...pageResults, ...dbResults],
    [pageResults, dbResults]
  )

  // ── Cursor reset on results change ───────────────────────────────────────
  useEffect(() => setCursor(0), [results])

  // ── Auto-focus input ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('')
      setDbResults([])
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const navigate_ = useCallback((result: SearchResult) => {
    navigate(result.path)
    onClose()
    setQuery('')
  }, [navigate, onClose])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && results[cursor]) {
      e.preventDefault()
      navigate_(results[cursor])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // ── Scroll active result into view ───────────────────────────────────────
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  const hasQuery = query.trim().length > 0

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(7,13,26,0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          animation: 'gsBackdrop 0.18s ease both',
        }}
      />

      {/* ── Panel ── */}
      <div
        style={{
          position: 'fixed', zIndex: 9001,
          top: '10vh', left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 640,
          padding: '0 16px',
          animation: 'gsPanel 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
        }}>

          {/* ── Input row ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 20px',
            borderBottom: hasQuery || results.length ? '1px solid var(--border)' : 'none',
          }}>
            {/* Search icon */}
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke={loading ? 'var(--brand)' : 'var(--txt3)'} strokeWidth={2}
              style={{ flexShrink: 0, transition: 'stroke .2s' }}>
              <circle cx={11} cy={11} r={8}/>
              <line x1={21} y1={21} x2={16.65} y2={16.65}/>
            </svg>

            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search pages, students, staff…"
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent',
                fontSize: 16, fontWeight: 500,
                color: 'var(--txt)',
                fontFamily: 'var(--font1)',
              }}
            />

            {/* Loading spinner */}
            {loading && (
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: '2px solid var(--border)',
                borderTopColor: 'var(--brand)',
                animation: 'gsSpin 0.6s linear infinite',
              }} />
            )}

            {/* Escape hint */}
            {!loading && (
              <kbd style={{
                padding: '3px 8px', borderRadius: 6,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)',
                flexShrink: 0,
              }}>
                Esc
              </kbd>
            )}
          </div>

          {/* ── Results ── */}
          {results.length > 0 && (
            <div
              ref={listRef}
              style={{ maxHeight: '55vh', overflowY: 'auto', padding: '8px 8px' }}
            >
              {/* Group by kind */}
              {(['page', 'student', 'staff'] as ResultKind[]).map(kind => {
                const group = results.filter(r => r.kind === kind)
                if (!group.length) return null
                const m = KIND_META[kind]
                return (
                  <div key={kind} style={{ marginBottom: 4 }}>
                    <div style={{
                      padding: '6px 12px 4px',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.8px',
                      textTransform: 'uppercase', color: 'var(--txt3)',
                      fontFamily: 'var(--font2)',
                    }}>
                      {m.label}s
                    </div>
                    {group.map(r => {
                      const idx = results.indexOf(r)
                      const active = idx === cursor
                      return (
                        <div
                          key={r.id}
                          data-idx={idx}
                          onClick={() => navigate_(r)}
                          onMouseEnter={() => setCursor(idx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 12,
                            cursor: 'pointer', transition: 'background 0.1s',
                            background: active ? `${m.accent}14` : 'transparent',
                            border: active ? `1px solid ${m.accent}25` : '1px solid transparent',
                          }}
                        >
                          {/* Icon / avatar */}
                          {r.kind === 'page'
                            ? <PageIcon svgStr={
                                (() => {
                                  const nav = ROLE_NAV[user!.role] ?? []
                                  for (const g of nav) for (const item of g.items) if (item.path === r.path) return item.svg
                                  return ''
                                })()
                              } />
                            : <Avatar name={r.initial ?? r.title} color={r.color ?? m.accent} />
                          }

                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 14, fontWeight: 700,
                              color: active ? m.accent : 'var(--txt)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              transition: 'color 0.1s',
                            }}>
                              {r.title}
                            </div>
                            <div style={{
                              fontSize: 12, color: 'var(--txt3)', marginTop: 1,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {r.subtitle}
                            </div>
                          </div>

                          <KindBadge kind={r.kind} />

                          {/* Arrow hint when active */}
                          {active && (
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                              stroke={m.accent} strokeWidth={2.5} style={{ flexShrink: 0 }}>
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Empty state ── */}
          {hasQuery && !loading && results.length === 0 && (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
                  stroke="var(--txt3)" strokeWidth={1.8}>
                  <circle cx={11} cy={11} r={8}/>
                  <line x1={21} y1={21} x2={16.65} y2={16.65}/>
                </svg>
              </div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>
                No results for "{query.trim()}"
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                Try a student name, admission number, or page name
              </div>
            </div>
          )}

          {/* ── Idle hint ── */}
          {!hasQuery && (
            <div style={{ padding: '20px 20px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12,
                fontFamily: 'var(--font2)',
              }}>
                Quick tips
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { icon: '⌘K', label: 'Open search' },
                  { icon: '↑↓', label: 'Navigate' },
                  { icon: '↩', label: 'Open' },
                  { icon: 'Esc', label: 'Close' },
                ].map(tip => (
                  <div key={tip.label} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 99,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                  }}>
                    <kbd style={{ fontFamily: 'var(--font3)', fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>
                      {tip.icon}
                    </kbd>
                    <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{tip.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface2)',
          }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
              stroke="var(--brand)" strokeWidth={2.5}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600 }}>
              Shule Search
            </span>
            <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 'auto' }}>
              {results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''}` : 'Type to search'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gsBackdrop { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gsPanel    { from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.96) } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1) } }
        @keyframes gsSpin     { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
