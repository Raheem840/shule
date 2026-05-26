import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before vi.mock factories, so mockDoc is accessible in the factory.
const { mockDoc } = vi.hoisted(() => {
  const mockDoc = {
    setFont:         vi.fn().mockReturnThis(),
    setFontSize:     vi.fn().mockReturnThis(),
    setDrawColor:    vi.fn().mockReturnThis(),
    setLineWidth:    vi.fn().mockReturnThis(),
    setTextColor:    vi.fn().mockReturnThis(),
    text:            vi.fn().mockReturnThis(),
    line:            vi.fn().mockReturnThis(),
    addPage:         vi.fn().mockReturnThis(),
    splitTextToSize: vi.fn().mockImplementation((t: string) => [t]),
    lastAutoTable:   { finalY: 100 },
  }
  return { mockDoc }
})

// jsPDF is used with `new` — the mock implementation must be a regular function
// so JS treats it as a constructor. Returning an object from a constructor
// makes `new jsPDF(...)` return that object instead of `this`.
vi.mock('jspdf', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsPDF: vi.fn().mockImplementation(function (this: unknown): unknown { return mockDoc }),
}))

vi.mock('jspdf-autotable', () => ({
  // autoTable(doc, options) — we just need it not to throw.
  // mockDoc.lastAutoTable.finalY is pre-set so generateReportCardPDF can read it.
  default: vi.fn(),
}))

import { buildSubjectRows, generateReportCardPDF, type ReportCardPdfData } from '../../lib/reportCardPdf'

beforeEach(() => vi.clearAllMocks())

// ── Shared fixture ───────────────────────────────────────────────

function makeData(overrides: Partial<ReportCardPdfData> = {}): ReportCardPdfData {
  return {
    school:            { name: 'Kampala Junior Academy', motto: null, logoUrl: null },
    student: {
      firstName: 'Alice', lastName: 'Nakato',
      admissionNumber: 'KJA/2025/001', gender: 'Female',
      className: 'S.3', streamName: 'East',
    },
    term:              1,
    year:              2025,
    termStartDate:     null,
    termEndDate:       null,
    nextTermStartDate: null,
    subjects:          [],
    totalGradePoints:  0,
    avgGrade:          'C',
    avgDescriptor:     'Satisfactory',
    daysPresent:       0,
    daysAbsent:        0,
    teacherRemarks:    'Good effort this term.',
    principalRemarks:  null,
    ...overrides,
  }
}

// ── buildSubjectRows ─────────────────────────────────────────────
// Pure function — no mocks needed.

