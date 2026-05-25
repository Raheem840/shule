import { useState, useRef } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useDeputyOverview,
  useDisciplineRecords,
  useAddDisciplineRecord,
  useTimetable,
} from '../../hooks/useDeputy'
import { useClasses } from '../../hooks/useClasses'
import { useStudents } from '../../hooks/useStudents'
import { ImportWizard } from '../../components/shared/ImportWizard'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import type { DisciplineNature } from '../../types/week9'

const NATURE_LABELS: Record<DisciplineNature, string> = {
  lateness:    'Lateness',
  absenteeism: 'Absenteeism',
  misconduct:  'Misconduct',
  violence:    'Violence',
  other:       'Other',
}

const DAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri',
}

// ─── TAB 1 — Academic Overview ────────────────────────────────────────────
function AcademicOverviewTab() {
  const { data: classSummaries = [], isLoading } = useDeputyOverview()

  if (isLoading) return <div style={{ color: 'var(--txt3)', padding: 32 }}>Loading…</div>

  const below = classSummaries.filter(c => c.isBelowThreshold)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {below.length > 0 && (
        <div style={{
          background: 'var(--danger-bg)', border: '1px solid var(--danger)',
          borderRadius: 12, padding: '12px 16px',
          color: 'var(--danger)', fontWeight: 700, fontSize: 13,
        }}>
          {below.length} class{below.length !== 1 ? 'es' : ''} below 80% attendance:{' '}
          {below.map(c => c.className).join(', ')}
        </div>
      )}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>
          Class Attendance Overview
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Class', 'Level', 'Attendance Rate', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 12px', background: 'var(--surface2)',
                  fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classSummaries.map(c => (
              <tr key={c.classId} className="sui-tr">
                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--txt)' }}>{c.className}</td>
                <td style={{ padding: '8px 12px', color: 'var(--txt2)', fontSize: 12 }}>{c.level ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 99 }}>
                      <div style={{
                        height: 6, borderRadius: 99, width: `${c.attendanceRate}%`,
                        background: c.isBelowThreshold ? 'var(--danger)' : 'var(--success)',
                      }} />
                    </div>
                    <span style={{
                      fontFamily: 'var(--font3)', fontSize: 12, fontWeight: 700,
                      color: c.isBelowThreshold ? 'var(--danger)' : 'var(--success)',
                      minWidth: 36,
                    }}>
                      {c.attendanceRate}%
                    </span>
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: c.isBelowThreshold ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: c.isBelowThreshold ? 'var(--danger)' : 'var(--success)',
                  }}>
                    {c.isBelowThreshold ? 'Below threshold' : 'Good'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ADD DISCIPLINE MODAL ─────────────────────────────────────────────────
function AddDisciplineModal({ onClose }: { onClose: () => void }) {
  const { data: classes = [] } = useClasses()
  const { data: students = [] } = useStudents()
  const addMut = useAddDisciplineRecord()

  const [form, setForm] = useState({
    studentId:    '',
    classId:      '',
    incidentDate: new Date().toISOString().slice(0, 10),
    nature:       'lateness' as DisciplineNature,
    resolution:   '',
    notes:        '',
  })
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.studentId || !form.resolution) {
      setError('Student and resolution are required.')
      return
    }
    setError('')
    try {
      await addMut.mutateAsync({
        studentId:    form.studentId,
        classId:      form.classId || null,
        incidentDate: form.incidentDate,
        nature:       form.nature,
        resolution:   form.resolution,
        notes:        form.notes || null,
      })
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to save record')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        width: 480, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, margin: 0 }}>
            Add Discipline Record
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none',
            fontSize: 20, cursor: 'pointer', color: 'var(--txt3)' }}>✕</button>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)', color: 'var(--danger)',
            padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={e => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Student ★
            </label>
            <select
              value={form.studentId}
              onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
              className="sui-input"
              style={{ width: '100%' }}
              required
            >
              <option value="">Select student…</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} — {s.admissionNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Class
            </label>
            <select
              value={form.classId}
              onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
              className="sui-input"
              style={{ width: '100%' }}
            >
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Incident Date ★
            </label>
            <input
              type="date"
              value={form.incidentDate}
              onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))}
              className="sui-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Nature ★
            </label>
            <select
              value={form.nature}
              onChange={e => setForm(f => ({ ...f, nature: e.target.value as DisciplineNature }))}
              className="sui-input"
              style={{ width: '100%' }}
            >
              {Object.entries(NATURE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Resolution ★
            </label>
            <textarea
              value={form.resolution}
              onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}
              className="sui-input"
              rows={2}
              style={{ width: '100%', resize: 'vertical' }}
              placeholder="Action taken…"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="sui-input"
              rows={2}
              style={{ width: '100%', resize: 'vertical' }}
              placeholder="Additional context…"
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="sui-btn-outline">Cancel</button>
            <button type="submit" disabled={addMut.isPending} className="sui-btn-primary">
              {addMut.isPending ? 'Saving…' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── TAB 2 — Discipline Records ───────────────────────────────────────────
function DisciplineTab() {
  const { data: records = [], isLoading } = useDisciplineRecords()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count:            records.length,
    getScrollElement: () => listRef.current,
    estimateSize:     () => 52,
    overscan:         5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setShowImport(true)} className="sui-btn-outline" style={{ fontSize: 13 }}>
          Import from CSV/Excel
        </button>
        <button onClick={() => setShowAdd(true)} className="sui-btn-primary" style={{ fontSize: 13 }}>
          + Add Record
        </button>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading discipline records…</div>}

      <div
        ref={listRef}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'auto', maxHeight: 480,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {['Student ID', 'Date', 'Nature', 'Resolution', 'Recorded By'].map(h => (
                <th key={h} style={{ padding: '8px 12px', background: 'var(--surface2)',
                  fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map(vr => {
              const r = records[vr.index]
              return (
                <tr
                  key={r.id}
                  className="sui-tr"
                  style={{ height: vr.size, transform: `translateY(${vr.start}px)` }}
                >
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)', fontSize: 12 }}>
                    {r.studentId.slice(0, 8)}…
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--txt2)', fontSize: 12 }}>
                    {r.incidentDate}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: 'var(--warning-bg)', color: 'var(--warning)',
                    }}>
                      {NATURE_LABELS[r.nature]}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--txt)', fontSize: 13,
                    maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.resolution}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)', fontSize: 11, color: 'var(--txt3)' }}>
                    {r.recordedBy.slice(0, 8)}…
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {records.length === 0 && !isLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
            No discipline records found.
          </div>
        )}
      </div>

      {showAdd && <AddDisciplineModal onClose={() => setShowAdd(false)} />}

      {showImport && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 28,
            width: 640, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, margin: 0 }}>
                Import Discipline Records
              </h3>
              <button onClick={() => setShowImport(false)} style={{ border: 'none', background: 'none',
                fontSize: 20, cursor: 'pointer', color: 'var(--txt3)' }}>✕</button>
            </div>
            <ImportWizard
              context="students"
              requiredFields={[
                { key: 'student_id',    label: 'Student ID' },
                { key: 'incident_date', label: 'Incident Date' },
                { key: 'nature',        label: 'Nature' },
                { key: 'resolution',    label: 'Resolution' },
              ]}
              optionalFields={[
                { key: 'notes',    label: 'Notes' },
                { key: 'class_id', label: 'Class ID' },
              ]}
              onComplete={async () => ({ imported: 0, updated: 0, skipped: 0, failed: 0 })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB 3 — Timetable (View-only) ───────────────────────────────────────
function TimetableTab() {
  const { data: classes = [] } = useClasses()
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const { data: periods = [], isLoading } = useTimetable(selectedClass)

  // Build grid: dayOfWeek → periodNumber → period data
  const maxPeriod = Math.max(0, ...periods.map(p => p.periodNumber))
  const periodNums = Array.from({ length: maxPeriod }, (_, i) => i + 1)

  function cell(day: number, period: number) {
    return periods.find(p => p.dayOfWeek === day && p.periodNumber === period)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
          Filter by Class (optional)
        </label>
        <select
          value={selectedClass ?? ''}
          onChange={e => setSelectedClass(e.target.value || null)}
          className="sui-input"
          style={{ width: 200 }}
        >
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading timetable…</div>}

      {!isLoading && periods.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            borderCollapse: 'collapse', minWidth: 600,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', background: 'var(--surface2)',
                  fontWeight: 700, fontSize: 12, color: 'var(--txt2)', minWidth: 64 }}>
                  Period
                </th>
                {[1, 2, 3, 4, 5].map(d => (
                  <th key={d} style={{ padding: '8px 12px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)', minWidth: 100 }}>
                    {DAY_LABELS[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodNums.map(p => (
                <tr key={p} className="sui-tr">
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 13,
                    color: 'var(--txt3)', textAlign: 'center' }}>
                    {p}
                  </td>
                  {[1, 2, 3, 4, 5].map(d => {
                    const c = cell(d, p)
                    return (
                      <td key={d} style={{ padding: '6px 10px', fontSize: 12 }}>
                        {c ? (
                          <div style={{
                            background: 'var(--brand-light)', borderRadius: 8,
                            padding: '4px 8px', color: 'var(--brand)',
                          }}>
                            <div style={{ fontWeight: 700 }}>{c.subjectId.slice(0, 8)}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)' }}>
                              {c.startTime}–{c.endTime}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && periods.length === 0 && (
        <div style={{ color: 'var(--txt3)', padding: 32, textAlign: 'center', fontSize: 13 }}>
          No timetable data available.
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPUTY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function DeputyDashboard() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
          color: 'var(--txt)', margin: 0,
        }}>
          Deputy Principal — Dashboard
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Attendance overview, discipline records, and timetable.
        </div>
      </div>

      <SafeTermProgressTimeline />

      <Tabs.Root defaultValue="overview">
        <Tabs.List style={{
          display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 24,
        }}>
          {[
            { value: 'overview',    label: 'Academic Overview' },
            { value: 'discipline',  label: 'Discipline Records' },
            { value: 'timetable',   label: 'Timetable' },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              style={{
                padding: '8px 18px', border: 'none', background: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 13,
                color: 'var(--txt2)', borderRadius: '8px 8px 0 0',
              }}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview">   <AcademicOverviewTab /> </Tabs.Content>
        <Tabs.Content value="discipline"> <DisciplineTab />       </Tabs.Content>
        <Tabs.Content value="timetable">  <TimetableTab />        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
