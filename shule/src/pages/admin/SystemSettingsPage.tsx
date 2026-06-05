import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  useAcademicYears,
  usePromoteStudents,
  useStorageBuckets,
  useLoadPromotionCandidates,
  useSelectivePromote,
} from '../../hooks/useAdmin'
import type { PromotionCandidate, PerformanceGrade } from '../../hooks/useAdmin'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'

// ── Portal toggle helpers ─────────────────────────────────────────────────────
function usePortalOpen(schoolId: string | undefined) {
  return useQuery({
    queryKey: ['portal-open', schoolId],
    enabled: !!schoolId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_profile')
        .select('parent_portal_open')
        .eq('id', schoolId!)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data?.parent_portal_open ?? true) as boolean
    },
  })
}

function useTogglePortal(schoolId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (open: boolean) => {
      const { error } = await supabase
        .from('school_profile')
        .update({ parent_portal_open: open })
        .eq('id', schoolId!)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, open) => {
      qc.setQueryData(['portal-open', schoolId], open)
      void qc.invalidateQueries({ queryKey: ['portal-open', schoolId] })
    },
  })
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 48, height: 26, borderRadius: 99,
        background: checked ? 'var(--brand)' : 'var(--border)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0, transition: 'background .22s',
        boxShadow: checked ? '0 2px 8px rgba(13,148,136,.4)' : 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 25 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,.22)',
        transition: 'left .22s cubic-bezier(.4,0,.2,1)',
      }} />
    </button>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, dangerous,
}: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; dangerous?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: dangerous ? 'var(--danger)' : 'var(--txt)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--txt2)' }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="sui-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: dangerous ? 'var(--danger)' : 'var(--brand)', color: '#fff',
            }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Grade badge ───────────────────────────────────────────────────────────────
const GRADE_COLORS: Record<PerformanceGrade, { bg: string; color: string }> = {
  'Exceptional':           { bg: 'rgba(16,185,129,.12)',  color: 'var(--success)' },
  'Proficient':            { bg: 'rgba(13,148,136,.12)',  color: 'var(--brand)'   },
  'Needs Improvement':     { bg: 'rgba(245,158,11,.12)',  color: 'var(--warning)' },
  'Advised to Stay Back':  { bg: 'rgba(244,63,94,.12)',   color: 'var(--danger)'  },
  'No Data':               { bg: 'rgba(148,163,184,.12)', color: 'var(--txt3)'    },
}

function GradeBadge({ grade }: { grade: PerformanceGrade }) {
  const { bg, color } = GRADE_COLORS[grade]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
      padding: '2px 8px', borderRadius: 99,
      background: bg, color,
    }}>{grade}</span>
  )
}

// ── Selective promotion step types ────────────────────────────────────────────
type PromoteStep = 'configure' | 'preview' | 'confirm'

const ALL_GRADES: PerformanceGrade[] = [
  'Exceptional', 'Proficient', 'Needs Improvement', 'Advised to Stay Back', 'No Data',
]

const DEFAULT_GRADE_FILTER: Record<PerformanceGrade, boolean> = {
  'Exceptional':           true,
  'Proficient':            true,
  'Needs Improvement':     false,
  'Advised to Stay Back':  false,
  'No Data':               true,
}

