import type { SubjectPdfRow } from './reportCardPdf'

// Performance-band remarks, keyed to the same 80/70/60/50 boundaries used
// for letter grades (see CLAUDE.md's CBC section) — a school-level
// convention, not a verbatim UNEB-published number, but consistent with
// how this app already grades every subject.
const REMARK_BANDS: { min: number; remark: string }[] = [
  { min: 80, remark: 'Excellent performance this term. Keep up the outstanding work.' },
  { min: 70, remark: 'Very good performance. Keep pushing for even greater results.' },
  { min: 60, remark: 'Good, solid performance. Consistent effort will bring even better results.' },
  { min: 50, remark: 'Fair performance. More effort is needed across subjects.' },
  { min: 0,  remark: 'Performance needs urgent improvement — extra support and effort are strongly encouraged.' },
]

// Overall average for banding purposes: prefers each subject's real /100
// total where the End-of-Term exam has been entered; for subjects still
// mid-term (CA marks only, no exam yet), falls back to the CA score
// projected onto the same /100 scale so a remark is still available before
// the term ends — this is only ever used to pick a remark's tone, never
// displayed as a subject's actual grade (see buildSubjectRows/reportCardPdf,
// which correctly show "—" for total/grade until both CA and exam exist).
export function computeOverallAverage(subjects: SubjectPdfRow[]): number | null {
  const graded = subjects.filter(s => s.total !== null).map(s => s.total as number)
  if (graded.length > 0) return graded.reduce((a, b) => a + b, 0) / graded.length

  const caOnly = subjects
    .filter(s => s.total === null && s.maxCaPoints > 0)
    .map(s => (s.caOutOf20 / 20) * 100)
  if (caOnly.length > 0) return caOnly.reduce((a, b) => a + b, 0) / caOnly.length

  return null
}

// Automatic, criteria-based remark — always available the moment any marks
// exist, so report card generation never depends on a teacher having typed
// one in manually. A teacher's own written remark (teacher_remarks table)
// still takes priority over this when present; this is only the fallback.
export function getAutoRemark(overallAverage: number | null): string {
  if (overallAverage === null) {
    return 'Performance summary will be available once marks are recorded.'
  }
  const band = REMARK_BANDS.find(b => overallAverage >= b.min) ?? REMARK_BANDS[REMARK_BANDS.length - 1]
  return band.remark
}
