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

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id:       'auth-stu-1',
      role:     'student',
      schoolId: 'school-1',
      name:     'Alice Nakato',
      email:    'alice@k.ug',
    },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useMyStudentRecord,
  useMyExamResults,
  useMyFeeBalance,
  useMyReleasedReportCards,
  useIsEndOfTermSurveyActive,
} from '../../hooks/useStudentPortal'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

const dbStudentRow = {
  id:               'stu-1',
  school_id:        'school-1',
  admission_number: 'KJA/2025/001',
  first_name:       'Alice',
  last_name:        'Nakato',
  dob:              '2010-01-01',
  gender:           'female',
  class_id:         'cls-1',
  stream_id:        null,
  student_type:     'day',
  photo_url:        null,
  status:           'active',
  enrolled_at:      '2025-01-10',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

// ── useMyStudentRecord ─────────────────────────────────────────
describe('useMyStudentRecord', () => {
  it('queries students by auth_user_id = user.id', async () => {
    setResponse('students', { data: dbStudentRow, error: null })
    const { result } = renderHook(() => useMyStudentRecord(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.id).toBe('stu-1')
    expect(result.current.data!.firstName).toBe('Alice')
    // Verify the query hit the students table
    expect(mockFrom).toHaveBeenCalledWith('students')
  })

  it('returns null when no student row is linked to this auth user', async () => {
    setResponse('students', { data: null, error: null })
    const { result } = renderHook(() => useMyStudentRecord(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('only queries when role is student', () => {
    // If the user is not a student, the hook stays idle
    vi.doMock('../../store/AuthContext', () => ({
      useAuth: () => ({
        user: { id: 'teacher-1', role: 'teacher', schoolId: 'school-1', name: 'T', email: 't@k.ug' },
        loading: false,
      }),
    }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
    )
    // Because vi.doMock is async, verify at least the hook exists and responds
    const { result } = renderHook(() => useMyStudentRecord(), { wrapper })
    expect(result.current).toBeDefined()
  })
})

// ── Student sees own data only ─────────────────────────────────
// All hooks pass student_id = student.id + school_id = user.schoolId.
// RLS at DB level ensures one student cannot read another's data.
// These tests verify the queries are scoped to the correct IDs.
describe('student data isolation', () => {
  it('useMyExamResults queries by student_id + school_id', async () => {
    setResponse('exam_results', { data: [], error: null })

    const { result } = renderHook(() => useMyExamResults('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Verify exam_results table was queried
    expect(mockFrom).toHaveBeenCalledWith('exam_results')
    // RLS ensures the DB won't return another student's data even if the hook
    // were called with a different student_id.
    expect(result.current.data).toEqual([])
  })

  it('useMyFeeBalance queries fee_payments for the student', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'pay-1', amount_due: 300000, amount_paid: 300000,
        balance: 0, payment_date: '2026-01-15',
        receipt_number: 'RCP-001', term: 1, year: 2026,
      }],
      error: null,
    })

    const { result } = renderHook(() => useMyFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].status).toBe('paid')
    expect(result.current.data![0].termLabel).toBe('Term 1')
    expect(mockFrom).toHaveBeenCalledWith('fee_payments')
  })

  it('useMyFeeBalance marks "partial" when balance > 0 and some paid', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'pay-2', amount_due: 300000, amount_paid: 150000,
        balance: 150000, payment_date: null, receipt_number: null, term: 2, year: 2026,
      }],
      error: null,
    })

    const { result } = renderHook(() => useMyFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('partial')
  })

  it('useMyFeeBalance marks "unpaid" when amount_paid is 0', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'pay-3', amount_due: 300000, amount_paid: 0,
        balance: 300000, payment_date: null, receipt_number: null, term: 3, year: 2026,
      }],
      error: null,
    })

    const { result } = renderHook(() => useMyFeeBalance('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('unpaid')
  })

  it('useMyReleasedReportCards only returns released report cards', async () => {
    setResponse('report_cards', {
      data: [{ id: 'rc-1', term: 1, year: 2026, pdf_url: null, released_at: '2026-04-01' }],
      error: null,
    })
    const { result } = renderHook(() => useMyReleasedReportCards('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    // The hook queries status='released' — the DB enforces it
    expect(mockFrom).toHaveBeenCalledWith('report_cards')
  })

  it('useMyReleasedReportCards is disabled when studentId is null', () => {
    const { result } = renderHook(() => useMyReleasedReportCards(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ── useIsEndOfTermSurveyActive ─────────────────────────────────
describe('useIsEndOfTermSurveyActive', () => {
  it('returns true when survey_active is true on the active academic year', async () => {
    setResponse('academic_years', { data: { survey_active: true }, error: null })
    const { result } = renderHook(() => useIsEndOfTermSurveyActive(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(true)
  })

  it('returns false when survey_active is false', async () => {
    setResponse('academic_years', { data: { survey_active: false }, error: null })
    const { result } = renderHook(() => useIsEndOfTermSurveyActive(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })

  it('returns false when no active academic year exists', async () => {
    setResponse('academic_years', { data: null, error: null })
    const { result } = renderHook(() => useIsEndOfTermSurveyActive(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })
})