describe('buildSubjectRows', () => {
  it('returns empty array when results is empty', () => {
    expect(buildSubjectRows([], new Map())).toEqual([])
  })

  it('single CA entry — caScores has one element, no total/grade (no end_of_term)', () => {
    const results = [{
      subjectId: 's1', assessmentType: 'ca', journalName: 'CA 1',
      caLabel: 'C1', score: 2, isAbsent: false, totalMarks: 3,
    }]
    const names = new Map([['s1', 'Mathematics']])
    const [row] = buildSubjectRows(results, names)

    expect(row.subjectName).toBe('Mathematics')
    expect(row.caScores).toHaveLength(1)
    expect(row.caScores[0]).toEqual({ label: 'C1', score: 2 })
    expect(row.totalCaPoints).toBe(2)
    expect(row.maxCaPoints).toBe(3)    // 1 assessed × 3
    expect(row.grade).toBeNull()       // no end_of_term yet
    expect(row.total).toBeNull()
  })

  it('absent CA entry — score is null in caScores, not counted in assessed', () => {
    const results = [{
      subjectId: 's1', assessmentType: 'ca', journalName: 'CA 1',
      caLabel: 'C1', score: null, isAbsent: true, totalMarks: 3,
    }]
    const [row] = buildSubjectRows(results, new Map([['s1', 'English']]))

    expect(row.caScores[0].score).toBeNull()
    expect(row.maxCaPoints).toBe(0)    // 0 assessed (absent)
    expect(row.caOutOf20).toBe(0)
    expect(row.total).toBeNull()
  })

  it('CA + end_of_term — computes total, grade, gradePoints', () => {
    const results = [
      { subjectId: 's1', assessmentType: 'ca',          journalName: 'CA 1', caLabel: 'C1', score: 3, isAbsent: false, totalMarks: 3 },
      { subjectId: 's1', assessmentType: 'end_of_term', journalName: 'EoT',  caLabel: null,  score: 65, isAbsent: false, totalMarks: 80 },
    ]
    const [row] = buildSubjectRows(results, new Map([['s1', 'Science']]))

    // calcCBC(3, 1, 65): max=3, outOf20=20, total=85 → grade A (A=80–100)
    expect(row.grade).toBe('A')
    expect(row.total).not.toBeNull()
    expect(row.examScore).toBe(65)
    expect(row.descriptor).toBe('Exceptional')
  })

  it('absent end_of_term — examScore is null, grade remains null', () => {
    const results = [
      { subjectId: 's1', assessmentType: 'ca',          journalName: 'CA 1', caLabel: 'C1', score: 3, isAbsent: false, totalMarks: 3 },
      { subjectId: 's1', assessmentType: 'end_of_term', journalName: 'EoT',  caLabel: null,  score: 70, isAbsent: true, totalMarks: 80 },
    ]
    const [row] = buildSubjectRows(results, new Map([['s1', 'Science']]))

    expect(row.examScore).toBeNull()
    expect(row.grade).toBeNull()
  })

  it('multiple subjects are sorted alphabetically by name', () => {
    const results = [
      { subjectId: 'b', assessmentType: 'ca', journalName: 'j', caLabel: 'C1', score: 1, isAbsent: false, totalMarks: 3 },
      { subjectId: 'a', assessmentType: 'ca', journalName: 'j', caLabel: 'C1', score: 2, isAbsent: false, totalMarks: 3 },
    ]
    const names = new Map([['a', 'Mathematics'], ['b', 'English']])
    const rows = buildSubjectRows(results, names)
    expect(rows[0].subjectName).toBe('English')
    expect(rows[1].subjectName).toBe('Mathematics')
  })

  it('uses subjectId as fallback name when not in Map', () => {
    const results = [{
      subjectId: 'unknown-id', assessmentType: 'ca', journalName: 'j',
      caLabel: 'C1', score: 1, isAbsent: false, totalMarks: 3,
    }]
    const [row] = buildSubjectRows(results, new Map())
    expect(row.subjectName).toBe('unknown-id')
  })

  it('multiple CA entries are sorted by label number', () => {
    const results = [
      { subjectId: 's1', assessmentType: 'ca', journalName: 'j', caLabel: 'C3', score: 3, isAbsent: false, totalMarks: 3 },
      { subjectId: 's1', assessmentType: 'ca', journalName: 'j', caLabel: 'C1', score: 1, isAbsent: false, totalMarks: 3 },
      { subjectId: 's1', assessmentType: 'ca', journalName: 'j', caLabel: 'C2', score: 2, isAbsent: false, totalMarks: 3 },
    ]
    const [row] = buildSubjectRows(results, new Map([['s1', 'Maths']]))
    expect(row.caScores.map(c => c.label)).toEqual(['C1', 'C2', 'C3'])
    expect(row.caScores.map(c => c.score)).toEqual([1, 2, 3])
    expect(row.totalCaPoints).toBe(6)
    expect(row.maxCaPoints).toBe(9)   // 3 assessed × 3
  })

  it('caOutOf20 is correctly rounded to 1 decimal place', () => {
    // 5 total out of 6 max → (5/6)*20 = 16.666… → 16.7
    const results = [
      { subjectId: 's1', assessmentType: 'ca', journalName: 'j', caLabel: 'C1', score: 2, isAbsent: false, totalMarks: 3 },
      { subjectId: 's1', assessmentType: 'ca', journalName: 'j', caLabel: 'C2', score: 3, isAbsent: false, totalMarks: 3 },
    ]
    const [row] = buildSubjectRows(results, new Map([['s1', 'Art']]))
    expect(row.caOutOf20).toBe(16.7)
  })

  it('falls back to journalName as label when caLabel is null', () => {
    const results = [{
      subjectId: 's1', assessmentType: 'ca', journalName: 'June CA',
      caLabel: null, score: 2, isAbsent: false, totalMarks: 3,
    }]
    const [row] = buildSubjectRows(results, new Map([['s1', 'History']]))
    expect(row.caScores[0].label).toBe('June CA')
  })

  it('grade is null when assessed=0 but end_of_term exists', () => {
    // All CA entries absent → assessed=0 → grade stays null even with exam score
    const results = [
      { subjectId: 's1', assessmentType: 'ca', journalName: 'CA 1', caLabel: 'C1', score: null, isAbsent: true, totalMarks: 3 },
      { subjectId: 's1', assessmentType: 'end_of_term', journalName: 'EoT', caLabel: null, score: 70, isAbsent: false, totalMarks: 80 },
    ]
    const [row] = buildSubjectRows(results, new Map([['s1', 'Physics']]))
    expect(row.grade).toBeNull()
    expect(row.examScore).toBe(70)
  })
})

// ── generateReportCardPDF ────────────────────────────────────────

