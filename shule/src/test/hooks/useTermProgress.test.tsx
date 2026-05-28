import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (t: string, r: any) => { tableData[t] = r }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  function makeBuilder(table: string) {
    const b: any = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(), upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
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
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: mockFrom,
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'teacher-1', role: 'teacher', schoolId: 'school-1', name: 'T', email: 't@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useTermProgress } from '../../hooks/useTermProgress'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

describe('useTermProgress', () => {
  it('returns safe defaults when no active academic year', async () => {
    setResponse('academic_years', { data: null, error: null })
    const { result } = renderHook(() => useTermProgress(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const data = result.current.data!
    expect(data.events).toEqual([])
    expect(data.weekNumber).toBe(1)
    expect(data.totalWeeks).toBe(13)
  })

  it('uses date_given from exam_journal — not date', async () => {
    // Academic year with active term
    setResponse('academic_years', {
      data: {
        id: 'ay-1', name: '2025', start_date: '2025-01-01', end_date: '2025-12-31', is_active: true,
        term1_start: '2025-01-01', term1_end: '2025-04-30',
        term2_start: '2025-05-01', term2_end: '2025-08-31',
        term3_start: '2025-09-01', term3_end: '2025-12-31',
      },
      error: null,
    })
    setResponse('exam_journal', { data: [
      { id: 'j-1', name: 'Mid-Term', assessment_type: 'ca',
        date_given: '2025-02-15', subject_id: 'sub-1', class_id: 'cls-1', term: '1', year: 2025 },
    ], error: null })
    setResponse('school_events', { data: [], error: null })

    const { result } = renderHook(() => useTermProgress(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const events = result.current.data!.events
    expect(events.length).toBeGreaterThanOrEqual(1)
    // The event date must come from date_given, not a column called 'date'
    const journalEvent = events.find(e => e.id === 'j-1')
    expect(journalEvent?.date).toBe('2025-02-15')
    expect(journalEvent?.type).toBe('ca')
  })

  it('exposes error on failure', async () => {
    setResponse('academic_years', { data: null, error: { message: 'DB error' } })
    const { result } = renderHook(() => useTermProgress(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('returns null if academic year has no term dates', async () => {
    setResponse('academic_years', {
      data: {
        id: 'ay-1', name: '2025', start_date: '2025-01-01', end_date: '2025-12-31', is_active: true,
        term1_start: null, term1_end: null,
        term2_start: null, term2_end: null,
        term3_start: null, term3_end: null,
      },
      error: null,
    })
    setResponse('exam_journal', { data: [], error: null })
    setResponse('school_events', { data: [], error: null })
    const { result } = renderHook(() => useTermProgress(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Falls back to safe defaults
    expect(result.current.data!.events).toEqual([])
  })
})
