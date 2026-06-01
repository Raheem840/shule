import { useState } from 'react'
import {
  useReportCards,
  useStudentReadiness,
  useApproveReportCard,
  useReleaseReportCard,
  useUnlockReportCard,
} from '../../hooks/useReportCards'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal, ModalCancelButton } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { ReportCard } from '../../types/app'

// ── Status badge ───────────────────────────────────────────────
function RCStatusBadge({ status }: { status: ReportCard['status'] }) {
  const map: Record<ReportCard['status'], { variant: 'muted'|'green'|'blue'|'teal'; label: string }> = {
    draft:    { variant: 'muted', label: 'Draft' },
    ready:    { variant: 'green', label: 'Ready for Review' },
    approved: { variant: 'blue',  label: 'Approved' },
    released: { variant: 'teal',  label: 'Released' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

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

// ── Main Page ──────────────────────────────────────────────────
export function PrincipalReportCardsPage() {
  const [term,     setTerm]     = useState<string>('')
  const [year,     setYear]     = useState<string>(String(new Date().getFullYear()))
  const [classId,  setClassId]  = useState<string>('')
  const [streamId, setStreamId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const [unlockCard,  setUnlockCard]  = useState<{ card: ReportCard; name: string } | null>(null)
  const [approveCard, setApproveCard] = useState<{ card: ReportCard; name: string } | null>(null)

  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams(classId || null)
  const release                 = useReleaseReportCard()

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

  const filteredCards = reportCards.filter(c =>
    !statusFilter || c.status === statusFilter
  )

  const yearOptions = [0, 1, 2].map(offset => {
    const y = new Date().getFullYear() - offset
    return { value: String(y), label: String(y) }
  })

  // Stats
  const countByStatus = (status: string) => reportCards.filter(c => c.status === status).length

  return (
    <div style={{ padding: 24 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Report Cards</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Approve and release report cards</p>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Select value={year} onChange={e => setYear(e.target.value)} options={yearOptions} style={{ minWidth: 110 }} />
        <Select value={term} onChange={e => setTerm(e.target.value)}
          options={[{ value: '', label: 'Select term' }, { value: '1', label: 'Term 1' }, { value: '2', label: 'Term 2' }, { value: '3', label: 'Term 3' }]}
          style={{ minWidth: 120 }}
        />
        <Select value={classId} onChange={e => setClassId(e.target.value)}
          options={[{ value: '', label: 'Select class' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
          style={{ minWidth: 140 }}
        />
        <Select value={streamId} onChange={e => setStreamId(e.target.value)}
          options={[{ value: '', label: 'All streams' }, ...streams.map(s => ({ value: s.id, label: s.name }))]}
          disabled={!classId}
          style={{ minWidth: 130 }}
        />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          options={[
            { value: '',         label: 'All Statuses' },
            { value: 'ready',    label: 'Ready for Review' },
            { value: 'approved', label: 'Approved' },
            { value: 'released', label: 'Released' },
            { value: 'draft',    label: 'Draft' },
          ]}
          style={{ minWidth: 150 }}
        />
      </div>

      {/* ── Summary chips ─────────────────────────────────────── */}
      {cohortReady && reportCards.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Ready for approval', count: countByStatus('ready'),    variant: 'green' as const },
            { label: 'Approved',           count: countByStatus('approved'), variant: 'blue' as const },
            { label: 'Released',           count: countByStatus('released'), variant: 'teal' as const },
            { label: 'Draft',              count: countByStatus('draft'),    variant: 'muted' as const },
          ].filter(({ count }) => count > 0).map(({ label, count, variant }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 99,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              fontSize: 12, fontWeight: 700,
            }}>
              <Badge variant={variant}>{label}</Badge>
              <span style={{ color: 'var(--txt)', fontFamily: 'var(--mono)' }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      {!cohortReady ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          color: 'var(--txt3)', fontFamily: 'var(--font2)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Select a term and class to view report cards</div>
        </div>
      ) : rcLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <LoadingSpinner size={28} />
        </div>
      ) : filteredCards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>
          No report cards found for the selected filters.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 140px 120px 240px',
            padding: '10px 16px', background: 'var(--surface2)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
            textTransform: 'uppercase', letterSpacing: 0.5,
            fontFamily: 'var(--font2)',
          }}>
            <div>Student</div>
            <div>Adm. No</div>
            <div>Status</div>
            <div>PDF</div>
            <div>Actions</div>
          </div>

          {filteredCards.map((card, i) => {
            const name    = studentNameMap.get(card.studentId) ?? card.studentId
            const readRow = readinessMap.get(card.studentId)
            const admNo   = readRow?.admissionNumber ?? '—'

            return (
              <div key={card.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 160px 140px 120px 240px',
                padding: '12px 16px',
                borderBottom: i < filteredCards.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>{name}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--txt3)' }}>{admNo}</div>
                <div><RCStatusBadge status={card.status} /></div>

                {/* PDF link */}
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
                  {card.status === 'ready' && (
                    <Button size="sm" variant="primary"
                      onClick={() => setApproveCard({ card, name })}>
                      Approve
                    </Button>
                  )}
                  {card.status === 'approved' && (
                    <Button size="sm" variant="primary"
                      loading={release.isPending}
                      onClick={() => release.mutateAsync({ reportCardId: card.id })}>
                      Release
                    </Button>
                  )}
                  {(card.status === 'approved' || card.status === 'released') && (
                    <Button size="sm" variant="danger"
                      onClick={() => setUnlockCard({ card, name })}>
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
    </div>
  )
}
