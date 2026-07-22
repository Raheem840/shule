// Detects a class's education stage — Primary (P1–P7), O-level (S1–S4), or
// A-level (S5–S6) — purely from its NAME, since `classes.level` is stored as
// a plain number (1–7) with no P/S distinction of its own: a school's P.1
// and a school's S.1 would both have level=1. The name is the only place
// that distinction is captured, so grading (calculateCBCGrade vs
// calculateALevelGrade vs calculatePLEGrade) and end-of-school completion
// logic (P7 / S6 → students.status='completed') both key off this.
//
// Normalizes case/punctuation/spacing so "P.1", "p1", "P 1", "Primary 1"
// all resolve identically — same convention as studentImport.ts's normCls,
// extended to recognize the Primary prefix too.
export type EducationStage = 'primary' | 'olevel' | 'alevel'

function normalizeClassName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/^primary/, 'p')
    .replace(/^senior/, 's')
    .replace(/^form/, 's')
}

export function classifyClassName(name: string): { stage: EducationStage | null; level: number | null } {
  const n = normalizeClassName(name)
  const m = n.match(/^([ps])(\d)/)
  if (!m) return { stage: null, level: null }
  const level = parseInt(m[2], 10)

  if (m[1] === 'p') {
    return level >= 1 && level <= 7 ? { stage: 'primary', level } : { stage: null, level: null }
  }
  // 's' prefix: S1–S4 = O-level (existing CBC formula), S5–S6 = A-level.
  if (level >= 1 && level <= 4) return { stage: 'olevel', level }
  if (level >= 5 && level <= 6) return { stage: 'alevel', level }
  return { stage: null, level: null }
}

// True at the class a student leaves the school from — P7 (Primary) or S6
// (A-level). runPromotion (useAdmin.ts) already marks any student at the
// school's highest CONFIGURED class level as students.status='completed';
// this holds for both cases as long as a school's classes are actually
// named/leveled correctly (a Primary school only ever configures P1–P7, so
// its highest level is naturally 7; a full-cycle Secondary school's is 6).
// Exported for callers that want to check terminal-ness by name directly
// rather than by "highest configured class in this school."
export function isTerminalLevel(stage: EducationStage, level: number): boolean {
  if (stage === 'primary') return level === 7
  if (stage === 'alevel')  return level === 6
  return false
}
