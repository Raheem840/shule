import { useState, useEffect, useRef } from 'react'
import {
  useReportCards,
  useStudentReadiness,
  useApproveReportCard,
  useReleaseReportCard,
  useUnlockReportCard,
} from '../../hooks/useReportCards'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Modal, ModalCancelButton } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { ReportCard } from '../../types/app'


// ── Unlock Confirmation Modal ──────────────────────────────────
function UnlockModal({ card, studentName, onClose }: {
  card:        ReportCard
  studentName: string
  onClose:     () => void
}) {
  const [reason, setReason] = useState('')
  const unlock = useUnlockReportCard()

  async function handleUnlock() {
    if (!reason.trim()) return
    await unlock.mutateAsync({ reportCardId: card.id, unlockReason: reason.trim() })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Unlock Report Card — ${studentName}`} size="sm"
      footer={
        <>
          <ModalCancelButton onClose={onClose} />
          <Button variant="danger" onClick={handleUnlock} loading={unlock.isPending} disabled={!reason.trim()}>
            Unlock (Revert to Draft)
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
          Unlocking will revert this report card to Draft status. The secretary will need to regenerate it.
          This action is logged.
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          Reason for unlocking (required)
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Incorrect marks were entered for Mathematics."
            style={{
              padding: '8px 10px', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 13, resize: 'vertical',
              background: 'var(--surface)', color: 'var(--txt)',
              fontFamily: 'var(--font1)',
            }}
          />
        </label>
      </div>
    </Modal>
  )
}

// ── Approve Modal ──────────────────────────────────────────────
function ApproveModal({ card, studentName, onClose }: {
  card:        ReportCard
  studentName: string
  onClose:     () => void
}) {
  const [remarks, setRemarks] = useState(card.principalRemarks ?? '')
  const approve = useApproveReportCard()

  async function handleApprove() {
    await approve.mutateAsync({
      reportCardId:    card.id,
      principalRemarks: remarks.trim() || null,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Approve Report Card — ${studentName}`} size="sm"
      footer={
        <>
          <ModalCancelButton onClose={onClose} />
          <Button variant="primary" onClick={handleApprove} loading={approve.isPending}>
            Approve
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          Principal's Remarks (optional — will appear on the PDF)
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={3}
            placeholder="Write a brief remark for the student..."
            style={{
              padding: '8px 10px', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 13, resize: 'vertical',
              background: 'var(--surface)', color: 'var(--txt)',
              fontFamily: 'var(--font1)',
            }}
          />
        </label>
      </div>
    </Modal>
  )
}

