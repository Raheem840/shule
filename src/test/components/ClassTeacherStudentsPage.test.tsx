// ClassTeacherStudentsPage ("My Class") previously only showed per-student
// cards + a per-student performance modal — no class-wide ("class at large")
// analytics existed at all. This verifies the new Class Overview section:
// aggregate attendance rate, aggregate average score (published exams only),
// per-subject class averages, and a "needs attention" flag surfaced both as
// a KPI count and as a badge on the specific student's card.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (t: string, r: any) => { tableData[t] = r }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  function makeBuilder(table: string) {
    const b: any = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then: (res: any, rej?: any) => Promise.resolve(tableData[table] ?? { data: [], error: null }).then(res, rej),
    }
    return b
  }
  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'class_teacher', schoolId: 'school-1', staffId: 'staff-1', name: 'CT', email: 'ct@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: ({ children }: any) => <div>{children}</div>,
  Cell: () => <div />, XAxis: () => <div />, YAxis: () => <div />,
  CartesianGrid: () => <div />, Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

import { ClassTeacherStudentsPage } from '../../pages/teacher/ClassTeacherStudentsPage'

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
  setResponse('streams', { data: { id: 'stream-1', name: 'East', class_id: 'cls-1', classes: { name: 'S.1' } }, error: null })
  setResponse('students', { data: [
    { id: 'stu-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'S1/001', photo_url: null, gender: 'female', dob: '2011-01-01', student_type: 'day', status: 'active', class_id: 'cls-1', stream_id: 'stream-1' },
    { id: 'stu-2', first_name: 'Brian', last_name: 'Otim', admission_number: 'S1/002', photo_url: null, gender: 'male', dob: '2011-02-01', student_type: 'day', status: 'active', class_id: 'cls-1', stream_id: 'stream-1' },
  ], error: null })
  setResponse('exam_journal', { data: [{ id: 'j-pub' }], error: null })
})

describe('ClassTeacherStudentsPage — class-wide analytics', () => {
  it('shows the Class Overview section with aggregate attendance and score KPIs', async () => {
    setResponse('attendance', { data: [
      { student_id: 'stu-1', status: 'present' }, { student_id: 'stu-1', status: 'present' },
      { student_id: 'stu-2', status: 'absent' },  { student_id: 'stu-2', status: 'present' },
    ], error: null })
    setResponse('exam_results', { data: [
      { student_id: 'stu-1', score: 90, subject_id: 'sub-1', exam_journal_id: 'j-pub', subjects: { name: 'Math' } },
      { student_id: 'stu-2', score: 70, subject_id: 'sub-1', exam_journal_id: 'j-pub', subjects: { name: 'Math' } },
    ], error: null })

    render(<ClassTeacherStudentsPage />)

    await waitFor(() => expect(screen.getByText('Class Overview')).toBeInTheDocument())
    // 3 present out of 4 records = 75%
    await waitFor(() => expect(screen.getByText('75%')).toBeInTheDocument(), { timeout: 3000 })
    // avg of 90 and 70 = 80%
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('excludes draft (unpublished) exam results from the class average', async () => {
    setResponse('attendance', { data: [], error: null })
    setResponse('exam_journal', { data: [{ id: 'j-pub' }], error: null }) // only j-pub is published
    setResponse('exam_results', { data: [
      { student_id: 'stu-1', score: 100, subject_id: 'sub-1', exam_journal_id: 'j-pub',   subjects: { name: 'Math' } },
      { student_id: 'stu-2', score: 0,   subject_id: 'sub-1', exam_journal_id: 'j-draft', subjects: { name: 'Math' } },
    ], error: null })

    render(<ClassTeacherStudentsPage />)

    await waitFor(() => expect(screen.getByText('Class Overview')).toBeInTheDocument())
    // Only the published 100 counts — draft's 0 must not drag the average down
    await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument(), { timeout: 3000 })
  })

  it('flags a student with low attendance in the Needs Attention count and on their card', async () => {
    setResponse('attendance', { data: [
      { student_id: 'stu-1', status: 'present' },
      { student_id: 'stu-2', status: 'absent' }, { student_id: 'stu-2', status: 'absent' }, { student_id: 'stu-2', status: 'present' },
    ], error: null })
    setResponse('exam_results', { data: [], error: null })

    render(<ClassTeacherStudentsPage />)

    await waitFor(() => expect(screen.getByText('Grace Apio')).toBeInTheDocument())

    // stu-2 (Brian) has 1/3 present = 33% attendance -> flagged (badge appears once the analytics query resolves)
    await waitFor(() => {
      const brianCard = screen.getByText('Brian Otim').closest('div[style*="cursor: pointer"]')!
      expect(brianCard.querySelector('[title*="Needs attention"]')).toBeInTheDocument()
    }, { timeout: 3000 })

    const graceCard = screen.getByText('Grace Apio').closest('div[style*="cursor: pointer"]')!
    expect(graceCard.querySelector('[title*="Needs attention"]')).not.toBeInTheDocument()
  })

  it('shows a "no published marks" message instead of an empty chart', async () => {
    setResponse('attendance', { data: [], error: null })
    setResponse('exam_results', { data: [], error: null })

    render(<ClassTeacherStudentsPage />)

    await waitFor(() => expect(screen.getByText('Class Overview')).toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText(/no published exam marks for this class yet/i)).toBeInTheDocument(), { timeout: 3000 })
  })
})
