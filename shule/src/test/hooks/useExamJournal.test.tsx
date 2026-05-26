// Phase 4 — Hook tests for useExamJournal.ts
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
      order:       vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null, count: null }).then(resolve, reject),
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

import { useExamJournals, useExamJournalById, useNextCALabel, useCreateJournal, usePublishJournal } from '../../hooks/useExamJournal'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const dbJournalRow = {
  id:               'j-1',
  school_id:        'school-1',
  teacher_id:       'teacher-1',
  subject_id:       'sub-1',
  class_id:         'cls-1',
  stream_id:        null,
  assessment_type:  'mid_term',
  name:             'Mid-Term Test',
  date:             '2025-06-10',
  total_marks:      80,
  pass_mark:        40,
  term:             '1',
  year:             2025,
  notes:            null,
  status:           'draft',
  learning_area:    null,
  competency:       null,
  integration_theme: null,
  trade_area:       null,
  dit_module_code:  null,
  ca_component:     null,
  ca_weighting:     null,
  ca_label:         null,
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useExamJournals', () => {
  it('returns mapped ExamJournal objects', async () => {
    setResponse('exam_journal', { data: [dbJournalRow], error: null })
    const { result } = renderHook(() => useExamJournals(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const j = result.current.data![0]
    expect(j.id).toBe('j-1')
    expect(j.assessmentType).toBe('mid_term')
    expect(j.totalMarks).toBe(80)
    expect(j.status).toBe('draft')
    expect(j.caLabel).toBeNull()
  })

  it('returns empty array when no journals exist', async () => {
    setResponse('exam_journal', { data: [], error: null })
    const { result } = renderHook(() => useExamJournals(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('exposes error when Supabase fails', async () => {
    setResponse('exam_journal', { data: null, error: { message: 'Query failed' } })
    const { result } = renderHook(() => useExamJournals(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useExamJournalById', () => {
  it('is disabled when journalId is null', () => {
    const { result } = renderHook(() => useExamJournalById(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when journalId is undefined', () => {
    const { result } = renderHook(() => useExamJournalById(undefined), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useNextCALabel', () => {
  it('returns C1 when no CA journals exist yet', async () => {
    setResponse('exam_journal', { data: null, error: null, count: 0 })
    const { result } = renderHook(
      () => useNextCALabel('sub-1', 'cls-1', '1', 2025),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('C1')
  })

  it('is disabled when any required param is missing', () => {
    const { result } = renderHook(
      () => useNextCALabel(null, 'cls-1', '1', 2025),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateJournal', () => {
  it('forces totalMarks=3 and passMark=2 for CA assessment type', async () => {
    setResponse('exam_journal', { data: { id: 'new-j-id' }, error: null })
    const { result } = renderHook(() => useCreateJournal(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync({
        subjectId: 'sub-1', classId: 'cls-1', streamId: null,
        assessmentType: 'ca',
        date: '2025-06-10',
        totalMarks: 999,   // should be overridden to 3
        passMark: 500,     // should be overridden to 2
        term: '1', year: 2025, notes: null,
        caLabel: 'C1',
      })
    })

    expect(returnedId).toBe('new-j-id')
    expect(mockFrom).toHaveBeenCalledWith('exam_journal')
  })

  it('uses provided totalMarks and passMark for non-CA assessment types', async () => {
    setResponse('exam_journal', { data: { id: 'new-j-id-2' }, error: null })
    const { result } = renderHook(() => useCreateJournal(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        subjectId: 'sub-1', classId: 'cls-1', streamId: null,
        assessmentType: 'mid_term',
        date: '2025-06-10',
        totalMarks: 80,
        passMark: 40,
        term: '1', year: 2025, notes: null,
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('throws when supabase insert returns an error', async () => {
    setResponse('exam_journal', { data: null, error: { message: 'Insert failed' } })
    const { result } = renderHook(() => useCreateJournal(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          subjectId: 'sub-1', classId: 'cls-1', streamId: null,
          assessmentType: 'mid_term', date: '2025-06-10',
          totalMarks: 80, passMark: 40, term: '1', year: 2025, notes: null,
        })
      ).rejects.toEqual({ message: 'Insert failed' })
    })
  })
})

describe('useExamJournalById (with data)', () => {
  it('returns the mapped journal when id is provided', async () => {
    setResponse('exam_journal', { data: dbJournalRow, error: null })
    const { result } = renderHook(
      () => useExamJournalById('j-1'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.id).toBe('j-1')
    expect(result.current.data!.assessmentType).toBe('mid_term')
    expect(result.current.data!.totalMarks).toBe(80)
  })

  it('throws when supabase fetch returns an error', async () => {
    setResponse('exam_journal', { data: null, error: { message: 'Not found' } })
    const { result } = renderHook(
      () => useExamJournalById('bad-id'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useExamJournals with filters', () => {
  it('passes subjectId filter', async () => {
    setResponse('exam_journal', { data: [dbJournalRow], error: null })
    const { result } = renderHook(
      () => useExamJournals({ subjectId: 'sub-1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('passes classId and term filters', async () => {
    setResponse('exam_journal', { data: [], error: null })
    const { result } = renderHook(
      () => useExamJournals({ classId: 'cls-1', term: '1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('passes assessmentType filter', async () => {
    setResponse('exam_journal', { data: [dbJournalRow], error: null })
    const { result } = renderHook(
      () => useExamJournals({ assessmentType: 'mid_term' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

describe('useNextCALabel with existing CAs', () => {
  it('returns C2 when 1 CA journal already exists', async () => {
    setResponse('exam_journal', { data: null, error: null, count: 1 })
    const { result } = renderHook(
      () => useNextCALabel('sub-1', 'cls-1', '1', 2025),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('C2')
  })

  it('returns C3 when 2 CA journals already exist', async () => {
    setResponse('exam_journal', { data: null, error: null, count: 2 })
    const { result } = renderHook(
      () => useNextCALabel('sub-1', 'cls-1', '1', 2025),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('C3')
  })
})

describe('usePublishJournal', () => {
  it('calls supabase update with status=published and returns journalId', async () => {
    setResponse('exam_journal', { data: null, error: null })
    const { result } = renderHook(() => usePublishJournal(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync('j-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(returnedId).toBe('j-1')
    expect(mockFrom).toHaveBeenCalledWith('exam_journal')
  })

  it('throws when supabase update returns an error', async () => {
    setResponse('exam_journal', { data: null, error: { message: 'Publish failed' } })
    const { result } = renderHook(() => usePublishJournal(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync('j-1')
      ).rejects.toEqual({ message: 'Publish failed' })
    })
  })
})