// ── Bulk Approve Modal ─────────────────────────────────────────
function BulkApproveModal({ count, onConfirm, onClose, loading }: {
  count:     number
  onConfirm: (remarks: string | null) => void
  onClose:   () => void
  loading:   boolean
}) {
  const [remarks, setRemarks] = useState('')
  return (
    <Modal open onClose={onClose} title={`Approve ${count} Report Card${count !== 1 ? 's' : ''}`} size="sm"
      footer={
        <>
          <ModalCancelButton onClose={onClose} />
          <Button variant="primary" onClick={() => onConfirm(remarks.trim() || null)} loading={loading}>
            Approve {count}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
          Approving <strong>{count}</strong> report card{count !== 1 ? 's' : ''}. This cannot be undone without unlocking.
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          Shared principal remarks (optional — applied to all)
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={3}
            placeholder="e.g. Well done on your performance this term."
            style={{
              padding: '8px 10px', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 13, resize: 'vertical',
              background: 'var(--surface)', color: 'var(--txt)',
              fontFamily: 'var(--font1)',
            }}
          />
        </label>
      </div>
    </Modal>
  )
}

// ── RC table ───────────────────────────────────────────────────
type CardTableProps = {
  cards:          ReportCard[]
  studentNameMap: Map<string, string>
  readinessMap:   Map<string, { admissionNumber: string }>
  onApprove?:     (card: ReportCard, name: string) => void
  onRelease?:     (card: ReportCard) => void
  onUnlock?:      (card: ReportCard, name: string) => void
  releaseLoading?: boolean
  emptyMessage:   string
  selectable?:      boolean
  selectedIds?:     Set<string>
  onToggle?:        (id: string) => void
  onToggleAll?:     (ids: string[]) => void
  bulkInProgress?:  boolean
}

function RCTable({
  cards, studentNameMap, readinessMap,
  onApprove, onRelease, onUnlock,
  releaseLoading, emptyMessage,
  selectable, selectedIds, onToggle, onToggleAll,
  bulkInProgress,
}: CardTableProps) {
  if (cards.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 24px',
        background: 'var(--surface)', borderRadius: 14,
        border: '1px dashed var(--border)',
        color: 'var(--txt3)', fontFamily: 'var(--font2)', fontSize: 14, fontWeight: 500,
      }}>
        {emptyMessage}
      </div>
    )
  }

  const allIds    = cards.map(c => c.id)
  const allChecked = selectable && selectedIds && allIds.length > 0 && allIds.every(id => selectedIds.has(id))
  const cols = selectable ? '40px 1fr 160px 120px 200px' : '1fr 160px 120px 200px'

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols,
        padding: '10px 16px', background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
        fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        fontFamily: 'var(--font2)',
      }}>
        {selectable && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={!!allChecked}
              onChange={() => onToggleAll?.(allIds)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand)' }}
            />
          </div>
        )}
        <div>Student</div>
        <div>Adm. No</div>
        <div>PDF</div>
        <div>Actions</div>
      </div>

      {cards.map((card, i) => {
        const name    = studentNameMap.get(card.studentId) ?? card.studentId
        const readRow = readinessMap.get(card.studentId)
        const admNo   = (readRow as { admissionNumber?: string } | undefined)?.admissionNumber ?? '—'
        const checked = selectable && selectedIds?.has(card.id)

        return (
          <div key={card.id} style={{
            display: 'grid',
            gridTemplateColumns: cols,
            padding: '12px 16px',
            borderBottom: i < cards.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'center',
            background: checked ? 'rgba(13,148,136,0.05)' : undefined,
          }}>
            {selectable && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!checked}
                  onChange={() => onToggle?.(card.id)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand)' }}
                />
              </div>
            )}
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>{name}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--txt3)' }}>{admNo}</div>

            {/* PDF preview */}
            <div>
              {card.pdfUrl ? (
                <button
                  onClick={() => window.open(card.pdfUrl!, '_blank')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 12, fontWeight: 700 }}
                >
                  Preview
                </button>
              ) : <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {card.status === 'ready' && onApprove && (
                <Button size="sm" variant="primary"
                  disabled={bulkInProgress}
                  onClick={() => onApprove(card, name)}>
                  Approve
                </Button>
              )}
              {card.status === 'approved' && onRelease && (
                <Button size="sm" variant="primary"
                  loading={releaseLoading}
                  disabled={bulkInProgress}
                  onClick={() => onRelease(card)}>
                  Release
                </Button>
              )}
              {(card.status === 'approved' || card.status === 'released') && onUnlock && (
                <Button size="sm" variant="danger"
                  onClick={() => onUnlock(card, name)}>
                  Unlock
                </Button>
              )}
              {card.principalRemarks && (
                <span title={card.principalRemarks} style={{ fontSize: 11, color: 'var(--txt3)', cursor: 'default' }}>
                  Remarks ✓
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
type PrincipalTab = 'awaiting' | 'approved' | 'released'

export function PrincipalReportCardsPage() {
  const [term,     setTerm]     = useState<string>('')
  const [year,     setYear]     = useState<string>(String(new Date().getFullYear()))
  const [classId,  setClassId]  = useState<string>('')
  const [streamId, setStreamId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<PrincipalTab>('awaiting')

  const [unlockCard,  setUnlockCard]  = useState<{ card: ReportCard; name: string } | null>(null)
  const [approveCard, setApproveCard] = useState<{ card: ReportCard; name: string } | null>(null)
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [bulkAction,     setBulkAction]     = useState<'approve' | 'release' | null>(null)
  const [approveLoading, setApproveLoading] = useState(false)
  const [releaseLoading2, setReleaseLoading2] = useState(false)
  const [bulkError,      setBulkError]      = useState<string | null>(null)
  const bulkInFlight = useRef(false)

  // Clear selection when switching tabs
  useEffect(() => setSelectedIds(new Set()), [activeTab])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(ids: string[]) {
    setSelectedIds(prev => {
      if (ids.every(id => prev.has(id))) return new Set<string>()
      return new Set(ids)
    })
  }

  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams(classId || null)
  const release                 = useReleaseReportCard()
  const approve                 = useApproveReportCard()
  const qc                      = useQueryClient()

  async function handleBulkApprove(remarks: string | null) {
    if (bulkInFlight.current) return
    bulkInFlight.current = true
    setApproveLoading(true)
    setBulkError(null)
    const ids = [...selectedIds]
    try {
      const results = await Promise.allSettled(
        ids.map(id => approve.mutateAsync({ reportCardId: id, principalRemarks: remarks }))
      )
      // Invalidate once after all writes settle — avoids N mid-loop re-fetches
      void qc.invalidateQueries({ queryKey: ['report-cards'] })
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        const succeeded = results.length - failed.length
        setBulkError(`${succeeded} approved, ${failed.length} failed — check permissions and try again for the remaining cards.`)
      } else {
        setBulkAction(null)
        setSelectedIds(new Set())
      }
    } finally {
      setApproveLoading(false)
      bulkInFlight.current = false
    }
  }

  async function handleBulkRelease() {
    if (bulkInFlight.current) return
    bulkInFlight.current = true
    setReleaseLoading2(true)
    setBulkError(null)
    const ids = [...selectedIds]
    try {
      const results = await Promise.allSettled(
        ids.map(id => release.mutateAsync({ reportCardId: id }))
      )
      void qc.invalidateQueries({ queryKey: ['report-cards'] })
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        const succeeded = results.length - failed.length
        setBulkError(`${succeeded} released, ${failed.length} failed — check permissions and try again for the remaining cards.`)
      } else {
        setBulkAction(null)
        setSelectedIds(new Set())
      }
    } finally {
      setReleaseLoading2(false)
      bulkInFlight.current = false
    }
  }

  const cohortReady = !!term && !!classId

  const { data: reportCards = [], isLoading: rcLoading } = useReportCards({
    term:     term || '1',
    year:     Number(year),
    classId:  classId  || undefined,
    streamId: streamId || undefined,
  }, cohortReady)

  const { data: readiness = [] } = useStudentReadiness({
    term:     cohortReady ? term     : null,
    year:     cohortReady ? Number(year) : null,
    classId:  cohortReady ? classId  : null,
    streamId: cohortReady ? (streamId || null) : null,
  })

  // All students to resolve names — only loaded once a class is selected
  const { data: students = [] } = useStudents(
    { classId: classId || undefined, streamId: streamId || undefined },
    cohortReady,
  )

  const studentNameMap = new Map(
    students.map(s => [s.id, `${s.firstName} ${s.lastName}`])
  )

  const readinessMap = new Map(readiness.map(r => [r.studentId, r]))

  // Tab-filtered card sets — draft is excluded from principal view (secretary's concern)
  const awaitingCards  = reportCards.filter(c => c.status === 'ready')
  const approvedCards  = reportCards.filter(c => c.status === 'approved')
  const releasedCards  = reportCards.filter(c => c.status === 'released')

  const yearOptions = [0, 1, 2].map(offset => {
    const y = new Date().getFullYear() - offset
    return { value: String(y), label: String(y) }
  })

  const tabs: { id: PrincipalTab; label: string; count: number; color: string }[] = [
    { id: 'awaiting',  label: 'Awaiting Approval', count: awaitingCards.length,  color: 'var(--success)' },
    { id: 'approved',  label: 'Approved',           count: approvedCards.length,  color: 'var(--info)'    },
    { id: 'released',  label: 'Released',            count: releasedCards.length,  color: 'var(--brand)'   },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* ── Page header ───────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden', marginBottom: 20 }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Report Cards</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Review, approve, and release report cards to students and parents</p>
        </div>
      </div>

      {/* ── Cohort filters ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Select value={year} onChange={e => setYear(e.target.value)} options={yearOptions} style={{ minWidth: 110 }} />
        <Select value={term} onChange={e => setTerm(e.target.value)}
          options={[{ value: '', label: 'Select term' }, { value: '1', label: 'Term 1' }, { value: '2', label: 'Term 2' }, { value: '3', label: 'Term 3' }]}
          style={{ minWidth: 120 }}
        />
        <Select value={classId} onChange={e => { setClassId(e.target.value); setStreamId('') }}
          options={[{ value: '', label: 'Select class' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
          style={{ minWidth: 140 }}
        />
        <Select value={streamId} onChange={e => setStreamId(e.target.value)}
          options={[{ value: '', label: 'All streams' }, ...streams.map(s => ({ value: s.id, label: s.name }))]}
          disabled={!classId}
          style={{ minWidth: 130 }}
        />
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      {!cohortReady ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          color: 'var(--txt3)', fontFamily: 'var(--font2)',
          background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Select a term and class to view report cards</div>
        </div>
      ) : rcLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <LoadingSpinner size={28} />
        </div>
      ) : (
        <>
          {/* Tab navigation */}
          <div style={{
            display: 'flex', gap: 4, background: 'var(--surface)',
            borderRadius: 12, padding: 4, border: '1px solid var(--border)',
            marginBottom: 16, width: 'fit-content',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {tabs.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '7px 16px', borderRadius: 9, border: 'none',
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font2)',
                    cursor: 'pointer', transition: 'all 0.18s',
                    background: active ? 'linear-gradient(135deg, var(--brand), var(--info))' : 'transparent',
                    color: active ? '#fff' : 'var(--txt2)',
                    boxShadow: active ? '0 2px 10px rgba(13,148,136,0.3)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface2)',
                      color: active ? '#fff' : 'var(--txt3)',
                      borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab: Awaiting Approval (status = 'ready' only) */}
          {activeTab === 'awaiting' && (
            <>
              {selectedIds.size > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', marginBottom: 10,
                  background: 'rgba(13,148,136,0.08)', borderRadius: 10,
                  border: '1px solid rgba(13,148,136,0.25)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', flex: 1 }}>
                    {selectedIds.size} selected
                  </span>
                  <Button size="sm" variant="primary"
                    disabled={approveLoading}
                    onClick={() => { setBulkError(null); setBulkAction('approve') }}>
                    Approve Selected ({selectedIds.size})
                  </Button>
                  <button
                    onClick={() => { setSelectedIds(new Set()); setBulkError(null) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--txt3)', padding: '4px 8px' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {bulkError && (
                <div style={{ padding: '10px 14px', marginBottom: 10, background: 'rgba(244,63,94,0.08)', borderRadius: 10, border: '1px solid rgba(244,63,94,0.25)', fontSize: 13, color: 'var(--danger)' }}>
                  {bulkError}
                  <button onClick={() => setBulkError(null)} style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 12 }}>Dismiss</button>
                </div>
              )}
              <RCTable
                cards={awaitingCards}
                studentNameMap={studentNameMap}
                readinessMap={readinessMap}
                onApprove={(card, name) => setApproveCard({ card, name })}
                emptyMessage="No report cards are awaiting approval. The secretary must generate and submit cards first."
                selectable
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onToggleAll={toggleAll}
                bulkInProgress={approveLoading}
              />
            </>
          )}

          {/* Tab: Approved (status = 'approved') */}
          {activeTab === 'approved' && (
            <>
              {selectedIds.size > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', marginBottom: 10,
                  background: 'rgba(14,165,233,0.08)', borderRadius: 10,
                  border: '1px solid rgba(14,165,233,0.25)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--info)', flex: 1 }}>
                    {selectedIds.size} selected
                  </span>
                  <Button size="sm" variant="primary"
                    loading={releaseLoading2}
                    onClick={() => { setBulkError(null); setBulkAction('release') }}>
                    Release Selected ({selectedIds.size})
                  </Button>
                  <button
                    onClick={() => { setSelectedIds(new Set()); setBulkError(null) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--txt3)', padding: '4px 8px' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {bulkError && (
                <div style={{ padding: '10px 14px', marginBottom: 10, background: 'rgba(244,63,94,0.08)', borderRadius: 10, border: '1px solid rgba(244,63,94,0.25)', fontSize: 13, color: 'var(--danger)' }}>
                  {bulkError}
                  <button onClick={() => setBulkError(null)} style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 12 }}>Dismiss</button>
                </div>
              )}
              <RCTable
                cards={approvedCards}
                studentNameMap={studentNameMap}
                readinessMap={readinessMap}
                onRelease={card => release.mutateAsync({ reportCardId: card.id })}
                onUnlock={(card, name) => setUnlockCard({ card, name })}
                releaseLoading={release.isPending}
                emptyMessage="No approved report cards yet. Approve cards from the 'Awaiting Approval' tab."
                selectable
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onToggleAll={toggleAll}
                bulkInProgress={releaseLoading2}
              />
            </>
          )}

          {/* Tab: Released (status = 'released') */}
          {activeTab === 'released' && (
            <RCTable
              cards={releasedCards}
              studentNameMap={studentNameMap}
              readinessMap={readinessMap}
              onUnlock={(card, name) => setUnlockCard({ card, name })}
              emptyMessage="No released report cards yet. Release cards from the 'Approved' tab."
            />
          )}
        </>
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      {approveCard && (
        <ApproveModal
          card={approveCard.card}
          studentName={approveCard.name}
          onClose={() => setApproveCard(null)}
        />
      )}
      {unlockCard && (
        <UnlockModal
          card={unlockCard.card}
          studentName={unlockCard.name}
          onClose={() => setUnlockCard(null)}
        />
      )}
      {bulkAction === 'approve' && (
        <BulkApproveModal
          count={selectedIds.size}
          onConfirm={remarks => { void handleBulkApprove(remarks) }}
          onClose={() => { if (!approveLoading) setBulkAction(null) }}
          loading={approveLoading}
        />
      )}
      {bulkAction === 'release' && (
        <Modal open onClose={() => { if (!releaseLoading2) setBulkAction(null) }}
          title={`Release ${selectedIds.size} Report Card${selectedIds.size !== 1 ? 's' : ''}`} size="sm"
          footer={
            <>
              <ModalCancelButton onClose={() => { if (!releaseLoading2) setBulkAction(null) }} />
              <Button variant="primary" onClick={() => { void handleBulkRelease() }} loading={releaseLoading2}>
                Release {selectedIds.size}
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
            Releasing <strong>{selectedIds.size}</strong> report card{selectedIds.size !== 1 ? 's' : ''} will make them visible to students and parents immediately.
          </div>
        </Modal>
      )}
    </div>
  )
}
