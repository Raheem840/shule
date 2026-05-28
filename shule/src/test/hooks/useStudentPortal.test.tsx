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
    user: { id: 'student-auth-1', role: 'student', schoolId: 'school-1', name: 'S', email: 's@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useMyFeeBalance,
  useSubmitSurvey,
  useIsEndOfTermSurveyActive,
  useMyReleasedReportCards,
} from '../../hooks/useStudentPortal'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

// ── useMyFeeBalance ─────────────────────────────────────────────
describe('useMyFeeBalance', () => {
  it('maps fee payment rows correctly', async () => {
    setResponse('fee_payments', { data: [
      { id: 'pay-1', amount_due: 400000, amount_paid: 200000, balance: 200000,
        payment_date: '2025-06-01', receipt_number: 'RCP-001', term: 1, year: 2025 },
    ], error: null })
    const { result } = renderHook(() => useMyFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const row = result.current.data![0]
    expect(row.amountDue).toBe(400000)
    expect(row.amountPaid).toBe(200000)
    expect(row.status).toBe('partial')
    expect(row.termLabel).toContain('Term 1')
  })

  it('status is paid when balance <= 0', async () => {
    setResponse('fee_payments', { data: [
      { id: 'pay-2', amount_due: 200000, amount_paid: 200000, balance: 0,
        payment_date: null, receipt_number: null, term: 1, year: 2025 },
    ], error: null })
    const { result } = renderHook(() => useMyFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('paid')
  })

  it('is disabled when studentId is null', () => {
    const { result } = renderHook(() => useMyFeeBalance(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ── useMyReleasedReportCards ─────────────────────────────────────
describe('useMyReleasedReportCards', () => {
  it('returns released report cards', async () => {
    setResponse('report_cards', { data: [
      { id: 'rc-1', term: '1', year: 2025, pdf_url: 'https://storage.url/rc-1.pdf', released_at: '2025-12-01T00:00:00Z' },
    ], error: null })
    const { result } = renderHook(() => useMyReleasedReportCards('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].pdfUrl).toBe('https://storage.url/rc-1.pdf')
  })

  it('is disabled when studentId is null', () => {
    const { result } = renderHook(() => useMyReleasedReportCards(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ── useSubmitSurvey ─────────────────────────────────────────────
describe('useSubmitSurvey', () => {
  it('inserts into student_surveys table', async () => {
    setResponse('student_surveys', { data: null, error: null })
    const { result } = renderHook(() => useSubmitSurvey(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        studentId: 'stu-1', academicYearId: 'ay-1', term: '1', year: 2025,
        rating: 4, suggestions: 'More practicals',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('student_surveys')
  })

  it('throws friendly error if survey not yet enabled (42P01)', async () => {
    setResponse('student_surveys', { data: null, error: { code: '42P01', message: 'table not found' } })
    const { result } = renderHook(() => useSubmitSurvey(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          studentId: 'stu-1', academicYearId: null, term: null, year: null, rating: 3,
        }),
      ).rejects.toThrow('Survey temporarily unavailable')
    })
  })

  it('throws on generic Supabase error', async () => {
    setResponse('student_surveys', { data: null, error: { code: '42000', message: 'RLS denied' } })
    const { result } = renderHook(() => useSubmitSurvey(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          studentId: 'stu-1', academicYearId: null, term: null, year: null, rating: 5,
        }),
      ).rejects.toThrow('RLS denied')
    })
  })
})

// ── useIsEndOfTermSurveyActive ──────────────────────────────────
describe('useIsEndOfTermSurveyActive', () => {
  it('returns true when survey_active is true', async () => {
    setResponse('academic_years', { data: { survey_active: true }, error: null })
    const { result } = renderHook(() => useIsEndOfTermSurveyActive(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(true)
  })

  it('returns false when no active academic year', async () => {
    setResponse('academic_years', { data: null, error: null })
    const { result } = renderHook(() => useIsEndOfTermSurveyActive(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })
})
