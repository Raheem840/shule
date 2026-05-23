import { useState, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTeacherRemarks, useSaveRemarks } from '../../hooks/useTeacherRemarks'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { Student } from '../../types/app'

const TERM_OPTIONS = [
  { value: '1', label: 'Term 1' },
  { value: '2', label: 'Term 2' },
  { value: '3', label: 'Term 3' },
]

const CURRENT_YEAR = new Date().getFullYear()
const MAX_CHARS    = 200

// ── Remark row (for virtualised list) ─────────────────────────
function RemarkRow({
  student,
  value,
  saved,
  onChange,
}: {
  student:  Student
  value:    string
  saved:    boolean
  onChange: (studentId: string, text: string) => void
}) {
  const remaining = MAX_CHARS - value.length

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
      display: 'grid',
      gridTemplateColumns: '200px 1fr 32px',
      gap: 12,
      alignItems: 'start',
      background: saved ? 'rgba(16,185,129,0.04)' : 'transparent',
    }}>
      {/* Student info */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
          {student.firstName} {student.lastName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
          {student.admissionNumber}
        </div>
      </div>

      {/* Textarea */}
      <div>
        <textarea
          value={value}
          onChange={e => onChange(student.id, e.target.value.slice(0, MAX_CHARS))}
          rows={2}
          placeholder="Write a remark for this student..."
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid',
            borderColor: value.length === 0 ? 'var(--warning)' : 'var(--border)',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'var(--font1)',
            resize: 'vertical',
            background: 'var(--surface)',
            color: 'var(--txt)',
            lineHeight: 1.5,
          }}
        />
        <div style={{
          fontSize: 10, color: remaining < 20 ? 'var(--warning)' : 'var(--txt3)',
          textAlign: 'right', marginTop: 2,
        }}>
          {remaining} chars left
        </div>
      </div>

      {/* Saved indicator */}
      <div style={{ paddingTop: 8 }}>
        {saved ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : value.length > 0 ? (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', marginTop: 4 }} />
        ) : null}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export function TeacherRemarksPage() {
  const [term,     setTerm]     = useState<string>('')
  const [classId,  setClassId]  = useState<string>('')
  const [streamId, setStreamId] = useState<string>('')

  // Local remarks state: studentId → text
  const [remarks, setRemarks] = useState<Map<string, string>>(new Map())
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())

  const { data: classes  = [] }                    = useClasses()
  const { data: streams  = [] }                    = useStreams(classId || null)
  const { data: students = [], isLoading: studentsLoading } = useStudents({
    classId:  classId  || undefined,
    streamId: streamId || undefined,
    status:   'active',
  })
  const { data: savedRemarks, isLoading: remarksLoading } = useTeacherRemarks({
    term:     term     || null,
    classId:  classId  || null,
    streamId: streamId || null,
    year:     CURRENT_YEAR,
  })
  const saveRemarks = useSaveRemarks()

  // Initialise remarks from saved data
  useEffect(() => {
    if (!savedRemarks) return
    setRemarks(prev => {
      const next = new Map(prev)
      for (const [sid, remark] of savedRemarks) {
        if (!dirtyIds.has(sid)) {
          next.set(sid, remark.remarks)
        }
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRemarks])

  const handleChange = (studentId: string, text: string) => {
    setRemarks(prev => new Map(prev).set(studentId, text))
    setDirtyIds(prev => new Set(prev).add(studentId))
  }

  async function handleSaveAll() {
    if (!classId || !term) return
    const rows = students
      .filter(s => (remarks.get(s.id) ?? '').trim().length > 0)
      .map(s => ({ studentId: s.id, remarks: remarks.get(s.id)!.trim() }))

    await saveRemarks.mutateAsync({
      term,
      year:     CURRENT_YEAR,
      classId,
      streamId: streamId || null,
      rows,
    })
    setDirtyIds(new Set())
  }

  const savedSet = new Set<string>(savedRemarks?.keys() ?? [])

  const withRemarks    = students.filter(s => (remarks.get(s.id) ?? '').trim().length > 0).length
  const withoutRemarks = students.length - withRemarks
  const ready          = !!term && !!classId && students.length > 0

  // Virtualiser
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirt   = useVirtualizer({
    count:            students.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 90,
    overscan:         8,
  })

  const isLoading = studentsLoading || remarksLoading

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Teacher Remarks"
        subtitle="Write a remark for each student before report cards can be generated."
        action={
          <Button variant="primary" onClick={handleSaveAll}
            loading={saveRemarks.isPending}
            disabled={!ready || saveRemarks.isPending}
          >
            Save All Remarks
          </Button>
        }
      />

      {/* ── Filter controls ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Select
          value={term} onChange={e => setTerm(e.target.value)}
          options={[{ value: '', label: 'Select term' }, ...TERM_OPTIONS]}
          style={{ minWidth: 130 }}
        />
        <Select
          value={classId} onChange={e => setClassId(e.target.value)}
          options={[{ value: '', label: 'Select class' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
          style={{ minWidth: 140 }}
        />
        <Select
          value={streamId} onChange={e => setStreamId(e.target.value)}
          options={[{ value: '', label: 'All streams' }, ...streams.map(s => ({ value: s.id, label: s.name }))]}
          disabled={!classId}
          style={{ minWidth: 130 }}
        />
      </div>

      {/* ── Status summary ────────────────────────────────────── */}
      {ready && !isLoading && (
        <div style={{
          display: 'flex', gap: 16, marginBottom: 16, padding: '10px 14px',
          background: withoutRemarks > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
          border: '1px solid',
          borderColor: withoutRemarks > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)',
          borderRadius: 10, fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ color: 'var(--success)' }}>✓ {withRemarks} with remarks</span>
          {withoutRemarks > 0 && (
            <span style={{ color: 'var(--warning)' }}>
              ⚠ {withoutRemarks} missing — report cards cannot be generated until all students have remarks
            </span>
          )}
        </div>
      )}

      {saveRemarks.isError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>
          {(saveRemarks.error as Error).message}
        </div>
      )}

      {saveRemarks.isSuccess && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 8, fontSize: 13 }}>
          Remarks saved successfully.
        </div>
      )}

      {/* ── Student list ──────────────────────────────────────── */}
      {!ready ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          color: 'var(--txt3)', fontFamily: 'var(--font2)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Select a term and class to get started</div>
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <LoadingSpinner size={28} />
        </div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>
          No active students found in this class.
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Fixed header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '200px 1fr 32px',
            gap: 12, padding: '10px 16px',
            background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
            textTransform: 'uppercase', letterSpacing: 0.5,
            fontFamily: 'var(--font2)',
          }}>
            <div>Student</div>
            <div>Remark (max 200 chars)</div>
            <div>Saved</div>
          </div>

          {/* Virtualised rows */}
          <div ref={parentRef} style={{ maxHeight: 520, overflowY: 'auto' }}>
            <div style={{ height: rowVirt.getTotalSize(), position: 'relative' }}>
              {rowVirt.getVirtualItems().map(vRow => {
                const student = students[vRow.index]
                const value   = remarks.get(student.id) ?? ''
                const isSaved = savedSet.has(student.id) && !dirtyIds.has(student.id)

                return (
                  <div
                    key={student.id}
                    style={{
                      position: 'absolute',
                      top: vRow.start, left: 0, right: 0,
                      height: vRow.size,
                    }}
                  >
                    <RemarkRow
                      student={student}
                      value={value}
                      saved={isSaved}
                      onChange={handleChange}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