// ── SelectivePromotionPanel ───────────────────────────────────────────────────
function SelectivePromotionPanel({ onDone }: { onDone: (result: { promoted: number; completed: number }) => void }) {
  const [step, setStep] = useState<PromoteStep>('configure')
  const [term, setTerm] = useState('3')
  const [year, setYear] = useState(new Date().getFullYear())
  const [gradeFilter, setGradeFilter] = useState<Record<PerformanceGrade, boolean>>(DEFAULT_GRADE_FILTER)
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [showFinalConfirm, setShowFinalConfirm] = useState(false)

  const loadCandidates = useLoadPromotionCandidates()
  const selectivePromote = useSelectivePromote()
  const { success: ok, error: err } = useToast()

  async function handleLoad() {
    try {
      const result = await loadCandidates.mutateAsync({ term, year })
      setCandidates(result)
      // Pre-check students that match the selected grade filters
      const preChecked = new Set(
        result
          .filter(c => gradeFilter[c.grade] && c.classId != null)
          .map(c => c.id)
      )
      setChecked(preChecked)
      setStep('preview')
    } catch (e: any) {
      err(e.message)
    }
  }

  async function handlePromote() {
    setShowFinalConfirm(false)
    try {
      const result = await selectivePromote.mutateAsync(Array.from(checked))
      onDone(result)
    } catch (e: any) {
      err(e.message)
    }
  }

  // Group candidates by class
  const byClass = useMemo(() => {
    const map = new Map<string, PromotionCandidate[]>()
    for (const c of candidates) {
      const key = c.className || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [candidates])

  const selectedCount = checked.size
  const classCount = byClass.filter(([, students]) => students.some(s => checked.has(s.id))).length

  if (step === 'configure') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Step header */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>
          Step 1 of 3 — Configure
        </div>

        {/* Term + Year row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Term</label>
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: 13, color: 'var(--txt)', fontFamily: 'var(--font1)',
              }}
            >
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Year</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              min={2020}
              max={2099}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: 13, color: 'var(--txt)', fontFamily: 'var(--font1)', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Grade filter */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 8 }}>
            Pre-select students by performance grade
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALL_GRADES.map(g => {
              const { bg, color } = GRADE_COLORS[g]
              return (
                <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={gradeFilter[g]}
                    onChange={e => setGradeFilter(prev => ({ ...prev, [g]: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: 'var(--brand)' }}
                  />
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                    background: bg, color,
                  }}>{g}</span>
                </label>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleLoad}
          disabled={loadCandidates.isPending}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13,
            alignSelf: 'flex-start', opacity: loadCandidates.isPending ? 0.6 : 1,
          }}
        >
          {loadCandidates.isPending ? 'Loading…' : 'Load Students'}
        </button>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>
            Step 2 of 3 — Preview
          </div>
          <button
            onClick={() => setStep('configure')}
            style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Back
          </button>
        </div>

        {/* Summary pill */}
        <div style={{
          padding: '8px 14px', borderRadius: 10,
          background: 'rgba(13,148,136,.08)', border: '1px solid rgba(13,148,136,.2)',
          fontSize: 13, color: 'var(--brand)', fontWeight: 700,
        }}>
          {selectedCount} student{selectedCount !== 1 ? 's' : ''} selected across {classCount} class{classCount !== 1 ? 'es' : ''}
        </div>

        {/* Per-class tables */}
        {byClass.map(([className, students]) => {
          const allSelected = students.every(s => checked.has(s.id))
          const noneSelected = students.every(s => !checked.has(s.id))
          const hasTerminal = students[0]?.isTerminal

          function toggleAll(v: boolean) {
            setChecked(prev => {
              const next = new Set(prev)
              for (const s of students) v ? next.add(s.id) : next.delete(s.id)
              return next
            })
          }

          return (
            <div key={className} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Class header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--surface2)',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{className}</span>
                  {hasTerminal && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(139,92,246,.12)', color: 'var(--violet)',
                    }}>Will complete O'Level</span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{students.length} students</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => toggleAll(true)}
                    disabled={allSelected}
                    style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: allSelected ? 0.4 : 1 }}
                  >Select All</button>
                  <button
                    onClick={() => toggleAll(false)}
                    disabled={noneSelected}
                    style={{ fontSize: 11, color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: noneSelected ? 0.4 : 1 }}
                  >Deselect All</button>
                </div>
              </div>

              {/* Student rows */}
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['', 'Name', 'Adm. No', 'Avg Score', 'Grade'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr
                        key={s.id}
                        style={{ borderTop: '1px solid var(--border)', background: checked.has(s.id) ? 'rgba(13,148,136,.04)' : undefined, cursor: 'pointer' }}
                        onClick={() => setChecked(prev => {
                          const next = new Set(prev)
                          next.has(s.id) ? next.delete(s.id) : next.add(s.id)
                          return next
                        })}
                      >
                        <td style={{ padding: '7px 10px', width: 32 }}>
                          <input
                            type="checkbox"
                            checked={checked.has(s.id)}
                            onChange={() => {}}
                            style={{ accentColor: 'var(--brand)' }}
                          />
                        </td>
                        <td style={{ padding: '7px 10px', fontSize: 13, color: 'var(--txt)', fontWeight: 600 }}>
                          {s.firstName} {s.lastName}
                        </td>
                        <td style={{ padding: '7px 10px', fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
                          {s.admissionNumber}
                        </td>
                        <td style={{ padding: '7px 10px', fontSize: 12, color: 'var(--txt)', fontFamily: 'var(--font3)', fontWeight: 700 }}>
                          {s.avgScore !== null ? s.avgScore.toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <GradeBadge grade={s.grade} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        <button
          onClick={() => setStep('confirm')}
          disabled={selectedCount === 0}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13,
            alignSelf: 'flex-start', opacity: selectedCount === 0 ? 0.5 : 1,
          }}
        >
          Review &amp; Confirm →
        </button>
      </div>
    )
  }

  // step === 'confirm'
  const terminalSelected = candidates.filter(c => c.isTerminal && checked.has(c.id))
  const regularSelected  = candidates.filter(c => !c.isTerminal && checked.has(c.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showFinalConfirm && (
        <ConfirmDialog
          title={`Promote ${selectedCount} Students`}
          message={`${regularSelected.length} students will be advanced to the next class. ${terminalSelected.length} S.4/S.6 students will be marked as completed (O'Level/A'Level done). This cannot be undone.`}
          confirmLabel={`Promote ${selectedCount} Students`}
          onConfirm={handlePromote}
          onCancel={() => setShowFinalConfirm(false)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>
          Step 3 of 3 — Confirm
        </div>
        <button
          onClick={() => setStep('preview')}
          style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Back
        </button>
      </div>

      {/* Summary by class */}
      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {byClass.filter(([, students]) => students.some(s => checked.has(s.id))).map(([className, students]) => {
          const count = students.filter(s => checked.has(s.id)).length
          const isTerminal = students[0]?.isTerminal
          return (
            <div key={className} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{className}</span>
                {isTerminal && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(139,92,246,.12)', color: 'var(--violet)' }}>
                    O'Level Complete
                  </span>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{count}</span>
            </div>
          )
        })}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>Total</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{selectedCount}</span>
        </div>
      </div>

      <button
        onClick={() => setShowFinalConfirm(true)}
        disabled={selectivePromote.isPending || selectedCount === 0}
        style={{
          padding: '11px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14,
          alignSelf: 'flex-start', opacity: selectivePromote.isPending ? 0.6 : 1,
        }}
      >
        {selectivePromote.isPending ? 'Promoting…' : `Promote ${selectedCount} Students`}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SystemSettingsPage() {
  const { user } = useAuth()
  const { data: years = [],   isLoading: yearsLoading  } = useAcademicYears()
  const { data: buckets = [], isLoading: bucketsLoading } = useStorageBuckets()
  const { success: ok, error: err } = useToast()
  const promote = usePromoteStudents()

  const { data: portalOpen, isLoading: portalLoading } = usePortalOpen(user?.schoolId)
  const togglePortal = useTogglePortal(user?.schoolId)

  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false)
  const [promoteResult, setPromoteResult] = useState<{ promoted: number; completed: number; total?: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [showSelectiveFlow, setShowSelectiveFlow] = useState(false)

  async function handlePromoteAll() {
    setShowPromoteConfirm(false)
    setProgress(0)
    try {
      const result = await promote.mutateAsync((current, total) => {
        setProgress(Math.round((current / total) * 100))
      })
      setPromoteResult(result)
      ok(`Promoted ${result.promoted} students. ${result.completed} completed.`)
    } catch (e: any) { err(e.message) }
    finally { setProgress(0) }
  }

  async function handlePortalToggle(open: boolean) {
    try {
      await togglePortal.mutateAsync(open)
      ok(open ? 'Parent portal is now open.' : 'Parent portal has been closed.')
    } catch (e: any) { err(e.message) }
  }

  const activeYear = years.find((y: any) => y.is_active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>System Settings</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Portal access, academic years, student promotion and storage</p>
        </div>
      </div>

      {showPromoteConfirm && (
        <ConfirmDialog
          title="Promote All Students"
          message="This will advance every active student to the next class. S.4 and S.6 students will be marked as completed. This cannot be undone."
          confirmLabel="Promote All"
          dangerous
          onConfirm={handlePromoteAll}
          onCancel={() => setShowPromoteConfirm(false)}
        />
      )}

      {/* ── Portal Access ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '18px 20px',
        boxShadow: '0 1px 6px rgba(0,0,0,.04)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 14 }}>Portal Access</div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '14px 16px', borderRadius: 12,
          background: portalOpen ? 'rgba(13,148,136,.04)' : 'rgba(244,63,94,.04)',
          border: `1px solid ${portalOpen ? 'rgba(13,148,136,.18)' : 'rgba(244,63,94,.18)'}`,
          transition: 'all .22s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: portalOpen ? 'rgba(13,148,136,.12)' : 'rgba(244,63,94,.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={portalOpen ? 'var(--brand)' : 'var(--danger)'} strokeWidth="2" strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Parent Portal</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                {portalOpen
                  ? 'Parents can log in and view their children\'s records'
                  : 'Portal is closed — parents cannot access the system'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
              padding: '3px 10px', borderRadius: 99,
              color: portalOpen ? 'var(--brand)' : 'var(--danger)',
              background: portalOpen ? 'rgba(13,148,136,.12)' : 'rgba(244,63,94,.1)',
              border: `1px solid ${portalOpen ? 'rgba(13,148,136,.25)' : 'rgba(244,63,94,.2)'}`,
            }}>
              {portalOpen ? 'Open' : 'Closed'}
            </span>
            {portalLoading ? (
              <div style={{ width: 48, height: 26, borderRadius: 99, background: 'var(--border)' }} />
            ) : (
              <ToggleSwitch
                checked={portalOpen ?? true}
                onChange={handlePortalToggle}
                disabled={togglePortal.isPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Active year */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>Active Academic Year</div>
        {yearsLoading ? (
          <LoadingSpinner size={16} />
        ) : activeYear ? (
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{(activeYear as any).name}</div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--txt3)', fontStyle: 'italic' }}>No active year set</div>
        )}
      </div>

      {/* ── End-of-year student promotion ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>End-of-Year: Promote Students</div>
        <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
          Advance students to the next class at the end of the academic year. Use the selective flow to review and choose
          which students to promote, or use the bulk option to promote everyone at once.
        </div>

        {promoteResult && (
          <div style={{ background: 'rgba(16,185,129,.08)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--success)', fontWeight: 600, border: '1px solid rgba(16,185,129,.2)' }}>
            Done: {promoteResult.promoted} promoted · {promoteResult.completed} completed
            {promoteResult.total != null ? ` · ${promoteResult.total} total` : ''}
          </div>
        )}

        {/* Selective promotion flow */}
        {showSelectiveFlow ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>Selective Promotion</div>
              <button
                onClick={() => { setShowSelectiveFlow(false); setPromoteResult(null) }}
                style={{ fontSize: 12, color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
            <SelectivePromotionPanel
              onDone={result => {
                setPromoteResult(result)
                setShowSelectiveFlow(false)
                ok(`Promoted ${result.promoted} students. ${result.completed} completed.`)
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="sui-btn-primary"
              onClick={() => { setShowSelectiveFlow(true); setPromoteResult(null) }}
              disabled={promote.isPending}
            >
              Selective Promotion
            </button>
            <button
              className="sui-btn-ghost"
              disabled={promote.isPending}
              onClick={() => setShowPromoteConfirm(true)}
              style={{ fontSize: 12 }}
            >
              {promote.isPending ? 'Promoting…' : 'Promote All Students'}
            </button>
          </div>
        )}

        {/* Bulk promote progress */}
        {promote.isPending && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--brand)', transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Promoting… {progress}%</div>
          </div>
        )}
      </div>

      {/* Storage */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>Storage Buckets</div>
        </div>
        {bucketsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><LoadingSpinner size="sm" /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Bucket', 'Files', 'Size (MB)'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No buckets found.</td></tr>
              ) : buckets.map(b => (
                <tr key={b.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>{b.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>{b.fileCount}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>{b.sizeMb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
