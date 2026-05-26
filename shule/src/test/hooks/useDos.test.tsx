import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// ── Supabase mock ──────────────────────────────────────────────
const { mockFrom, makeBuilder, setTableData, clearAll } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setTableData   = (t: string, r: any) => { tableData[t] = r }
  const clearAll       = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:       vi.fn().mockReturnThis(),
      eq:           vi.fn().mockReturnThis(),
      in:           vi.fn().mockReturnThis(),
      not:          vi.fn().mockReturnThis(),
      neq:          vi.fn().mockReturnThis(),
      is:           vi.fn().mockReturnThis(),
      order:        vi.fn().mockReturnThis(),
      limit:        vi.fn().mockReturnThis(),
      insert:       vi.fn().mockReturnThis(),
      update:       vi.fn().mockReturnThis(),
      single:       vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
      maybeSingle:  vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, makeBuilder, setTableData, clearAll }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'dos-1', role: 'dos', schoolId: 'school-1', name: 'D', email: 'd@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useDosOverview,
  useDosClassPerformance,
  useAssignClassTeacher,
} from '../../hooks/useDos'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearAll()
  mockFrom.mockImplementation(makeBuilder)
})

// ── useDosOverview pass rate calculation ───────────────────────────────────
describe('useDosOverview — pass rate calculation', () => {
  it('computes overall pass rate correctly from results', async () => {
    // 10 results: 7 pass (>= 50), 3 fail
    setTableData('students',    { data: [{ id: 's1' }, { id: 's2' }], error: null })
    setTableData('staff',       { data: [{ id: 't1', role: 'teacher' }], error: null })
    setTableData('exam_journal',{ data: [{ id: 'j1', subject_id: 'sub1', pass_mark: 50, total_marks: 100, term: '1', year: 2025 }], error: null })
    setTableData('exam_results',{
      data: [
        ...Array.from({ length: 7 }, (_, i) => ({
          exam_journal_id: 'j1', subject_id: 'sub1',
          score: 50 + i * 5, is_absent: false, term: '1', year: 2025,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          exam_journal_id: 'j1', subject_id: 'sub1',
          score: 30 + i * 5, is_absent: false, term: '1', year: 2025,
        })),
      ],
      error: null,
    })
    setTableData('subjects', { data: [{ id: 'sub1', name: 'Mathematics' }], error: null })

    const { result } = renderHook(() => useDosOverview(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 })

    const overview = result.current.data!
    expect(overview.overallPassRate).toBe(70)          // 7/10 = 70%
    expect(overview.totalStudents).toBe(2)
    expect(overview.activeTeachers).toBe(1)
  })

  it('returns overallPassRate = 0 when no results exist', async () => {
    setTableData('students',    { data: [], error: null })
    setTableData('staff',       { data: [], error: null })
    setTableData('exam_journal',{ data: [], error: null })
    setTableData('exam_results',{ data: [], error: null })

    const { result } = renderHook(() => useDosOverview(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 })

    expect(result.current.data!.overallPassRate).toBe(0)
  })

  it('marks subject below 50 pass rate correctly', async () => {
    setTableData('students',    { data: [{ id: 's1' }], error: null })
    setTableData('staff',       { data: [], error: null })
    setTableData('exam_journal',{ data: [{ id: 'j1', subject_id: 'sub1', pass_mark: 50, total_marks: 100, term: '1', year: 2025 }], error: null })
    // Only 3 out of 10 pass — sub1 pass rate = 30%
    setTableData('exam_results',{
      data: [
        ...Array.from({ length: 3 }, () => ({ exam_journal_id: 'j1', subject_id: 'sub1', score: 60, is_absent: false, term: '1', year: 2025 })),
        ...Array.from({ length: 7 }, () => ({ exam_journal_id: 'j1', subject_id: 'sub1', score: 30, is_absent: false, term: '1', year: 2025 })),
      ],
      error: null,
    })
    setTableData('subjects', { data: [{ id: 'sub1', name: 'English' }], error: null })

    const { result } = renderHook(() => useDosOverview(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 })

    expect(result.current.data!.subjectsBelowFifty).toBe(1)
  })

  it('excludes absent students from pass rate calculation', async () => {
    setTableData('students',    { data: [{ id: 's1' }], error: null })
    setTableData('staff',       { data: [], error: null })
    setTableData('exam_journal',{ data: [{ id: 'j1', subject_id: 'sub1', pass_mark: 50, total_marks: 100, term: '1', year: 2025 }], error: null })
    setTableData('exam_results',{
      data: [
        { exam_journal_id: 'j1', subject_id: 'sub1', score: 80, is_absent: false, term: '1', year: 2025 },
        { exam_journal_id: 'j1', subject_id: 'sub1', score: null, is_absent: true, term: '1', year: 2025 },
        { exam_journal_id: 'j1', subject_id: 'sub1', score: null, is_absent: true, term: '1', year: 2025 },
      ],
      error: null,
    })
    setTableData('subjects', { data: [], error: null })

    const { result } = renderHook(() => useDosOverview(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 })

    // Only 1 graded student, and they passed → 100%
    expect(result.current.data!.overallPassRate).toBe(100)
  })
})

