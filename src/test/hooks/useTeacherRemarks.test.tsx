// Phase 4 — Hook tests for useTeacherRemarks.ts
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
      neq:         vi.fn().mockReturnThis(),
      not:         vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      upsert:      vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
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
    user: { id: 'teacher-1', staffId: 'staff-teacher-1', role: 'teacher', schoolId: 'school-1', name: 'T', email: 't@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useTeacherRemarks, useSaveRemarks, useStudentPerformanceBands, bandForScore, PERFORMANCE_BANDS, BAND_REMARK_TEMPLATES } from '../../hooks/useTeacherRemarks'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const dbRemarkRow = {
  id:         'rem-1',
  school_id:  'school-1',
  student_id: 'stu-1',
  teacher_id: 'teacher-1',
  class_id:   'cls-1',
  stream_id:  null,
  term:       '1',
  year:       2025,
  remarks:    'Good effort this term.',
  created_at: '2025-06-01T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useTeacherRemarks', () => {
  it('returns a Map<studentId, TeacherRemark> from DB rows', async () => {
    setResponse('teacher_remarks', { data: [dbRemarkRow], error: null })
    const { result } = renderHook(
      () => useTeacherRemarks({ term: '1', classId: 'cls-1', streamId: null, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const map = result.current.data!
    expect(map).toBeInstanceOf(Map)
    expect(map.size).toBe(1)

    const remark = map.get('stu-1')!
    expect(remark).toBeDefined()
    expect(remark.id).toBe('rem-1')
    expect(remark.remarks).toBe('Good effort this term.')
    expect(remark.term).toBe('1')
    expect(remark.year).toBe(2025)
  })

  it('returns an empty Map when no remarks exist', async () => {
    setResponse('teacher_remarks', { data: [], error: null })
    const { result } = renderHook(
      () => useTeacherRemarks({ term: '1', classId: 'cls-1', streamId: null, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const map = result.current.data!
    expect(map).toBeInstanceOf(Map)
    expect(map.size).toBe(0)
  })

  it('is disabled when term is null', () => {
    const { result } = renderHook(
      () => useTeacherRemarks({ term: null, classId: 'cls-1', streamId: null, year: 2025 }),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when classId is null', () => {
    const { result } = renderHook(
      () => useTeacherRemarks({ term: '1', classId: null, streamId: null, year: 2025 }),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when year is null', () => {
    const { result } = renderHook(
      () => useTeacherRemarks({ term: '1', classId: 'cls-1', streamId: null, year: null }),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('stores last writer wins when multiple rows have the same studentId', async () => {
    // Both rows have student_id 'stu-1' — the second one should win in the Map
    setResponse('teacher_remarks', {
      data: [
        { ...dbRemarkRow, remarks: 'First remark' },
        { ...dbRemarkRow, id: 'rem-2', remarks: 'Updated remark' },
      ],
      error: null,
    })
    const { result } = renderHook(
      () => useTeacherRemarks({ term: '1', classId: 'cls-1', streamId: null, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const map = result.current.data!
    expect(map.size).toBe(1)
    // Last write wins — the Map.set in the loop overwrites the first entry
    expect(map.get('stu-1')?.remarks).toBe('Updated remark')
  })

  it('exposes error when Supabase fails', async () => {
    setResponse('teacher_remarks', { data: null, error: { message: 'Permission denied' } })
    const { result } = renderHook(
      () => useTeacherRemarks({ term: '1', classId: 'cls-1', streamId: null, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSaveRemarks', () => {
  it('calls supabase upsert on teacher_remarks and resolves', async () => {
    setResponse('teacher_remarks', { data: null, error: null })
    const { result } = renderHook(() => useSaveRemarks(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        term:     '1',
        year:     2025,
        classId:  'cls-1',
        streamId: null,
        rows: [
          { studentId: 'stu-1', remarks: 'Excellent work this term.' },
          { studentId: 'stu-2', remarks: 'Needs to improve participation.' },
        ],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('teacher_remarks')
  })

  it('resolves with no rows (empty batch is a no-op)', async () => {
    setResponse('teacher_remarks', { data: null, error: null })
    const { result } = renderHook(() => useSaveRemarks(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        term: '1', year: 2025, classId: 'cls-1', streamId: null, rows: [],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('throws when supabase upsert fails', async () => {
    setResponse('teacher_remarks', { data: null, error: { message: 'Upsert failed' } })
    const { result } = renderHook(() => useSaveRemarks(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          term: '1', year: 2025, classId: 'cls-1', streamId: null,
          rows: [{ studentId: 'stu-1', remarks: 'Good.' }],
        })
      ).rejects.toEqual({ message: 'Upsert failed' })
    })
  })
})

describe('bandForScore', () => {
  it('classifies scores into the 4 CBC bands correctly at boundaries', () => {
    expect(bandForScore(0)).toBe('basic')
    expect(bandForScore(49)).toBe('basic')
    expect(bandForScore(50)).toBe('elementary')
    expect(bandForScore(64)).toBe('elementary')
    expect(bandForScore(65)).toBe('moderate')
    expect(bandForScore(79)).toBe('moderate')
    expect(bandForScore(80)).toBe('distinction')
    expect(bandForScore(100)).toBe('distinction')
  })

  it('every band has a non-empty template', () => {
    for (const b of PERFORMANCE_BANDS) {
      expect(BAND_REMARK_TEMPLATES[b.value].length).toBeGreaterThan(0)
    }
  })
})

describe('useStudentPerformanceBands', () => {
  it('computes each student\'s average from PUBLISHED exam results only and buckets into a band', async () => {
    setResponse('exam_journal', { data: [{ id: 'j-pub' }], error: null })
    setResponse('exam_results', {
      data: [
        { student_id: 'stu-1', score: 90, exam_journal_id: 'j-pub' },
        { student_id: 'stu-1', score: 70, exam_journal_id: 'j-pub' },
        { student_id: 'stu-2', score: 100, exam_journal_id: 'j-draft' }, // unpublished — must be excluded
      ],
      error: null,
    })

    const { result } = renderHook(() => useStudentPerformanceBands(['stu-1', 'stu-2'], '1', 2026), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const map = result.current.data!
    expect(map.get('stu-1')).toEqual({ avg: 80, band: 'distinction' })
    // stu-2's only result is from a draft journal — excluded entirely, no entry
    expect(map.has('stu-2')).toBe(false)
  })

  it('is disabled when there are no student IDs', () => {
    const { result } = renderHook(() => useStudentPerformanceBands([], '1', 2026), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
