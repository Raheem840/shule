// Phase 2 — Zod schema unit tests.
// The schemas are pure validation logic; the vi.mock calls below only suppress
// the supabase env-var throw that fires during module initialisation.
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
  },
}))
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}))

import { wizardSchema, guardianSchema } from '../../pages/secretary/StudentRegistrationWizard'
import { AddFeeSchema } from '../../pages/bursar/FeeStructurePage'
import { journalSchema } from '../../pages/teacher/ExamJournalPage'

// ── Student Registration Wizard schema ─────────────────────────
describe('wizardSchema (student registration)', () => {
  const validGuardian = {
    guardianName:    'Jane Doe',
    relationship:    'mother',
    phone:           '0700123456',
    email:           undefined,
    isPrimary:       true,
    doNotContact:    false,
    commsPreference: 'sms' as const,
  }

  const validInput = {
    firstName:       'Alice',
    lastName:        'Nakato',
    dateOfBirth:     '2010-03-15',
    admissionNumber: 'KJA/2025/0001',
    classId:         'class-uuid-1',
    enrolledAt:      '2025-01-15',
    guardians:       [validGuardian],
  }

  it('accepts valid input', () => {
    const result = wizardSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects missing firstName', () => {
    const result = wizardSchema.safeParse({ ...validInput, firstName: '' })
    expect(result.success).toBe(false)
    const issues = result.error!.issues
    expect(issues.some(i => i.path.includes('firstName'))).toBe(true)
    expect(issues.find(i => i.path.includes('firstName'))?.message).toMatch(/first name/i)
  })

  it('rejects missing lastName', () => {
    const result = wizardSchema.safeParse({ ...validInput, lastName: '' })
    expect(result.success).toBe(false)
    expect(result.error!.issues.some(i => i.path.includes('lastName'))).toBe(true)
  })

  it('rejects missing admissionNumber', () => {
    const result = wizardSchema.safeParse({ ...validInput, admissionNumber: '' })
    expect(result.success).toBe(false)
    expect(result.error!.issues.some(i => i.path.includes('admissionNumber'))).toBe(true)
  })

  it('rejects missing classId', () => {
    const result = wizardSchema.safeParse({ ...validInput, classId: '' })
    expect(result.success).toBe(false)
    expect(result.error!.issues.some(i => i.path.includes('classId'))).toBe(true)
  })

  it('rejects missing enrolledAt', () => {
    const result = wizardSchema.safeParse({ ...validInput, enrolledAt: '' })
    expect(result.success).toBe(false)
    expect(result.error!.issues.some(i => i.path.includes('enrolledAt'))).toBe(true)
  })

  it('rejects empty guardians array', () => {
    const result = wizardSchema.safeParse({ ...validInput, guardians: [] })
    expect(result.success).toBe(false)
    expect(result.error!.issues.some(i => i.path.includes('guardians'))).toBe(true)
  })

  it('optional fields can be omitted', () => {
    const minimal = {
      firstName: 'Alice', lastName: 'Nakato',
      admissionNumber: 'KJA/2025/0001', classId: 'class-1',
      enrolledAt: '2025-01-15', guardians: [validGuardian],
    }
    expect(wizardSchema.safeParse(minimal).success).toBe(true)
  })
})

