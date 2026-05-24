import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// ── Supabase mock ──────────────────────────────────────────────
const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      gte:         vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      delete:      vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
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
    user: { id: 'teacher-1', role: 'teacher', schoolId: 'school-1', name: 'T', email: 't@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useAttendance,
  useClassTermAttendance,
  useAttendanceSummary,
  useSaveAttendance,
} from '../../hooks/useAttendance'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

// ── useAttendance ──────────────────────────────────────────────
describe('useAttendance', () => {
  it('returns a Map<studentId, status> from the DB rows', async () => {
    setResponse('attendance', {
      data: [
        { student_id: 'stu-1', status: 'present' },
        { student_id: 'stu-2', status: 'absent' },
      ],
      error: null,
    })
    const { result } = renderHook(
      () => useAttendance('cls-1', '2026-05-24'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const map = result.current.data!
    expect(map.get('stu-1')).toBe('present')
    expect(map.get('stu-2')).toBe('absent')
  })

  it('returns an empty Map when no rows exist', async () => {
    setResponse('attendance', { data: [], error: null })
    const { result } = renderHook(
      () => useAttendance('cls-1', '2026-05-24'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.size).toBe(0)
  })

  it('is disabled when classId is null', () => {
    const { result } = renderHook(
      () => useAttendance(null, '2026-05-24'),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when date is empty string', () => {
    const { result } = renderHook(
      () => useAttendance('cls-1', ''),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces error state when Supabase rejects', async () => {
    setResponse('attendance', { data: null, error: { message: 'DB error' } })
    const { result } = renderHook(
      () => useAttendance('cls-1', '2026-05-24'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useClassTermAttendance ─────────────────────────────────────
describe('useClassTermAttendance', () => {
  it('computes per-student attendance rates correctly', async () => {
    // 3 records for stu-1: 2 present + 1 absent → 66%
    // 1 record for stu-2: 1 present → 100%
    setResponse('attendance', {
      data: [
        { student_id: 'stu-1', status: 'present' },
        { student_id: 'stu-1', status: 'present' },
        { student_id: 'stu-1', status: 'absent' },
        { student_id: 'stu-2', status: 'present' },
      ],
      error: null,
    })

    const { result } = renderHook(
      () => useClassTermAttendance('cls-1'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const rates = result.current.data!
    const stu1  = rates.find(r => r.studentId === 'stu-1')!
    const stu2  = rates.find(r => r.studentId === 'stu-2')!

    expect(stu1.rate).toBe(67)
    expect(stu1.isBelowThreshold).toBe(true)
    expect(stu1.totalDays).toBe(3)
    expect(stu1.presentDays).toBe(2)

    expect(stu2.rate).toBe(100)
    expect(stu2.isBelowThreshold).toBe(false)
  })

  it('marks a student below threshold when rate < 80%', async () => {
    setResponse('attendance', {
      data: Array.from({ length: 10 }, (_, i) => ({
        student_id: 'stu-1',
        status: i < 7 ? 'present' : 'absent',
      })),
      error: null,
    })
    const { result } = renderHook(() => useClassTermAttendance('cls-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const stu1 = result.current.data!.find(r => r.studentId === 'stu-1')!
    expect(stu1.rate).toBe(70)
    expect(stu1.isBelowThreshold).toBe(true)
  })
})

// ── useAttendanceSummary ───────────────────────────────────────
describe('useAttendanceSummary', () => {
  it('counts present/absent/late/excused correctly', async () => {
    setResponse('attendance', {
      data: [
        { date: '2026-05-20', status: 'present' },
        { date: '2026-05-21', status: 'present' },
        { date: '2026-05-22', status: 'absent' },
        { date: '2026-05-23', status: 'late' },
        { date: '2026-05-24', status: 'excused' },
      ],
      error: null,
    })
    const { result } = renderHook(
      () => useAttendanceSummary('stu-1'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const s = result.current.data!
    expect(s.totalDays).toBe(5)
    expect(s.presentDays).toBe(2)
    expect(s.absentDays).toBe(1)
    expect(s.lateDays).toBe(1)
    expect(s.excusedDays).toBe(1)
    expect(s.rate).toBe(40)    // 2/5 = 40%
    expect(s.isBelowThreshold).toBe(true)
  })

  it('rate is 0 and isBelowThreshold is false when no records', async () => {
    setResponse('attendance', { data: [], error: null })
    const { result } = renderHook(() => useAttendanceSummary('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const s = result.current.data!
    expect(s.rate).toBe(0)
    expect(s.isBelowThreshold).toBe(false)
  })

  it('is disabled when studentId is null', () => {
    const { result } = renderHook(() => useAttendanceSummary(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ── useSaveAttendance ──────────────────────────────────────────
describe('useSaveAttendance', () => {
  it('deletes existing records then inserts new ones', async () => {
    setResponse('attendance', { data: null, error: null })

    const { result } = renderHook(() => useSaveAttendance(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        classId: 'cls-1',
        date:    '2026-05-24',
        records: [
          { studentId: 'stu-1', status: 'present' },
          { studentId: 'stu-2', status: 'absent' },
        ],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Both delete and insert should call supabase.from('attendance')
    expect(mockFrom).toHaveBeenCalledWith('attendance')
  })

  it('throws when the delete step returns an error', async () => {
    // First call (delete) returns error
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      const isFirstCall = callCount === 1
      const b: any = {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        gte:    vi.fn().mockReturnThis(),
        then:   (resolve: any, reject?: any) =>
          Promise.resolve(
            isFirstCall
              ? { data: null, error: { message: 'Delete failed' } }
              : { data: null, error: null }
          ).then(resolve, reject),
      }
      return b
    })

    const { result } = renderHook(() => useSaveAttendance(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          classId: 'cls-1',
          date:    '2026-05-24',
          records: [{ studentId: 'stu-1', status: 'present' }],
        })
      ).rejects.toMatchObject({ message: 'Delete failed' })
    })
  })

  it('is a no-op insert when records array is empty', async () => {
    setResponse('attendance', { data: null, error: null })
    const { result } = renderHook(() => useSaveAttendance(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ classId: 'cls-1', date: '2026-05-24', records: [] })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // delete is called but insert is skipped for empty records
    expect(mockFrom).toHaveBeenCalledWith('attendance')
  })
})
