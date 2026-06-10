import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
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
      delete: vi.fn().mockReturnThis(),
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
    user: { id: 'dos-1', role: 'dos', schoolId: 'school-1', name: 'D', email: 'd@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useTimetableSlots,
  useCreateTimetableSlot,
  useDeleteTimetableSlot,
  usePublishTimetable,
} from '../../hooks/useTimetableSlots'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

const dbSlot = {
  id: 'slot-1', school_id: 'school-1', class_id: 'cls-1', stream_id: null,
  subject_id: 'sub-1', teacher_id: 'staff-1',
  day_of_week: 2, period_number: 3,
  start_time: '09:00', end_time: '10:00',
  term: '1', year: 2025, is_published: false,
}

describe('useTimetableSlots', () => {
  it('maps slot rows with is_published as boolean', async () => {
    setResponse('timetable_slots', { data: [dbSlot], error: null })
    setResponse('subjects', { data: [], error: null })
    setResponse('staff', { data: [], error: null })
    const { result } = renderHook(() => useTimetableSlots({}), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const slot = result.current.data![0]
    expect(slot.dayOfWeek).toBe(2)
    expect(slot.periodNumber).toBe(3)
    expect(slot.isPublished).toBe(false)
    expect(slot.term).toBe('1')
  })

  it('returns empty array when table does not exist (42P01)', async () => {
    setResponse('timetable_slots', { data: null, error: { code: '42P01', message: 'table not found' } })
    const { result } = renderHook(() => useTimetableSlots({}), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('returns empty array when no slots', async () => {
    setResponse('timetable_slots', { data: [], error: null })
    setResponse('subjects', { data: [], error: null })
    setResponse('staff', { data: [], error: null })
    const { result } = renderHook(() => useTimetableSlots({}), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useCreateTimetableSlot', () => {
  it('calls supabase upsert on timetable_slots', async () => {
    setResponse('timetable_slots', { data: null, error: null })
    const { result } = renderHook(() => useCreateTimetableSlot(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        classId: 'cls-1', streamId: null, subjectId: 'sub-1', teacherId: 'staff-1',
        dayOfWeek: 1, periodNumber: 1, term: '1', year: 2025,
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('timetable_slots')
  })

  it('silently succeeds when table does not exist (42P01)', async () => {
    setResponse('timetable_slots', { data: null, error: { code: '42P01', message: 'not found' } })
    const { result } = renderHook(() => useCreateTimetableSlot(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        classId: 'cls-1', streamId: null, subjectId: 'sub-1', teacherId: 'staff-1',
        dayOfWeek: 1, periodNumber: 1, term: '1', year: 2025,
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useDeleteTimetableSlot', () => {
  it('calls supabase delete on timetable_slots', async () => {
    setResponse('timetable_slots', { data: null, error: null })
    const { result } = renderHook(() => useDeleteTimetableSlot(), { wrapper: createWrapper() })
    await act(async () => { await result.current.mutateAsync('slot-1') })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('timetable_slots')
  })
})

describe('usePublishTimetable', () => {
  it('calls supabase update with is_published true', async () => {
    setResponse('timetable_slots', { data: null, error: null })
    const { result } = renderHook(() => usePublishTimetable(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ classId: 'cls-1', term: '1', year: 2025 })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('timetable_slots')
  })
})
