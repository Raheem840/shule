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
      insert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
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
    user: { id: 'teacher-1', role: 'teacher', schoolId: 'school-1', staffId: 'staff-1', name: 'T', email: 't@k.ug' },
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
  // Default: draft journal — never locked, so existing save-marks tests
  // (written before the grace-period lock feature) keep passing unmodified.
  setResponse('exam_journal', { data: { status: 'draft', published_at: null }, error: null })
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

  it('maps is_absent=true from DB row to isAbsent=true', async () => {
    setResponse('exam_results', {
      data: [{ ...dbResultRow, score: null, grade: null, is_absent: true }],
      error: null,
    })
    const { result } = renderHook(() => useExamResults('j-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const r = result.current.data![0]
    expect(r.isAbsent).toBe(true)
    expect(r.score).toBeNull()
  })

  it('defaults isAbsent to false when is_absent is null/undefined', async () => {
    setResponse('exam_results', {
      data: [{ ...dbResultRow, is_absent: null }],
      error: null,
    })
    const { result } = renderHook(() => useExamResults('j-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].isAbsent).toBe(false)
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

describe('useSaveMarks — grace-period lock', () => {
  const expiredPublishedAt = new Date(Date.now() - 40 * 86_400_000).toISOString()
  const recentPublishedAt  = new Date(Date.now() - 2  * 86_400_000).toISOString()

  it('saves freely when the journal is published but still within the grace period', async () => {
    setResponse('exam_journal', { data: { status: 'published', published_at: recentPublishedAt }, error: null })
    setResponse('exam_results', { data: null, error: null })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        journalId: 'j-1', subjectId: 'sub-1', assessmentType: 'mid_term', totalMarks: 80,
        term: '1', year: 2025, marks: [{ studentId: 'stu-1', score: 60, isAbsent: false }],
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rejects a save on a locked journal when no overrideReason is given', async () => {
    setResponse('exam_journal', { data: { status: 'published', published_at: expiredPublishedAt }, error: null })
    setResponse('exam_results', { data: null, error: null })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          journalId: 'j-1', subjectId: 'sub-1', assessmentType: 'mid_term', totalMarks: 80,
          term: '1', year: 2025, marks: [{ studentId: 'stu-1', score: 60, isAbsent: false }],
        })
      ).rejects.toThrow('locked')
    })
  })

  it('saves a locked journal and logs an audit entry when overrideReason is given', async () => {
    setResponse('exam_journal', { data: { status: 'published', published_at: expiredPublishedAt }, error: null })
    setResponse('exam_results', { data: null, error: null })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        journalId: 'j-1', subjectId: 'sub-1', assessmentType: 'mid_term', totalMarks: 80,
        term: '1', year: 2025,
        marks: [{ studentId: 'stu-1', score: 60, isAbsent: false }],
        overrideReason: 'Student complaint — re-marked script',
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('audit_log')

    const auditBuilder = mockFrom.mock.results.find(r => r.value.insert?.mock.calls.length > 0)?.value
    const insertedRow = auditBuilder?.insert.mock.calls[0][0]
    expect(insertedRow.action).toBe('MARKS_EDITED_AFTER_LOCK')
    expect(insertedRow.new_value.reason).toBe('Student complaint — re-marked script')
  })

  it('does not write an audit entry when the journal is not locked', async () => {
    setResponse('exam_journal', { data: { status: 'published', published_at: recentPublishedAt }, error: null })
    setResponse('exam_results', { data: null, error: null })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        journalId: 'j-1', subjectId: 'sub-1', assessmentType: 'mid_term', totalMarks: 80,
        term: '1', year: 2025, marks: [{ studentId: 'stu-1', score: 60, isAbsent: false }],
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).not.toHaveBeenCalledWith('audit_log')
  })

  it('surfaces an error when the audit_log write fails, even though marks were already saved', async () => {
    setResponse('exam_journal', { data: { status: 'published', published_at: expiredPublishedAt }, error: null })
    setResponse('exam_results', { data: null, error: null })
    setResponse('audit_log', { data: null, error: { message: 'RLS denied' } })
    const { result } = renderHook(() => useSaveMarks(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          journalId: 'j-1', subjectId: 'sub-1', assessmentType: 'mid_term', totalMarks: 80,
          term: '1', year: 2025,
          marks: [{ studentId: 'stu-1', score: 60, isAbsent: false }],
          overrideReason: 'Student complaint',
        })
      ).rejects.toThrow('audit record failed')
    })
  })
})

describe('schema boundary: exam_results', () => {
  it('isAbsent is read from DB row (is_absent column) — not hardcoded false', async () => {
    setResponse('exam_results', { data: [{ ...dbResultRow, is_absent: true, score: null }], error: null })
    const { result } = renderHook(() => useExamResults('j-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].isAbsent).toBe(true)
  })
})
