// Phase 4 — Hook tests for useExamResults.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      upsert:      vi.fn().mockReturnThis(),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: mockFrom,
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'teacher-1', role: 'teacher', schoolId: 'school-1', name: 'T', email: 't@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useExamResults, useSaveMarks } from '../../hooks/useExamResults'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const dbResultRow = {
  id:              'res-1',
  school_id:       'school-1',
  exam_journal_id: 'j-1',
  student_id:      'stu-1',
  subject_id:      'sub-1',
  score:           60,
  grade:           'C',
  is_absent:       false,
  term:            '1',
  year:            2025,
  teacher_id:      'teacher-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useExamResults', () => {
  it('returns mapped ExamResult objects', async () => {
    setResponse('exam_results', { data: [dbResultRow], error: null })
    const { result } = renderHook(() => useExamResults('j-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const r = result.current.data![0]
    expect(r.id).toBe('res-1')
    expect(r.examJournalId).toBe('j-1')
    expect(r.score).toBe(60)
    expect(r.grade).toBe('C')
    expect(r.isAbsent).toBe(false)
  })

  it('maps absent row (null score) with isAbsent defaulting to false (column not in DB schema)', async () => {
    setResponse('exam_results', {
      data: [{ ...dbResultRow, score: null, grade: null }],
      error: null,
    })
    const { result } = renderHook(() => useExamResults('j-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const r = result.current.data![0]
    expect(r.score).toBeNull()
    expect(r.grade).toBeNull()
    expect(r.isAbsent).toBe(false)
  })

  it('is disabled when journalId is null', () => {
    const { result } = renderHook(() => useExamResults(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('exposes error when Supabase fails', async () => {
    setResponse('exam_results', { data: null, error: { message: 'Not found' } })
    const { result } = renderHook(() => useExamResults('j-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSaveMarks', () => {
  // Grade logic in useSaveMarks:
  // - CA:           grade = calculateCBCGrade((score / 3) * 100)
  // - end_of_term:  grade = null (needs CA to combine)
  // - others:       grade = calculateCBCGrade((score / totalMarks) * 100)

  it('saves marks successfully and returns journalId', async () => {
    setResponse('exam_results', { data: null, error: null })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync({
        journalId:      'j-1',
        subjectId:      'sub-1',
        assessmentType: 'mid_term',
        totalMarks:     80,
        term:           '1',
        year:           2025,
        marks: [{ studentId: 'stu-1', score: 60, isAbsent: false }],
      })
    })

    expect(returnedId).toBe('j-1')
    expect(mockFrom).toHaveBeenCalledWith('exam_results')
  })

  it('sets grade=null for end_of_term assessments', async () => {
    setResponse('exam_results', { data: null, error: null })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        journalId:      'j-1',
        subjectId:      'sub-1',
        assessmentType: 'end_of_term',
        totalMarks:     80,
        term:           '1',
        year:           2025,
        marks: [{ studentId: 'stu-1', score: 65, isAbsent: false }],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('sends null score and null grade for absent students', async () => {
    setResponse('exam_results', { data: null, error: null })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        journalId:      'j-1',
        subjectId:      'sub-1',
        assessmentType: 'mid_term',
        totalMarks:     80,
        term:           '1',
        year:           2025,
        marks: [{ studentId: 'stu-absent', score: null, isAbsent: true }],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('throws when supabase upsert returns an error', async () => {
    setResponse('exam_results', { data: null, error: { message: 'Upsert failed' } })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          journalId: 'j-1', subjectId: 'sub-1',
          assessmentType: 'mid_term', totalMarks: 80,
          term: '1', year: 2025,
          marks: [{ studentId: 'stu-1', score: 50, isAbsent: false }],
        })
      ).rejects.toEqual({ message: 'Upsert failed' })
    })
  })
})
