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
    user: { id: 'secretary-1', role: 'secretary', schoolId: 'school-1', name: 'S', email: 's@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useSecretaryBriefing } from '../../hooks/useSecretaryBriefing'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

describe('useSecretaryBriefing', () => {
  it('returns structured briefing data with all expected fields', async () => {
    setResponse('academic_years', { data: [{
      id: 'ay-1', name: '2025', label: '2025',
      term1_start: '2025-01-01', term1_end: '2025-04-30',
      term2_start: '2025-05-01', term2_end: '2025-08-31',
      term3_start: '2025-09-01', term3_end: '2025-12-31',
      is_active: true,
    }], error: null })
    setResponse('students',     { data: [
      { id: 'stu-1', status: 'active',    enrolled_at: '2024-02-01T00:00:00Z' },
      { id: 'stu-2', status: 'suspended', enrolled_at: '2024-02-01T00:00:00Z' },
    ], error: null })
    setResponse('staff',        { data: [{ id: 'staff-1', role: 'teacher', is_active: true }], error: null })
    setResponse('exam_results', { data: [], error: null })
    setResponse('exam_journal', { data: [], error: null })
    setResponse('subjects',     { data: [], error: null })
    setResponse('fee_payments', { data: [
      { student_id: 'stu-1', amount_due: 400000, amount_paid: 400000 },
      { student_id: 'stu-2', amount_due: 400000, amount_paid: 0 },
    ], error: null })
    setResponse('attendance',   { data: [], error: null })
    setResponse('classes',      { data: [], error: null })
    setResponse('report_cards', { data: [
      { id: 'rc-1', status: 'ready' },
      { id: 'rc-2', status: 'approved' },
    ], error: null })

    const { result } = renderHook(() => useSecretaryBriefing(1, 2025), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.studentSummary.total).toBe(2)
    expect(data.studentSummary.active).toBe(1)
    expect(data.studentSummary.suspended).toBe(1)
    expect(data.staffSummary.total).toBe(1)
    expect(data.reportCardStatus.ready).toBe(1)
    expect(data.reportCardStatus.approved).toBe(1)
    expect(data.feeStatusCounts.paid).toBe(1)
    expect(data.feeStatusCounts.unpaid).toBe(1)
  })

  it('matches the academic year row by selected year, not just is_active', async () => {
    setResponse('academic_years', { data: [
      {
        id: 'ay-2026', name: '2026', label: '2026', start_date: '2026-01-01',
        term1_start: '2026-01-01', term1_end: '2026-04-30',
        term2_start: '2026-05-01', term2_end: '2026-08-31',
        term3_start: '2026-09-01', term3_end: '2026-12-31',
        is_active: true,
      },
      {
        id: 'ay-2025', name: '2025', label: '2025', start_date: '2025-01-01',
        term1_start: '2025-01-01', term1_end: '2025-04-30',
        term2_start: '2025-05-01', term2_end: '2025-08-31',
        term3_start: '2025-09-01', term3_end: '2025-12-31',
        is_active: false,
      },
    ], error: null })
    setResponse('students',     { data: [], error: null })
    setResponse('staff',        { data: [], error: null })
    setResponse('exam_results', { data: [], error: null })
    setResponse('exam_journal', { data: [], error: null })
    setResponse('subjects',     { data: [], error: null })
    setResponse('fee_payments', { data: [], error: null })
    setResponse('attendance',   { data: [], error: null })
    setResponse('classes',      { data: [], error: null })
    setResponse('report_cards', { data: [], error: null })

    // Selecting term 1 of 2025 (a past, non-active year) must use ay-2025's
    // term dates, not silently fall back to the currently active 2026 year.
    const { result } = renderHook(() => useSecretaryBriefing(1, 2025), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const attendanceCall = mockFrom.mock.results.find((_r: any, i: number) => mockFrom.mock.calls[i][0] === 'attendance')
    expect(attendanceCall).toBeDefined()
    expect(attendanceCall!.value.gte).toHaveBeenCalledWith('date', '2025-01-01')
    expect(attendanceCall!.value.lte).toHaveBeenCalledWith('date', '2025-04-30')
  })

  it('scopes student totals to enrollment by the selected term end date', async () => {
    setResponse('academic_years', { data: [{
      id: 'ay-1', name: '2025', label: '2025', start_date: '2025-01-01',
      term1_start: '2025-01-01', term1_end: '2025-04-30',
      term2_start: '2025-05-01', term2_end: '2025-08-31',
      term3_start: '2025-09-01', term3_end: '2025-12-31',
      is_active: true,
    }], error: null })
    setResponse('students', { data: [
      { id: 'stu-1', status: 'active', enrolled_at: '2025-02-01T00:00:00Z' }, // within term 1
      { id: 'stu-2', status: 'active', enrolled_at: '2025-06-01T00:00:00Z' }, // enrolled in term 2, after term 1 ended
    ], error: null })
    setResponse('staff',        { data: [], error: null })
    setResponse('exam_results', { data: [], error: null })
    setResponse('exam_journal', { data: [], error: null })
    setResponse('subjects',     { data: [], error: null })
    setResponse('fee_payments', { data: [], error: null })
    setResponse('attendance',   { data: [], error: null })
    setResponse('classes',      { data: [], error: null })
    setResponse('report_cards', { data: [], error: null })

    const { result } = renderHook(() => useSecretaryBriefing(1, 2025), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.studentSummary.total).toBe(1)
  })

  it('returns zero counts when all data is empty', async () => {
    setResponse('academic_years', { data: [], error: null })
    setResponse('students',     { data: [], error: null })
    setResponse('staff',        { data: [], error: null })
    setResponse('exam_results', { data: [], error: null })
    setResponse('exam_journal', { data: [], error: null })
    setResponse('subjects',     { data: [], error: null })
    setResponse('fee_payments', { data: [], error: null })
    setResponse('attendance',   { data: [], error: null })
    setResponse('classes',      { data: [], error: null })
    setResponse('report_cards', { data: [], error: null })

    const { result } = renderHook(() => useSecretaryBriefing(1, 2025), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const data = result.current.data!
    expect(data.studentSummary.total).toBe(0)
    expect(data.academicOverview.passRate).toBe(0)
    expect(data.attendanceAlerts).toEqual([])
  })
})
