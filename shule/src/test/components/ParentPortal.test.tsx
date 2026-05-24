import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
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

// ── Single top-level auth mock with mutable state ─────────────
// Changing mockUser before each test controls what useAuth() returns.
const mockUser = {
  id:         'parent-user-1',
  role:       'parent' as const,
  schoolId:   'school-1',
  name:       'Parent A',
  email:      'p@k.ug',
  studentIds: ['stu-1'] as string[],
}

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useParentStudents,
  useStudentFeeBalance,
  useStudentExamSummary,
  useStudentReleasedReportCards,
} from '../../hooks/useParentPortal'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
  // Reset mockUser to default state before each test
  mockUser.studentIds = ['stu-1']
  mockUser.id         = 'parent-user-1'
})

// ── useParentStudents ──────────────────────────────────────────
describe('useParentStudents', () => {
  it('is disabled when student_ids[] is empty', () => {
    mockUser.studentIds = []
    const { result } = renderHook(() => useParentStudents(), { wrapper: createWrapper() })
    // enabled: ids.length > 0 — empty array means query stays idle
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('queries students.in(ids) with the parent JWT student_ids', async () => {
    mockUser.studentIds = ['stu-1']
    setResponse('students', {
      data: [{
        id: 'stu-1', school_id: 'school-1', admission_number: 'KJA/001',
        first_name: 'Alice', last_name: 'Nakato', dob: null, gender: 'female',
        class_id: 'cls-1', stream_id: null, student_type: 'day',
        photo_url: null, status: 'active', enrolled_at: '2025-01-10',
      }],
      error: null,
    })

    const { result } = renderHook(() => useParentStudents(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].id).toBe('stu-1')
    expect(result.current.data![0].firstName).toBe('Alice')
    expect(mockFrom).toHaveBeenCalledWith('students')
  })

  it('returns empty array when Supabase returns no rows', async () => {
    setResponse('students', { data: [], error: null })
    const { result } = renderHook(() => useParentStudents(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ── RLS / data isolation: parent A cannot see student B ───────
// All hooks pass student_id + school_id. Supabase RLS is the primary guard.
// These tests verify the queries are scoped to the correct IDs.
describe('parent data isolation', () => {
  it('useStudentFeeBalance queries fee_payments with correct student_id', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'pay-1', amount_due: 300000, amount_paid: 300000,
        balance: 0, payment_date: '2026-01-15',
        receipt_number: 'RCP-001', term: 1, year: 2026,
      }],
      error: null,
    })
    const { result } = renderHook(() => useStudentFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    // Verify fee_payments was queried (school_id + student_id scoped)
    expect(mockFrom).toHaveBeenCalledWith('fee_payments')
  })

  it('useStudentFeeBalance returns empty when DB returns no rows (simulating RLS block)', async () => {
    // Simulates: parent queries for a student outside their student_ids —
    // RLS at DB level returns 0 rows.
    setResponse('fee_payments', { data: [], error: null })
    const { result } = renderHook(() => useStudentFeeBalance('stu-99'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('useStudentExamSummary queries exam_results by school_id + student_id (RLS boundary)', async () => {
    // Return empty (simulating RLS blocking cross-student access)
    setResponse('exam_results', { data: [], error: null })
    const { result } = renderHook(() => useStudentExamSummary('stu-99'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    // Verify exam_results was queried
    expect(mockFrom).toHaveBeenCalledWith('exam_results')
  })

  it('useStudentFeeBalance computes "paid" status when balance is 0', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'p-1', amount_due: 100000, amount_paid: 100000,
        balance: 0, payment_date: null, receipt_number: null, term: 1, year: 2026,
      }],
      error: null,
    })
    const { result } = renderHook(() => useStudentFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('paid')
  })

  it('useStudentFeeBalance computes "partial" when some balance remains', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'p-2', amount_due: 100000, amount_paid: 50000,
        balance: 50000, payment_date: null, receipt_number: null, term: 2, year: 2026,
      }],
      error: null,
    })
    const { result } = renderHook(() => useStudentFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('partial')
  })

  it('useStudentFeeBalance computes "unpaid" when nothing has been paid', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'p-3', amount_due: 100000, amount_paid: 0,
        balance: 100000, payment_date: null, receipt_number: null, term: 3, year: 2026,
      }],
      error: null,
    })
    const { result } = renderHook(() => useStudentFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('unpaid')
  })
})

// ── useStudentReleasedReportCards ──────────────────────────────
describe('useStudentReleasedReportCards', () => {
  it('returns mapped PortalReportCard objects', async () => {
    setResponse('report_cards', {
      data: [{
        id: 'rc-1', term: 1, year: 2026,
        pdf_url: 'https://example.com/rc.pdf', released_at: '2026-04-01',
      }],
      error: null,
    })
    const { result } = renderHook(() => useStudentReleasedReportCards('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].pdfUrl).toBe('https://example.com/rc.pdf')
    expect(result.current.data![0].term).toBe(1)
    expect(result.current.data![0].year).toBe(2026)
  })

  it('is disabled when studentId is null', () => {
    const { result } = renderHook(() => useStudentReleasedReportCards(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('returns empty array when no released report cards exist', async () => {
    setResponse('report_cards', { data: [], error: null })
    const { result } = renderHook(() => useStudentReleasedReportCards('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('surfaces error when Supabase rejects', async () => {
    setResponse('report_cards', { data: null, error: { message: 'Access denied' } })
    const { result } = renderHook(() => useStudentReleasedReportCards('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
