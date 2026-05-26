import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// ── Supabase mock ──────────────────────────────────────────────
const { mockFrom, setTableData, clearAll } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setTableData = (t: string, r: any) => { tableData[t] = r }
  const clearAll     = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  const mockInsert = vi.fn().mockReturnThis()

  function makeBuilder(table: string) {
    const b: any = {
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      in:      vi.fn().mockReturnThis(),
      is:      vi.fn().mockReturnThis(),
      order:   vi.fn().mockReturnThis(),
      insert:  mockInsert,
      update:  vi.fn().mockReturnThis(),
      single:  vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, mockInsert, setTableData, clearAll }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'deputy-1', role: 'deputy', schoolId: 'school-1', name: 'D', email: 'd@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useDeputyOverview,
  useDisciplineRecords,
  useAddDisciplineRecord,
  useTimetable,
} from '../../hooks/useDeputy'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearAll()
})

// ── useDeputyOverview ──────────────────────────────────────────────────────
describe('useDeputyOverview', () => {
  it('returns class attendance summaries', async () => {
    setTableData('classes', {
      data: [{ id: 'cls-1', name: 'S.1', level: 'S1' }],
      error: null,
    })
    setTableData('attendance', {
      data: [
        { class_id: 'cls-1', student_id: 'stu-1', status: 'present' },
        { class_id: 'cls-1', student_id: 'stu-2', status: 'present' },
        { class_id: 'cls-1', student_id: 'stu-3', status: 'absent' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useDeputyOverview(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const summaries = result.current.data!
    expect(summaries).toHaveLength(1)
    const cls1 = summaries[0]
    expect(cls1.classId).toBe('cls-1')
    expect(cls1.attendanceRate).toBe(67)  // 2/3 = 67%
    expect(cls1.isBelowThreshold).toBe(true)
  })

  it('flags class below 80% attendance as below threshold', async () => {
    setTableData('classes', {
      data: [{ id: 'cls-1', name: 'S.2', level: 'S2' }],
      error: null,
    })
    // 7/10 present = 70% — below threshold
    setTableData('attendance', {
      data: [
        ...Array.from({ length: 7 }, () => ({ class_id: 'cls-1', student_id: 'stu-1', status: 'present' })),
        ...Array.from({ length: 3 }, () => ({ class_id: 'cls-1', student_id: 'stu-1', status: 'absent' })),
      ],
      error: null,
    })

    const { result } = renderHook(() => useDeputyOverview(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data![0].isBelowThreshold).toBe(true)
    expect(result.current.data![0].attendanceRate).toBe(70)
  })

  it('does NOT flag class at exactly 80% as below threshold', async () => {
    setTableData('classes', { data: [{ id: 'cls-1', name: 'S.3', level: 'S3' }], error: null })
    // 8/10 present = 80%
    setTableData('attendance', {
      data: [
        ...Array.from({ length: 8 }, () => ({ class_id: 'cls-1', student_id: 'stu-1', status: 'present' })),
        ...Array.from({ length: 2 }, () => ({ class_id: 'cls-1', student_id: 'stu-1', status: 'absent' })),
      ],
      error: null,
    })

    const { result } = renderHook(() => useDeputyOverview(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data![0].isBelowThreshold).toBe(false)
    expect(result.current.data![0].attendanceRate).toBe(80)
  })
})

// ── useDisciplineRecords ───────────────────────────────────────────────────
describe('useDisciplineRecords', () => {
  it('returns discipline records mapped to DisciplineRecord type', async () => {
    setTableData('discipline_records', {
      data: [
        {
          id: 'd1', school_id: 'school-1', student_id: 'stu-1', class_id: 'cls-1',
          incident_date: '2026-05-20', nature: 'lateness',
          resolution: 'Sent home', notes: null, recorded_by: 'deputy-1',
          created_at: '2026-05-20T08:00:00Z',
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useDisciplineRecords(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const records = result.current.data!
    expect(records).toHaveLength(1)
    expect(records[0].id).toBe('d1')
    expect(records[0].nature).toBe('lateness')
    expect(records[0].resolution).toBe('Sent home')
    expect(records[0].recordedBy).toBe('deputy-1')
  })

  it('returns empty array when no records exist', async () => {
    setTableData('discipline_records', { data: [], error: null })
    const { result } = renderHook(() => useDisciplineRecords(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!).toHaveLength(0)
  })
})

// ── useAddDisciplineRecord ─────────────────────────────────────────────────
describe('useAddDisciplineRecord', () => {
  it('calls supabase.from(discipline_records).insert with correct fields', async () => {
    setTableData('discipline_records', { data: null, error: null })

    const { result } = renderHook(() => useAddDisciplineRecord(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        studentId:    'stu-1',
        classId:      'cls-1',
        incidentDate: '2026-05-24',
        nature:       'misconduct',
        resolution:   'Parent meeting arranged',
        notes:        'Second offence',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('discipline_records')
  })

  it('throws when Supabase insert returns an error', async () => {
    mockFrom.mockImplementationOnce(() => ({
      insert: vi.fn().mockReturnThis(),
      then: (resolve: any, reject?: any) =>
        Promise.resolve({ data: null, error: { message: 'RLS denied' } }).then(resolve, reject),
    }))

    const { result } = renderHook(() => useAddDisciplineRecord(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          studentId:    'stu-1',
          classId:      null,
          incidentDate: '2026-05-24',
          nature:       'violence',
          resolution:   'Suspended',
          notes:        null,
        })
      ).rejects.toThrow('RLS denied')
    })
  })
})

// ── useTimetable ───────────────────────────────────────────────────────────
describe('useTimetable', () => {
  it('returns timetable periods mapped correctly', async () => {
    setTableData('timetable', {
      data: [
        {
          id: 't1', school_id: 'school-1', class_id: 'cls-1',
          subject_id: 'sub1', teacher_id: 'tch-1',
          day_of_week: 1, period_number: 1,
          start_time: '08:00', end_time: '09:00',
          term: '1', year: 2025,
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useTimetable(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const periods = result.current.data!
    expect(periods).toHaveLength(1)
    expect(periods[0].dayOfWeek).toBe(1)
    expect(periods[0].periodNumber).toBe(1)
    expect(periods[0].startTime).toBe('08:00')
    expect(periods[0].endTime).toBe('09:00')
  })

  it('is not disabled when classId is undefined', async () => {
    setTableData('timetable', { data: [], error: null })
    const { result } = renderHook(() => useTimetable(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!).toHaveLength(0)
  })
})
