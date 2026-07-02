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

const { mockInvoke, authState } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  // Mutable current user for role-guard tests — see useSuspendStudent describe block below.
  authState: { role: 'principal' } as { role: string },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'principal-1', role: authState.role, schoolId: 'school-1', name: 'P', email: 'p@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { usePrincipalKpis, useTopClasses, useSuspendStudent, useSuspendStaff } from '../../hooks/usePrincipal'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses(); authState.role = 'principal'; mockInvoke.mockResolvedValue({ data: null, error: null }) })

describe('usePrincipalKpis', () => {
  it('returns zero KPIs when all data is empty', async () => {
    setResponse('students',      { data: [], error: null })
    setResponse('staff',         { data: [], error: null })
    setResponse('exam_results',  { data: [], error: null })
    setResponse('exam_journal',  { data: [], error: null })
    setResponse('fee_payments',  { data: [], error: null })
    setResponse('fee_structure', { data: [], error: null })
    setResponse('attendance',    { data: [], error: null })
    setResponse('report_cards',  { data: [], error: null })

    const { result } = renderHook(() => usePrincipalKpis(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const kpis = result.current.data!
    expect(kpis.totalStudents).toBe(0)
    expect(kpis.totalStaff).toBe(0)
    expect(kpis.overallPassRate).toBe(null)
    expect(kpis.feeCollectionRate).toBe(0)
    expect(kpis.pendingReportCards).toBe(0)
  })

  it('calculates correct pass rate from exam results', async () => {
    const journals = [{ id: 'j-1', pass_mark: 50 }]
    const results  = [
      { score: 80, exam_journal_id: 'j-1' },  // pass
      { score: 40, exam_journal_id: 'j-1' },  // fail
      { score: 60, exam_journal_id: 'j-1' },  // pass
    ]
    setResponse('academic_years', { data: { id: 'year-1' }, error: null })
    setResponse('students',       { data: [], error: null })
    setResponse('staff',          { data: [], error: null })
    setResponse('exam_results',   { data: results, error: null })
    setResponse('exam_journal',   { data: journals, error: null })
    setResponse('fee_payments',   { data: [], error: null })
    setResponse('fee_structure',  { data: [], error: null })
    setResponse('attendance',     { data: [], error: null })
    setResponse('report_cards',   { data: [], error: null })

    const { result } = renderHook(() => usePrincipalKpis(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.overallPassRate).toBe(67)
  })

  it('counts pending report cards (status=ready)', async () => {
    setResponse('students',      { count: 0, data: null, error: null })
    setResponse('staff',         { count: 0, data: null, error: null })
    setResponse('exam_results',  { data: [], error: null })
    setResponse('exam_journal',  { data: [], error: null })
    setResponse('fee_payments',  { data: [], error: null })
    setResponse('fee_structure', { data: [], error: null })
    setResponse('attendance',    { data: [], error: null })
    setResponse('report_cards',  { count: 3, data: null, error: null })

    const { result } = renderHook(() => usePrincipalKpis(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.pendingReportCards).toBe(3)
  })
})

describe('useTopClasses', () => {
  it('returns empty array when no data', async () => {
    setResponse('academic_years', { data: { id: 'year-1' }, error: null })
    setResponse('classes',        { data: [], error: null })
    setResponse('students',       { data: [], error: null })
    setResponse('exam_results',   { data: [], error: null })
    setResponse('exam_journal',   { data: [], error: null })

    const { result } = renderHook(() => useTopClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('builds top class rankings from results', async () => {
    setResponse('academic_years', { data: { id: 'year-1' }, error: null })
    setResponse('classes',        { data: [{ id: 'cls-1', name: 'Senior 1' }], error: null })
    setResponse('students',       { data: [{ id: 'stu-1', class_id: 'cls-1' }], error: null })
    setResponse('exam_results',   { data: [{ student_id: 'stu-1', score: 75, exam_journal_id: 'j-1' }], error: null })
    setResponse('exam_journal',   { data: [{ id: 'j-1', pass_mark: 50, class_id: 'cls-1' }], error: null })

    const { result } = renderHook(() => useTopClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].className).toBe('Senior 1')
    expect(result.current.data![0].passRate).toBe(100)
  })
})

// ── useSuspendStudent — role guard ──────────────────────────────────────────
// Suspend/expel authority belongs to the Deputy — the Principal is read-only.
describe('useSuspendStudent', () => {
  it('deputy role CAN suspend a student', async () => {
    authState.role = 'deputy'
    setResponse('students', { data: { auth_user_id: 'auth-1' }, error: null })

    const { result } = renderHook(() => useSuspendStudent(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ studentId: 'stu-1', status: 'suspended' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('principal role is rejected with Forbidden', async () => {
    authState.role = 'principal'
    setResponse('students', { data: { auth_user_id: 'auth-1' }, error: null })

    const { result } = renderHook(() => useSuspendStudent(), { wrapper: createWrapper() })
    await expect(
      result.current.mutateAsync({ studentId: 'stu-1', status: 'suspended' })
    ).rejects.toThrow('Forbidden')
  })
})

// ── useSuspendStaff — must actually revoke the auth session ─────────────────
// A suspended staff member's Supabase Auth session must be disabled, not just
// staff.is_active flipped in the DB — otherwise an already-issued JWT keeps
// working until it naturally expires.
describe('useSuspendStaff', () => {
  it('calls set-user-disabled with the resolved auth_user_id when suspending', async () => {
    authState.role = 'principal'
    setResponse('staff', { data: { auth_user_id: 'auth-staff-1' }, error: null })

    const { result } = renderHook(() => useSuspendStaff(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ staffId: 'staff-1', isActive: false })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockInvoke).toHaveBeenCalledWith('set-user-disabled', {
      body: { authUserId: 'auth-staff-1', disabled: true },
    })
  })

  it('calls set-user-disabled with disabled: false when reactivating', async () => {
    authState.role = 'principal'
    setResponse('staff', { data: { auth_user_id: 'auth-staff-1' }, error: null })

    const { result } = renderHook(() => useSuspendStaff(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ staffId: 'staff-1', isActive: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockInvoke).toHaveBeenCalledWith('set-user-disabled', {
      body: { authUserId: 'auth-staff-1', disabled: false },
    })
  })
})
