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
      delete: vi.fn().mockReturnThis(), contains: vi.fn().mockReturnThis(),
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
    user: {
      id: 'parent-auth-1', role: 'parent', schoolId: 'school-1', name: 'Mary',
      email: 'mary@k.ug', studentIds: ['stu-1', 'stu-2'],
    },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useParentStudents,
  useStudentFeeBalance,
  useStudentReleasedReportCards,
} from '../../hooks/useParentPortal'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

// ── useParentStudents ───────────────────────────────────────────
describe('useParentStudents', () => {
  it('maps student rows using STUDENT_COLS', async () => {
    setResponse('students', { data: [
      { id: 'stu-1', school_id: 'school-1', admission_number: 'ADM-001',
        first_name: 'Alice', last_name: 'Nabuuma', dob: '2010-03-15',
        gender: 'female', class_id: 'cls-1', stream_id: null,
        photo_url: null, status: 'active', enrolled_at: '2024-01-15T00:00:00Z' },
    ], error: null })
    const { result } = renderHook(() => useParentStudents(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const stu = result.current.data![0]
    expect(stu.firstName).toBe('Alice')
    expect(stu.admissionNumber).toBe('ADM-001')
    expect(stu.status).toBe('active')
  })

  it('returns empty array when no students', async () => {
    setResponse('students', { data: [], error: null })
    const { result } = renderHook(() => useParentStudents(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ── useStudentFeeBalance ─────────────────────────────────────────
describe('useStudentFeeBalance', () => {
  it('computes status correctly — partial when amount_paid > 0 but < due', async () => {
    setResponse('fee_payments', { data: [
      { id: 'pay-1', amount_due: 400000, amount_paid: 100000, balance: 300000,
        payment_date: '2025-06-01', receipt_number: 'RCP-001', term: 1, year: 2025 },
    ], error: null })
    const { result } = renderHook(() => useStudentFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('partial')
    expect(result.current.data![0].amountDue).toBe(400000)
  })

  it('computes status as paid when balance is 0', async () => {
    setResponse('fee_payments', { data: [
      { id: 'pay-2', amount_due: 200000, amount_paid: 200000, balance: 0,
        payment_date: null, receipt_number: null, term: 1, year: 2025 },
    ], error: null })
    const { result } = renderHook(() => useStudentFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('paid')
  })

  it('is disabled when studentId is null', () => {
    const { result } = renderHook(() => useStudentFeeBalance(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ── useStudentReleasedReportCards ────────────────────────────────
describe('useStudentReleasedReportCards', () => {
  it('returns report cards with pdf_url', async () => {
    setResponse('report_cards', { data: [
      { id: 'rc-1', term: '1', year: 2025, pdf_url: 'https://storage.url/rc-1.pdf', released_at: '2025-12-01T00:00:00Z' },
    ], error: null })
    const { result } = renderHook(() => useStudentReleasedReportCards('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].pdfUrl).toBe('https://storage.url/rc-1.pdf')
  })

  it('is disabled when studentId is null', () => {
    const { result } = renderHook(() => useStudentReleasedReportCards(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
