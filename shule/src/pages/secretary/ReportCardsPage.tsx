import { useState, useEffect } from 'react'
import JSZip from 'jszip'
import {
  useReportCards,
  useStudentReadiness,
  useGenerateReportCards,
  useNotifyPrincipal,
} from '../../hooks/useReportCards'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'
import type { ReadinessStatus, StudentReadiness } from '../../hooks/useReportCards'
import type { ReportCard } from '../../types/app'

// ── Inline SVG icons ───────────────────────────────────────────
function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IconSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}
function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}
function IconExternal() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

// ── Readiness badge ────────────────────────────────────────────
function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  const map: Record<ReadinessStatus, { bg: string; color: string; dot: string; label: string }> = {
    ready:           { bg: 'rgba(16,185,129,0.1)',  color: 'var(--success)', dot: 'var(--success)', label: 'Ready' },
    missing_marks:   { bg: 'rgba(245,158,11,0.1)',  color: 'var(--warning)', dot: 'var(--warning)', label: 'Missing Marks' },
    missing_remarks: { bg: 'rgba(245,158,11,0.1)',  color: 'var(--warning)', dot: 'var(--warning)', label: 'Missing Remarks' },
    not_ready:       { bg: 'rgba(244,63,94,0.1)',   color: 'var(--danger)',  dot: 'var(--danger)',  label: 'Not Ready' },
  }
  const { bg, color, dot, label } = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      background: bg, color,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── RC status badge ────────────────────────────────────────────
function RCStatusBadge({ status }: { status: ReportCard['status'] }) {
  const map: Record<ReportCard['status'], { bg: string; color: string; dot: string; label: string }> = {
    draft:    { bg: 'rgba(148,163,184,0.15)', color: 'var(--txt3)',    dot: 'var(--txt3)',    label: 'Draft' },
    ready:    { bg: 'rgba(16,185,129,0.1)',   color: 'var(--success)', dot: 'var(--success)', label: 'Ready' },
    approved: { bg: 'rgba(14,165,233,0.1)',   color: 'var(--info)',    dot: 'var(--info)',    label: 'Approved' },
    released: { bg: 'rgba(13,148,136,0.1)',   color: 'var(--brand)',   dot: 'var(--brand)',   label: 'Released' },
  }
  const { bg, color, dot, label } = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      background: bg, color,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── Styled select ──────────────────────────────────────────────
interface SelectOption { value: string; label: string }
function GlassSelect({
  value, onChange, options, disabled, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          appearance: 'none',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '8px 36px 8px 12px',
          fontSize: 13,
          color: value ? 'var(--txt)' : 'var(--txt3)',
          fontFamily: 'var(--font)',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          minWidth: 130,
          outline: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'border-color 0.15s',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--txt3)' }}>
        <IconChevron />
      </span>
    </div>
  )
}

// ── Animated progress bar ──────────────────────────────────────
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 600 }}>Generating report cards…</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--brand)', fontWeight: 700 }}>{done}/{total}</span>
      </div>
      <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'linear-gradient(90deg, var(--brand), var(--info))',
          width: `${pct}%`,
          transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 0 8px rgba(13,148,136,0.4)',
        }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--txt3)', textAlign: 'right' }}>{pct}% complete</div>
    </div>
  )
}

// ── Initials avatar ────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0d9488,#0ea5e9)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#f59e0b,#f43f5e)',
  'linear-gradient(135deg,#10b981,#0d9488)',
  'linear-gradient(135deg,#0ea5e9,#8b5cf6)',
  'linear-gradient(135deg,#f43f5e,#f59e0b)',
]

function InitialsAvatar({ firstName, lastName, size = 40, ready = false }: {
  firstName: string; lastName: string; size?: number; ready?: boolean
}) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const idx = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % AVATAR_GRADIENTS.length
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: AVATAR_GRADIENTS[idx],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: size * 0.36,
        fontFamily: 'var(--font2)',
        boxShadow: ready ? '0 0 0 2.5px #fff, 0 0 0 4.5px var(--success)' : '0 2px 8px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.2s',
      }}>
        {initials}
      </div>
      {ready && (
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--success)',
          border: '2px solid var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      )}
    </div>
  )
}

// ── Generation overlay ─────────────────────────────────────────
function GeneratingOverlay({ progress }: { progress: { done: number; total: number } }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(7,13,26,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20,
        padding: '40px 48px', maxWidth: 420, width: '90%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--brand), var(--info))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', color: '#fff',
          boxShadow: '0 8px 24px rgba(13,148,136,0.35)',
        }}>
          <IconDoc />
        </div>
        <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 18, color: 'var(--txt)', margin: '0 0 6px' }}>
          Generating Report Cards
        </h3>
        <p style={{ fontSize: 13, color: 'var(--txt3)', margin: '0 0 28px', lineHeight: 1.6 }}>
          Building PDF documents and uploading to secure storage…
        </p>
        <ProgressBar done={progress.done} total={progress.total} />
      </div>
    </div>
  )
}

