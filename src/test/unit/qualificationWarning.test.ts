import { describe, it, expect } from 'vitest'
import { getQualWarning } from '../../pages/secretary/StaffRegistrationWizard'

// ── Fixtures ───────────────────────────────────────────────────
// MoES qualification level thresholds:
//   Level 1 = Certificate in Education (Grade III)
//   Level 2 = Diploma in Education (Grade V)      ← minimum for Lower Secondary (S.1–S.4)
//   Level 3 = Bachelor of Education               ← minimum for Upper Secondary (S.5–S.6)
//   Levels 4–7 = Postgraduate qualifications

const LOWER_CLASS = { id: 'cls-s2', level: '2' }  // S.2 — lower secondary
const UPPER_CLASS = { id: 'cls-s5', level: '5' }  // S.5 — upper secondary
const NULL_CLASS  = { id: 'cls-x',  level: null }  // no level set

describe('getQualWarning — no warning cases', () => {
  it('returns null when qualLevel is null', () => {
    expect(getQualWarning(null, ['cls-s2'], [LOWER_CLASS])).toBeNull()
  })

  it('returns null when no classes are selected', () => {
    expect(getQualWarning(1, [], [LOWER_CLASS])).toBeNull()
  })

  it('returns null when lower secondary + qual level 2 (meets requirement)', () => {
    expect(getQualWarning(2, ['cls-s2'], [LOWER_CLASS])).toBeNull()
  })

  it('returns null when lower secondary + qual level 3 (exceeds requirement)', () => {
    expect(getQualWarning(3, ['cls-s2'], [LOWER_CLASS])).toBeNull()
  })

  it('returns null when upper secondary + qual level 3 (meets requirement)', () => {
    expect(getQualWarning(3, ['cls-s5'], [UPPER_CLASS])).toBeNull()
  })

  it('returns null when upper secondary + qual level 5 (exceeds requirement)', () => {
    expect(getQualWarning(5, ['cls-s5'], [UPPER_CLASS])).toBeNull()
  })

  it('returns null when class has no level set', () => {
    expect(getQualWarning(1, ['cls-x'], [NULL_CLASS])).toBeNull()
  })
})

describe('getQualWarning — lower secondary warning', () => {
  it('fires when lower secondary + qual level 1 (below minimum)', () => {
    const warning = getQualWarning(1, ['cls-s2'], [LOWER_CLASS])
    expect(warning).not.toBeNull()
    expect(warning).toContain('Lower Secondary')
    expect(warning).toContain('Level 2')
    expect(warning).toContain('MoES')
  })

  it('fires for S.1 class (level=1)', () => {
    const s1Class = { id: 'cls-s1', level: '1' }
    const warning = getQualWarning(1, ['cls-s1'], [s1Class])
    expect(warning).toContain('Lower Secondary')
  })

  it('fires for S.4 class (level=4)', () => {
    const s4Class = { id: 'cls-s4', level: '4' }
    const warning = getQualWarning(1, ['cls-s4'], [s4Class])
    expect(warning).toContain('Lower Secondary')
  })

  it('does not fire at the boundary (level 2 = exactly meets requirement)', () => {
    const s3Class = { id: 'cls-s3', level: '3' }
    expect(getQualWarning(2, ['cls-s3'], [s3Class])).toBeNull()
  })
})

describe('getQualWarning — upper secondary warning', () => {
  it('fires when upper secondary + qual level 1 (well below minimum)', () => {
    const warning = getQualWarning(1, ['cls-s5'], [UPPER_CLASS])
    expect(warning).not.toBeNull()
    expect(warning).toContain('Upper Secondary')
    expect(warning).toContain('Level 3')
    expect(warning).toContain('MoES')
  })

  it('fires when upper secondary + qual level 2 (one below minimum)', () => {
    const warning = getQualWarning(2, ['cls-s5'], [UPPER_CLASS])
    expect(warning).not.toBeNull()
    expect(warning).toContain('Upper Secondary')
  })

  it('fires for S.6 class (level=6)', () => {
    const s6Class = { id: 'cls-s6', level: '6' }
    const warning = getQualWarning(2, ['cls-s6'], [s6Class])
    expect(warning).toContain('Upper Secondary')
  })

  it('does not fire at the boundary (level 3 = exactly meets requirement)', () => {
    expect(getQualWarning(3, ['cls-s5'], [UPPER_CLASS])).toBeNull()
  })
})

describe('getQualWarning — mixed class assignments', () => {
  it('fires upper secondary warning when teacher has both lower and upper classes but qual level 2', () => {
    // Level 2 meets lower secondary but not upper secondary
    const warning = getQualWarning(
      2,
      ['cls-s2', 'cls-s5'],
      [LOWER_CLASS, UPPER_CLASS],
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain('Upper Secondary')
  })

  it('fires lower secondary warning when teacher only has lower classes and qual level 1', () => {
    const warning = getQualWarning(
      1,
      ['cls-s2', 'cls-s3'],
      [LOWER_CLASS, { id: 'cls-s3', level: '3' }],
    )
    expect(warning).not.toBeNull()
    expect(warning).toContain('Lower Secondary')
  })

  it('returns null when mixed assignments and qual level 3 (meets all requirements)', () => {
    expect(getQualWarning(
      3,
      ['cls-s2', 'cls-s5'],
      [LOWER_CLASS, UPPER_CLASS],
    )).toBeNull()
  })

  it('handles a selected class that is not found in allClasses (level=undefined)', () => {
    // class not in allClasses → undefined level → filtered out → no warning
    const warning = getQualWarning(1, ['unknown-cls'], [LOWER_CLASS])
    expect(warning).toBeNull()
  })
})