describe('generateReportCardPDF', () => {
  it('returns the jsPDF doc object', () => {
    const result = generateReportCardPDF(makeData())
    expect(result).toBe(mockDoc)
  })

  it('calls doc.text with the school name (uppercased)', () => {
    generateReportCardPDF(makeData({ school: { name: 'KJA', motto: null, logoUrl: null } }))
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs).toContain('KJA')
  })

  it('calls doc.text with the student full name', () => {
    generateReportCardPDF(makeData())
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs).toContain('Alice Nakato')
  })

  it('calls doc.text with the admission number', () => {
    generateReportCardPDF(makeData())
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs).toContain('KJA/2025/001')
  })

  it('renders class + stream name', () => {
    generateReportCardPDF(makeData())
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs).toContain('S.3 East')
  })

  it('renders teacher remarks text via splitTextToSize', () => {
    generateReportCardPDF(makeData({ teacherRemarks: 'Excellent work!' }))
    expect(mockDoc.splitTextToSize).toHaveBeenCalledWith('Excellent work!', expect.any(Number))
  })

  it('does not crash when principalRemarks is null', () => {
    expect(() => generateReportCardPDF(makeData({ principalRemarks: null }))).not.toThrow()
  })

  it('renders principalRemarks when provided', () => {
    generateReportCardPDF(makeData({ principalRemarks: 'Keep it up!' }))
    expect(mockDoc.splitTextToSize).toHaveBeenCalledWith('Keep it up!', expect.any(Number))
  })

  it('does not crash when attendance is 0 / 0', () => {
    expect(() => generateReportCardPDF(makeData({ daysPresent: 0, daysAbsent: 0 }))).not.toThrow()
  })

  it('does not crash when school motto is null', () => {
    expect(() =>
      generateReportCardPDF(makeData({ school: { name: 'KJA', motto: null, logoUrl: null } }))
    ).not.toThrow()
  })

  it('renders Term and Year in the header text', () => {
    generateReportCardPDF(makeData({ term: 2, year: 2025 }))
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs.some((t: unknown) =>
      typeof t === 'string' && t.includes('Term 2') && t.includes('2025')
    )).toBe(true)
  })

  it('renders school motto when provided', () => {
    generateReportCardPDF(makeData({
      school: { name: 'KJA', motto: 'Excellence in All', logoUrl: null },
    }))
    expect(mockDoc.splitTextToSize).not.toHaveBeenCalledWith('Excellence in All', expect.any(Number))
    // motto is rendered via doc.text — check for the quoted form
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs.some((t: unknown) =>
      typeof t === 'string' && t.includes('Excellence in All')
    )).toBe(true)
  })

  it('renders term dates when termStartDate and termEndDate are provided', () => {
    generateReportCardPDF(makeData({
      termStartDate: '2025-01-06',
      termEndDate:   '2025-04-04',
    }))
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    // fmtDate('2025-01-06') → '6 Jan 2025'
    expect(textArgs.some((t: unknown) =>
      typeof t === 'string' && t.includes('Jan 2025')
    )).toBe(true)
  })

  it('renders attendance section when daysPresent > 0', () => {
    generateReportCardPDF(makeData({ daysPresent: 60, daysAbsent: 2 }))
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs.some((t: unknown) =>
      typeof t === 'string' && t.includes('Days Present: 60')
    )).toBe(true)
  })

  it('renders attendance section when daysAbsent > 0 (and daysPresent = 0)', () => {
    generateReportCardPDF(makeData({ daysPresent: 0, daysAbsent: 3 }))
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs.some((t: unknown) =>
      typeof t === 'string' && t.includes('Days Absent: 3')
    )).toBe(true)
  })

  it('renders next term start date when provided', () => {
    generateReportCardPDF(makeData({ nextTermStartDate: '2025-05-05' }))
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs.some((t: unknown) =>
      typeof t === 'string' && t.includes('May 2025')
    )).toBe(true)
  })

  it('renders the performance table with subject rows', () => {
    const subjectRows = [{
      subjectName: 'Mathematics',
      caScores: [{ label: 'C1', score: 3 }],
      totalCaPoints: 3, maxCaPoints: 3, caOutOf20: 20,
      examScore: 65, total: 85, grade: 'B', gradePoints: 4,
      descriptor: 'Outstanding',
    }]
    expect(() => generateReportCardPDF(makeData({ subjects: subjectRows }))).not.toThrow()
  })

  it('uses em-dash when student gender is null', () => {
    generateReportCardPDF(makeData({
      student: {
        firstName: 'Pat', lastName: 'Okello',
        admissionNumber: 'KJA/2025/002', gender: null,
        className: 'S.1', streamName: 'West',
      },
    }))
    const textArgs = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textArgs).toContain('—')
  })
})