// ── Stat chip (hero) ───────────────────────────────────────────
function StatChip({ label, value, color = '#fff' }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
      borderRadius: 12, padding: '10px 18px',
      border: '1px solid rgba(255,255,255,0.2)',
      textAlign: 'center', minWidth: 80,
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'var(--font2)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export function ReportCardsPage() {
  const [activeTab, setActiveTab] = useState<'readiness' | 'cards'>('readiness')
  const [term,     setTerm]     = useState<string>('')
  const [year,     setYear]     = useState<string>(String(new Date().getFullYear()))
  const [classId,  setClassId]  = useState<string>('')
  const [streamId, setStreamId] = useState<string>('')
  const [cardStatus, setCardStatus] = useState<string>('all')

  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [progress,  setProgress]  = useState<{ done: number; total: number } | null>(null)
  const [genResult, setGenResult] = useState<{ success: number; failed: number } | null>(null)

  useEffect(() => { setSelected(new Set()) }, [term, year, classId, streamId])

  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams(classId || null)
  const generate                = useGenerateReportCards()
  const notify                  = useNotifyPrincipal()
  const { success: ok }         = useToast()

  const cohortReady = !!term && !!classId

  const { data: readiness = [], isLoading: readinessLoading } = useStudentReadiness({
    term:     cohortReady ? term     : null,
    year:     cohortReady ? Number(year) : null,
    classId:  cohortReady ? classId  : null,
    streamId: cohortReady ? (streamId || null) : null,
  })

  const { data: reportCards = [] } = useReportCards({
    term:     term || '1',
    year:     Number(year),
    classId:  classId  || undefined,
    streamId: streamId || undefined,
  }, cohortReady)

  const rcMap = new Map(reportCards.map(c => [c.studentId, c]))

  const readyStudents  = readiness.filter(r => r.status === 'ready')
  const selectedReady  = Array.from(selected).filter(id => readiness.find(r => r.studentId === id && r.status === 'ready'))

  // Hero stats
  const totalStudents   = readiness.length
  const readyToGenerate = readyStudents.length
  const generatedCount  = reportCards.length
  const releasedCount   = reportCards.filter(c => c.status === 'released').length

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAllReady() { setSelected(new Set(readyStudents.map(r => r.studentId))) }
  function clearSelection()  { setSelected(new Set()) }

  async function handleGenerate() {
    if (selectedReady.length === 0 || !classId || !term) return
    setProgress({ done: 0, total: selectedReady.length })
    setGenResult(null)

    const results = await generate.mutateAsync({
      studentIds: selectedReady,
      term:       Number(term),
      year:       Number(year),
      classId,
      streamId:   streamId || null,
      onProgress: (done, total) => setProgress({ done, total }),
    })

    const success = results.filter(r => r.success).length
    const failed  = results.filter(r => !r.success).length
    setGenResult({ success, failed })
    setProgress(null)
    setSelected(new Set())
  }

  async function handleDownloadAll() {
    const readyCards = reportCards.filter(c =>
      ['ready', 'approved', 'released'].includes(c.status) && c.pdfUrl
    )
    if (readyCards.length === 0) return

    const zip = new JSZip()
    await Promise.all(readyCards.map(async card => {
      const resp = await fetch(card.pdfUrl!)
      const blob = await resp.blob()
      const studentRow = readiness.find(r => r.studentId === card.studentId)
      const name = studentRow
        ? `${studentRow.lastName}_${studentRow.firstName}.pdf`
        : `${card.studentId}.pdf`
      zip.file(name, blob)
    }))

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url     = URL.createObjectURL(zipBlob)
    const a       = document.createElement('a')
    a.href        = url
    a.download    = `report_cards_term${term}_${year}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSendForApproval() {
    const count = reportCards.filter(c => c.status === 'ready').length
    if (count === 0) return
    await notify.mutateAsync({ term: Number(term), year: Number(year), count })
    ok(`Principal notified — ${count} report card${count !== 1 ? 's' : ''} sent for approval.`)
  }

  const yearOptions: SelectOption[] = [0, 1, 2].map(offset => {
    const y = new Date().getFullYear() - offset
    return { value: String(y), label: String(y) }
  })

  const filteredCards = cardStatus === 'all'
    ? reportCards
    : reportCards.filter(c => c.status === cardStatus)

  const hasDownloads = reportCards.some(c => ['ready', 'approved', 'released'].includes(c.status) && c.pdfUrl)
  const readyCount   = reportCards.filter(c => c.status === 'ready').length

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {progress && <GeneratingOverlay progress={progress} />}

      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }} className="sui-page-enter">

        {/* ── Hero Band ──────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)',
          borderRadius: 18, padding: '28px 32px',
          marginBottom: 28, position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative background circles */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 10, right: 180, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', position: 'relative' }}>
            {/* Title + stats */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  <IconDoc />
                </div>
                <div>
                  <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
                    Report Cards
                  </h1>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0' }}>
                    Generate and track report cards through the approval pipeline
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatChip label="Total Students" value={totalStudents} />
                <StatChip label="Ready to Generate" value={readyToGenerate} color="#a7f3d0" />
                <StatChip label="Generated" value={generatedCount} color="#bae6fd" />
                <StatChip label="Released" value={releasedCount} color="#fde68a" />
              </div>
            </div>

            {/* Hero actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignSelf: 'center' }}>
              <button
                onClick={handleGenerate}
                disabled={selectedReady.length === 0 || generate.isPending || !cohortReady}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: selectedReady.length > 0 && cohortReady ? '#fff' : 'rgba(255,255,255,0.35)',
                  color: selectedReady.length > 0 && cohortReady ? 'var(--brand-dark)' : 'rgba(255,255,255,0.7)',
                  border: 'none', borderRadius: 10, padding: '10px 18px',
                  fontWeight: 700, fontSize: 13, fontFamily: 'var(--font2)',
                  cursor: selectedReady.length === 0 || !cohortReady ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                }}
              >
                {generate.isPending ? <IconSpinner /> : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                )}
                Generate Ready Cards
                {selectedReady.length > 0 && (
                  <span style={{ background: 'var(--brand)', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>
                    {selectedReady.length}
                  </span>
                )}
              </button>

              <button
                onClick={handleSendForApproval}
                disabled={notify.isPending || readyCount === 0 || !cohortReady}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                  color: '#fff', border: '1.5px solid rgba(255,255,255,0.35)',
                  borderRadius: 10, padding: '10px 18px',
                  fontWeight: 700, fontSize: 13, fontFamily: 'var(--font2)',
                  cursor: readyCount === 0 || !cohortReady ? 'not-allowed' : 'pointer',
                  opacity: readyCount === 0 || !cohortReady ? 0.55 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {notify.isPending ? <IconSpinner /> : <IconBell />}
                Notify Principal
                {readyCount > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>
                    {readyCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Cohort filters ─────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)', padding: '16px 20px',
          marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>
            Cohort
          </span>
          <GlassSelect value={year} onChange={setYear} options={yearOptions} />
          <GlassSelect
            value={term} onChange={setTerm}
            options={[{ value: '1', label: 'Term 1' }, { value: '2', label: 'Term 2' }, { value: '3', label: 'Term 3' }]}
            placeholder="Select term"
          />
          <GlassSelect
            value={classId} onChange={v => { setClassId(v); setStreamId('') }}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select class"
          />
          <GlassSelect
            value={streamId} onChange={setStreamId}
            options={streams.map(s => ({ value: s.id, label: s.name }))}
            placeholder="All streams"
            disabled={!classId}
          />
          {!cohortReady && (
            <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, marginLeft: 4 }}>
              Select a term and class to continue
            </span>
          )}
        </div>

        {/* ── Pill tab navigation ────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, background: 'var(--surface)',
          borderRadius: 12, padding: 5, border: '1px solid var(--border)',
          marginBottom: 20, width: 'fit-content',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {(['readiness', 'cards'] as const).map(tab => {
            const active = activeTab === tab
            const labels = { readiness: 'Readiness Check', cards: 'Generated Cards' }
            const counts = { readiness: readiness.length, cards: reportCards.length }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px', borderRadius: 9, border: 'none',
                  fontSize: 13, fontWeight: 700, fontFamily: 'var(--font2)',
                  cursor: 'pointer', transition: 'all 0.18s',
                  background: active ? 'linear-gradient(135deg, var(--brand), var(--info))' : 'transparent',
                  color: active ? '#fff' : 'var(--txt2)',
                  boxShadow: active ? '0 2px 10px rgba(13,148,136,0.3)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                {labels[tab]}
                {counts[tab] > 0 && (
                  <span style={{
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface2)',
                    color: active ? '#fff' : 'var(--txt3)',
                    borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>
                    {counts[tab]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Tab: Readiness Check ──────────────────────────────── */}
        {activeTab === 'readiness' && (
          <div style={{ animation: 'slide-up 0.2s ease' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', margin: 0 }}>
                  Student Readiness
                </h2>
                {readiness.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--txt3)', margin: '3px 0 0' }}>
                    {readyStudents.length} of {readiness.length} students ready to generate
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {readyStudents.length > 0 && (
                  <button
                    onClick={selectAllReady}
                    style={{
                      background: 'var(--surface)', border: '1.5px solid var(--border)',
                      borderRadius: 9, padding: '7px 14px', fontSize: 12,
                      fontWeight: 700, fontFamily: 'var(--font2)', color: 'var(--txt2)', cursor: 'pointer',
                    }}
                  >
                    Select All Ready ({readyStudents.length})
                  </button>
                )}
                {selected.size > 0 && (
                  <button
                    onClick={clearSelection}
                    style={{
                      background: 'transparent', border: '1.5px solid var(--border)',
                      borderRadius: 9, padding: '7px 14px', fontSize: 12,
                      fontWeight: 700, color: 'var(--txt3)', cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Overall readiness progress bar */}
            {readiness.length > 0 && (
              <div style={{
                background: 'var(--surface)', borderRadius: 14, padding: '14px 20px',
                border: '1px solid var(--border)', marginBottom: 14,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)' }}>Overall Readiness</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font3)', fontWeight: 700, color: 'var(--success)' }}>
                    {readyStudents.length}/{readiness.length}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(90deg, var(--success), var(--brand))',
                    width: readiness.length > 0 ? `${(readyStudents.length / readiness.length) * 100}%` : '0%',
                    transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
              </div>
            )}

            {/* Student list */}
            {!cohortReady ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)',
                padding: '48px 24px', textAlign: 'center',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--txt3)' }}>
                  <IconDoc />
                </div>
                <p style={{ fontSize: 14, color: 'var(--txt3)', fontWeight: 500, margin: 0 }}>
                  Select a term and class above to view student readiness
                </p>
              </div>
            ) : readinessLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="shule-skeleton" style={{ height: 76, borderRadius: 14 }} />
                ))}
              </div>
            ) : readiness.length === 0 ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)',
                padding: '48px 24px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, color: 'var(--txt3)', fontWeight: 500, margin: 0 }}>
                  No students found in this cohort.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="stagger-cards">
                {readiness.map((row: StudentReadiness) => {
                  const isReady   = row.status === 'ready'
                  const isChecked = selected.has(row.studentId)
                  const rc        = rcMap.get(row.studentId)

                  return (
                    <div
                      key={row.studentId}
                      onClick={() => isReady && toggleSelect(row.studentId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        background: isChecked ? 'rgba(13,148,136,0.06)' : 'var(--surface)',
                        border: isChecked ? '1.5px solid rgba(13,148,136,0.35)' : '1px solid var(--border)',
                        borderRadius: 14, padding: '14px 18px',
                        cursor: isReady ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                        boxShadow: isChecked ? '0 0 0 3px rgba(13,148,136,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 18, height: 18, borderRadius: 5,
                        border: isChecked ? 'none' : '2px solid var(--border)',
                        background: isChecked ? 'var(--brand)' : 'transparent',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', opacity: isReady ? 1 : 0.3, transition: 'all 0.15s',
                      }}>
                        {isChecked && <IconCheck />}
                      </div>

                      {/* Avatar */}
                      <InitialsAvatar firstName={row.firstName} lastName={row.lastName} size={42} ready={isReady} />

                      {/* Student info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 2 }}>
                          {row.firstName} {row.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                          {row.admissionNumber}
                        </div>
                        {row.issues.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, fontWeight: 600 }}>
                            {row.issues.join(' · ')}
                          </div>
                        )}
                      </div>

                      {/* Readiness badge */}
                      <ReadinessBadge status={row.status} />

                      {/* RC status + preview */}
                      <div style={{ flexShrink: 0, minWidth: 110, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        {rc ? (
                          <>
                            <RCStatusBadge status={rc.status} />
                            {rc.pdfUrl && (
                              <button
                                onClick={e => { e.stopPropagation(); window.open(rc.pdfUrl!, '_blank') }}
                                style={{
                                  background: 'var(--surface2)', border: '1px solid var(--border)',
                                  borderRadius: 7, padding: '4px 9px',
                                  color: 'var(--txt2)', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
                                }}
                                title="Preview PDF"
                              >
                                <IconExternal />
                                Preview
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Generation result banner */}
            {genResult && (
              <div style={{
                marginTop: 14,
                background: genResult.failed === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1.5px solid ${genResult.failed === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                borderRadius: 12, padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: genResult.failed === 0 ? 'var(--success)' : 'var(--warning)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', flexShrink: 0,
                }}>
                  <IconCheck />
                </div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                    Generation complete
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{genResult.success} generated successfully</span>
                    {genResult.failed > 0 && (
                      <span style={{ color: 'var(--danger)', marginLeft: 10, fontWeight: 600 }}>{genResult.failed} failed</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Generated Cards ──────────────────────────────── */}
        {activeTab === 'cards' && (
          <div style={{ animation: 'slide-up 0.2s ease' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', margin: 0 }}>
                  Generated Cards
                </h2>
                <p style={{ fontSize: 12, color: 'var(--txt3)', margin: '3px 0 0' }}>
                  Track report cards through the approval pipeline
                </p>
              </div>
              {hasDownloads && (
                <button
                  onClick={handleDownloadAll}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'var(--surface)', border: '1.5px solid var(--border)',
                    borderRadius: 10, padding: '8px 16px',
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font2)',
                    color: 'var(--txt2)', cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'all 0.15s',
                  }}
                >
                  <IconDownload />
                  Download All Released (ZIP)
                </button>
              )}
            </div>

            {/* Status pill filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {(['all', 'draft', 'ready', 'approved', 'released'] as const).map(s => {
                const active = cardStatus === s
                const label  = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
                const count  = s === 'all' ? reportCards.length : reportCards.filter(c => c.status === s).length
                return (
                  <button
                    key={s}
                    onClick={() => setCardStatus(s)}
                    style={{
                      padding: '6px 14px', borderRadius: 99, fontSize: 12,
                      fontWeight: 700, fontFamily: 'var(--font2)',
                      border: active ? 'none' : '1.5px solid var(--border)',
                      background: active ? 'linear-gradient(135deg, var(--brand), var(--info))' : 'var(--surface)',
                      color: active ? '#fff' : 'var(--txt2)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: active ? '0 2px 8px rgba(13,148,136,0.25)' : 'none',
                    }}
                  >
                    {label}{count > 0 ? ` (${count})` : ''}
                  </button>
                )
              })}
            </div>

            {/* Cards grid */}
            {!cohortReady ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)',
                padding: '48px 24px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, color: 'var(--txt3)', fontWeight: 500, margin: 0 }}>
                  Select a term and class above to view generated report cards
                </p>
              </div>
            ) : filteredCards.length === 0 ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)',
                padding: '48px 24px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, color: 'var(--txt3)', fontWeight: 500, margin: 0 }}>
                  {reportCards.length === 0 ? 'No report cards generated yet for this cohort.' : 'No cards match this filter.'}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }} className="stagger-cards">
                {filteredCards.map((card: ReportCard) => {
                  const studentRow = readiness.find(r => r.studentId === card.studentId)
                  const name       = studentRow ? `${studentRow.firstName} ${studentRow.lastName}` : 'Unknown Student'
                  const firstName  = studentRow?.firstName ?? 'U'
                  const lastName   = studentRow?.lastName  ?? 'S'
                  const generatedDate = card.generatedAt
                    ? new Date(card.generatedAt).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
                    : null

                  return (
                    <div
                      key={card.id}
                      style={{
                        background: 'var(--surface)', borderRadius: 14,
                        border: '1px solid var(--border)',
                        padding: '16px 18px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        transition: 'box-shadow 0.15s, transform 0.15s',
                        display: 'flex', flexDirection: 'column', gap: 12,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
                        el.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
                        el.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <InitialsAvatar firstName={firstName} lastName={lastName} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </div>
                          {studentRow && (
                            <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                              {studentRow.admissionNumber}
                            </div>
                          )}
                        </div>
                        <RCStatusBadge status={card.status} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
                          {generatedDate ? `Generated ${generatedDate}` : 'Not yet generated'}
                        </span>
                        {card.pdfUrl && (
                          <button
                            onClick={() => window.open(card.pdfUrl!, '_blank')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: card.status === 'released' ? 'rgba(13,148,136,0.1)' : 'var(--surface2)',
                              border: `1px solid ${card.status === 'released' ? 'rgba(13,148,136,0.25)' : 'var(--border)'}`,
                              borderRadius: 7, padding: '5px 10px',
                              color: card.status === 'released' ? 'var(--brand)' : 'var(--txt2)',
                              cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
                            }}
                          >
                            <IconDownload />
                            {card.status === 'released' ? 'Download' : 'Preview'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
