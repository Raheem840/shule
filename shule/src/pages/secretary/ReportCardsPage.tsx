import { useState, useEffect } from 'react'
import JSZip from 'jszip'
import {
  useReportCards,
  useStudentReadiness,
  useGenerateReportCards,
  useNotifyPrincipal,
} from '../../hooks/useReportCards'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { ReadinessStatus, StudentReadiness } from '../../hooks/useReportCards'
import type { ReportCard } from '../../types/app'

// ── Readiness badge ────────────────────────────────────────────
function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  const map: Record<ReadinessStatus, { variant: 'green'|'amber'|'red'|'muted'; label: string }> = {
    ready:           { variant: 'green', label: '✅ Ready' },
    missing_marks:   { variant: 'amber', label: '⚠ Missing Marks' },
    missing_remarks: { variant: 'amber', label: '⚠ Missing Remarks' },
    not_ready:       { variant: 'red',   label: '❌ Cannot Generate' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

// ── Report card status badge ───────────────────────────────────
function RCStatusBadge({ status }: { status: ReportCard['status'] }) {
  const map: Record<ReportCard['status'], { variant: 'muted'|'green'|'blue'|'teal'; label: string }> = {
    draft:    { variant: 'muted', label: 'Draft' },
    ready:    { variant: 'green', label: 'Ready' },
    approved: { variant: 'blue',  label: 'Approved' },
    released: { variant: 'teal',  label: 'Released' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

// ── Progress bar ───────────────────────────────────────────────
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--txt2)', marginBottom: 4 }}>
        <span>Generating report cards…</span>
        <span>{done} / {total}</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
          width: `${pct}%`, transition: 'width 0.25s',
        }} />
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export function ReportCardsPage() {
  const [term,     setTerm]     = useState<string>('')
  const [year,     setYear]     = useState<string>(String(new Date().getFullYear()))
  const [classId,  setClassId]  = useState<string>('')
  const [streamId, setStreamId] = useState<string>('')

  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [progress,  setProgress]  = useState<{ done: number; total: number } | null>(null)
  const [genResult, setGenResult] = useState<{ success: number; failed: number } | null>(null)

  // Clear selection whenever the cohort changes to avoid stale IDs
  useEffect(() => { setSelected(new Set()) }, [term, year, classId, streamId])

  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams(classId || null)
  const generate                = useGenerateReportCards()
  const notify                  = useNotifyPrincipal()

  const cohortReady = !!term && !!classId

  const { data: readiness = [], isLoading: readinessLoading } = useStudentReadiness({
    term:     cohortReady ? term     : null,
    year:     cohortReady ? Number(year) : null,
    classId:  cohortReady ? classId  : null,
    streamId: cohortReady ? (streamId || null) : null,
  })

  const { data: reportCards = [] } = useReportCards({
    term:     Number(term) || 1,
    year:     Number(year),
    classId:  classId  || undefined,
    streamId: streamId || undefined,
  })

  const rcMap = new Map(reportCards.map(c => [c.studentId, c]))

  const readyStudents   = readiness.filter(r => r.status === 'ready')
  const selectedReady   = Array.from(selected).filter(id => readiness.find(r => r.studentId === id && r.status === 'ready'))

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAllReady() {
    setSelected(new Set(readyStudents.map(r => r.studentId)))
  }

  function clearSelection() { setSelected(new Set()) }

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
      ['ready','approved','released'].includes(c.status) && c.pdfUrl
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
    alert(`Principal notified — ${count} report card(s) awaiting approval.`)
  }

  const yearOptions = [0, 1, 2].map(offset => {
    const y = new Date().getFullYear() - offset
    return { value: String(y), label: String(y) }
  })

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Report Cards"
        subtitle="Generate, preview, and submit CBC report cards for approval."
      />

      {/* ── Cohort selector ───────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 14,
        border: '1px solid var(--border)', padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 12, fontFamily: 'var(--font2)' }}>
          Step 1 — Select Cohort
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Select value={year} onChange={setYear} options={yearOptions} style={{ minWidth: 110 }} />
          <Select value={term} onChange={setTerm}
            options={[{ value: '', label: 'Select term' }, { value: '1', label: 'Term 1' }, { value: '2', label: 'Term 2' }, { value: '3', label: 'Term 3' }]}
            style={{ minWidth: 120 }}
          />
          <Select value={classId} onChange={setClassId}
            options={[{ value: '', label: 'Select class' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
            style={{ minWidth: 140 }}
          />
          <Select value={streamId} onChange={setStreamId}
            options={[{ value: '', label: 'All streams' }, ...streams.map(s => ({ value: s.id, label: s.name }))]}
            disabled={!classId}
            style={{ minWidth: 130 }}
          />
        </div>
      </div>

      {/* ── Student readiness table ───────────────────────────── */}
      {cohortReady && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
              Step 2 — Student Readiness
              {readiness.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--txt3)' }}>
                  ({readyStudents.length}/{readiness.length} ready)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {readyStudents.length > 0 && (
                <Button size="sm" variant="secondary" onClick={selectAllReady}>
                  Select All Ready ({readyStudents.length})
                </Button>
              )}
              {selected.size > 0 && (
                <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
              )}
              <Button
                variant="primary"
                onClick={handleGenerate}
                loading={generate.isPending}
                disabled={selectedReady.length === 0 || generate.isPending}
              >
                Generate Selected ({selectedReady.length})
              </Button>
            </div>
          </div>

          {readinessLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <LoadingSpinner size={24} />
            </div>
          ) : readiness.length === 0 ? (
            <div style={{ padding: '24px 16px', color: 'var(--txt3)', fontSize: 13, textAlign: 'center' }}>
              No students found for this cohort.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 160px 200px 120px',
                padding: '8px 16px', background: 'var(--surface2)',
                borderBottom: '1px solid var(--border)',
                fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                textTransform: 'uppercase', letterSpacing: 0.5,
                fontFamily: 'var(--font2)',
              }}>
                <div />
                <div>Student</div>
                <div>Adm. No</div>
                <div>Status</div>
                <div>Report Card</div>
              </div>

              {readiness.map((row: StudentReadiness) => {
                const isReady  = row.status === 'ready'
                const isChecked = selected.has(row.studentId)
                const rc       = rcMap.get(row.studentId)

                return (
                  <div key={row.studentId} style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 160px 200px 120px',
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                    background: isChecked ? 'rgba(13,148,136,0.04)' : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => isReady && toggleSelect(row.studentId)}
                      disabled={!isReady}
                      style={{ width: 16, height: 16, cursor: isReady ? 'pointer' : 'default', accentColor: 'var(--brand)' }}
                    />
                    <div style={{ fontWeight: 600, color: 'var(--txt)', fontSize: 13 }}>
                      {row.firstName} {row.lastName}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--txt3)' }}>
                      {row.admissionNumber}
                    </div>
                    <div>
                      <ReadinessBadge status={row.status} />
                      {row.issues.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>
                          {row.issues.join(' · ')}
                        </div>
                      )}
                    </div>
                    <div>
                      {rc ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <RCStatusBadge status={rc.status} />
                          {rc.pdfUrl && (
                            <button
                              onClick={() => window.open(rc.pdfUrl!, '_blank')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 11, fontWeight: 700 }}
                            >
                              Preview
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Progress bar */}
          {progress && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <ProgressBar done={progress.done} total={progress.total} />
            </div>
          )}

          {/* Generation result */}
          {genResult && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ {genResult.success} generated</span>
              {genResult.failed > 0 && (
                <span style={{ color: 'var(--danger)', marginLeft: 12, fontWeight: 700 }}>
                  ✗ {genResult.failed} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      {cohortReady && reportCards.length > 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)', padding: 20,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)', fontFamily: 'var(--font2)', flex: 1 }}>
            Step 3 — Approval Workflow
          </div>
          <Button variant="secondary" onClick={handleDownloadAll}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download All (ZIP)
          </Button>
          <Button variant="primary" onClick={handleSendForApproval} loading={notify.isPending}>
            Send for Approval
          </Button>
        </div>
      )}
    </div>
  )
}
