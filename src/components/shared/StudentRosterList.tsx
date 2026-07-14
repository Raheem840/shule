import { Avatar } from './Avatar'
import type { Student } from '../../types/app'

// ─── Single roster row — real photo, name, admission number ──────────────────
export function StudentRosterRow({ student, onClick }: { student: Student; onClick?: (student: Student) => void }) {
  const fullName = `${student.firstName} ${student.lastName}`
  return (
    <div
      onClick={onClick ? () => onClick(student) : undefined}
      className={onClick ? 'sui-tr' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '11px 18px',
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Avatar photoPath={student.photoUrl} bucket="student-photos" name={fullName} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fullName}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>
          {student.admissionNumber}
        </div>
      </div>
      {student.gender && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
          background: student.gender === 'male' ? 'rgba(14,165,233,.1)' : 'rgba(236,72,153,.1)',
          color: student.gender === 'male' ? '#0284c7' : '#db2777',
          textTransform: 'capitalize', flexShrink: 0,
        }}>
          {student.gender}
        </span>
      )}
      {onClick && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.2" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </div>
  )
}

// ─── Full roster list — a premium, scrollable list of students in a stream ────
export function StudentRosterList({
  students,
  onSelect,
  emptyLabel = 'No students in this stream yet.',
}: {
  students: Student[]
  onSelect?: (student: Student) => void
  emptyLabel?: string
}) {
  if (students.length === 0) {
    return (
      <div style={{ padding: '24px 18px', textAlign: 'center', fontSize: 12.5, color: 'var(--txt3)', fontStyle: 'italic' }}>
        {emptyLabel}
      </div>
    )
  }

  const sorted = [...students].sort((a, b) => a.firstName.localeCompare(b.firstName))

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden' }}>
      {sorted.map(s => (
        <StudentRosterRow key={s.id} student={s} onClick={onSelect} />
      ))}
    </div>
  )
}