// ── useAssignClassTeacher ──────────────────────────────────────────────────
describe('useAssignClassTeacher', () => {
  it('throws when another stream in the same class already has a different class teacher', async () => {
    // Simulate: stream s2 in class cls-1 has class_teacher_id = 'other-teacher'
    setTableData('streams', {
      data: [{ id: 's2', class_teacher_id: 'other-teacher' }],
      error: null,
    })

    // Override mockFrom to return different data per call
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      const b: any = {
        select:  vi.fn().mockReturnThis(),
        eq:      vi.fn().mockReturnThis(),
        not:     vi.fn().mockReturnThis(),
        neq:     vi.fn().mockReturnThis(),
        is:      vi.fn().mockReturnThis(),
        update:  vi.fn().mockReturnThis(),
        order:   vi.fn().mockReturnThis(),
        then: (resolve: any, reject?: any) => {
          if (table === 'streams' && callCount <= 2) {
            // First call: checking for existing class teachers
            return Promise.resolve({ data: [{ id: 's2', class_teacher_id: 'other-teacher' }], error: null }).then(resolve, reject)
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject)
        },
      }
      return b
    })

    const { result } = renderHook(() => useAssignClassTeacher(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          streamId:  's1',
          classId:   'cls-1',
          teacherId: 'teacher-new',
        })
      ).rejects.toThrow('already has a class teacher')
    })
  })

  it('is disabled (idle) before mutation is called', () => {
    const { result } = renderHook(() => useAssignClassTeacher(), { wrapper: createWrapper() })
    expect(result.current.isIdle).toBe(true)
  })
})

// ── useDosClassPerformance ─────────────────────────────────────────────────
describe('useDosClassPerformance', () => {
  it('is disabled when classId is null', () => {
    const { result } = renderHook(
      () => useDosClassPerformance(null),
      { wrapper: createWrapper() }
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('returns subject breakdown with correct pass rates', async () => {
    setTableData('exam_journal', {
      data: [{ id: 'j1', subject_id: 'sub1', pass_mark: 50, class_id: 'cls-1' }],
      error: null,
    })
    setTableData('exam_results', {
      data: [
        { exam_journal_id: 'j1', student_id: 'stu-1', subject_id: 'sub1', score: 80, is_absent: false },
        { exam_journal_id: 'j1', student_id: 'stu-2', subject_id: 'sub1', score: 30, is_absent: false },
        { exam_journal_id: 'j1', student_id: 'stu-3', subject_id: 'sub1', score: 70, is_absent: false },
      ],
      error: null,
    })
    setTableData('students', {
      data: [
        { id: 'stu-1', first_name: 'Alice',   last_name: 'A' },
        { id: 'stu-2', first_name: 'Bob',     last_name: 'B' },
        { id: 'stu-3', first_name: 'Charlie', last_name: 'C' },
      ],
      error: null,
    })
    setTableData('subjects', { data: [{ id: 'sub1', name: 'Biology' }], error: null })

    const { result } = renderHook(
      () => useDosClassPerformance('cls-1'),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 })

    const perf = result.current.data!
    const sub = perf.subjectBreakdown.find(s => s.subjectId === 'sub1')!
    expect(sub.subjectName).toBe('Biology')
    expect(sub.passRate).toBe(67)   // 2/3 = 67%
    expect(sub.average).toBe(60)    // (80+30+70)/3 = 60

    // Top student = Alice (80), Bottom = Bob (30)
    expect(perf.topStudents[0].name).toBe('Alice A')
    expect(perf.bottomStudents[0].name).toBe('Bob B')
  })
})