// ── Guardian sub-schema ────────────────────────────────────────
describe('guardianSchema', () => {
  const valid = {
    guardianName: 'Mary Apio', relationship: 'mother',
    phone: '0700111222', isPrimary: true,
    doNotContact: false, commsPreference: 'sms' as const,
  }

  it('accepts valid guardian', () => {
    expect(guardianSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects phone shorter than 7 chars', () => {
    const r = guardianSchema.safeParse({ ...valid, phone: '070011' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.some(i => i.path.includes('phone'))).toBe(true)
    expect(r.error!.issues.find(i => i.path.includes('phone'))?.message).toMatch(/phone/i)
  })

  it('rejects missing guardianName', () => {
    const r = guardianSchema.safeParse({ ...valid, guardianName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid commsPreference', () => {
    const r = guardianSchema.safeParse({ ...valid, commsPreference: 'telegram' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.some(i => i.path.includes('commsPreference'))).toBe(true)
  })
})

// ── AddFeeSchema ───────────────────────────────────────────────
describe('AddFeeSchema (fee structure)', () => {
  const valid = {
    name: 'School Fees', amount: 400000,
    appliesTo: 'all' as const, term: 1, academicYearId: 'year-uuid-1',
    classId: null, isCompulsory: true, autoCharge: false,
  }

  it('accepts valid fee type', () => {
    expect(AddFeeSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects name shorter than 2 chars', () => {
    const r = AddFeeSchema.safeParse({ ...valid, name: 'X' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.some(i => i.path.includes('name'))).toBe(true)
  })

  it('rejects non-positive amount', () => {
    const r = AddFeeSchema.safeParse({ ...valid, amount: 0 })
    expect(r.success).toBe(false)
    expect(r.error!.issues.find(i => i.path.includes('amount'))?.message).toMatch(/> 0/i)
  })

  it('rejects negative amount', () => {
    const r = AddFeeSchema.safeParse({ ...valid, amount: -100 })
    expect(r.success).toBe(false)
  })

  it('rejects term outside 1–3', () => {
    expect(AddFeeSchema.safeParse({ ...valid, term: 0 }).success).toBe(false)
    expect(AddFeeSchema.safeParse({ ...valid, term: 4 }).success).toBe(false)
  })

  it('accepts all valid appliesTo values', () => {
    for (const v of ['all', 'boarders', 'day_scholars'] as const) {
      expect(AddFeeSchema.safeParse({ ...valid, appliesTo: v }).success).toBe(true)
    }
  })

  it('rejects missing academicYearId', () => {
    const r = AddFeeSchema.safeParse({ ...valid, academicYearId: '' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.some(i => i.path.includes('academicYearId'))).toBe(true)
  })
})

// ── journalSchema ──────────────────────────────────────────────
describe('journalSchema (exam journal)', () => {
  const valid = {
    assessmentType: 'mid_term' as const,
    subjectId: 'sub-1', classId: 'cls-1', streamId: null,
    term: '1', date: '2025-06-10', totalMarks: 80, passMark: 40,
    notes: null,
  }

  it('accepts valid journal', () => {
    expect(journalSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing subjectId', () => {
    const r = journalSchema.safeParse({ ...valid, subjectId: '' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.some(i => i.path.includes('subjectId'))).toBe(true)
  })

  it('rejects missing classId', () => {
    const r = journalSchema.safeParse({ ...valid, classId: '' })
    expect(r.success).toBe(false)
  })

  it('rejects missing term', () => {
    const r = journalSchema.safeParse({ ...valid, term: '' })
    expect(r.success).toBe(false)
  })

  it('rejects missing date', () => {
    const r = journalSchema.safeParse({ ...valid, date: '' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid assessmentType', () => {
    const r = journalSchema.safeParse({ ...valid, assessmentType: 'quiz' })
    expect(r.success).toBe(false)
  })

  it('accepts all 9 valid assessment types', () => {
    const types = ['aoi','dit','ca','beginning_of_term','mid_term','end_of_term','practical','class_test','assignment']
    for (const t of types) {
      // CA type doesn't need totalMarks
      const input = t === 'ca'
        ? { ...valid, assessmentType: t, totalMarks: undefined }
        : { ...valid, assessmentType: t }
      const r = journalSchema.safeParse(input)
      expect(r.success, `assessmentType=${t} should be valid`).toBe(true)
    }
  })

  it('rejects totalMarks < 1 for non-CA assessments (superRefine)', () => {
    const r = journalSchema.safeParse({ ...valid, assessmentType: 'mid_term', totalMarks: 0 })
    // superRefine adds a custom issue for totalMarks < 1
    expect(r.success).toBe(false)
    expect(r.error!.issues.some(i => i.path.includes('totalMarks'))).toBe(true)
  })

  it('passMark can be 0', () => {
    expect(journalSchema.safeParse({ ...valid, passMark: 0 }).success).toBe(true)
  })

  it('caWeighting max is 100', () => {
    const r = journalSchema.safeParse({ ...valid, caWeighting: 101 })
    expect(r.success).toBe(false)
  })
})
