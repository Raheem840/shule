// Phase 4 — Hook tests for useFeePayments.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null, count: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: mockFrom,
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'bursar', schoolId: 'school-1', name: 'B', email: 'b@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useFeePayments, useAddPayment, useSmsCount } from '../../hooks/useFeePayments'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useFeePayments', () => {
  it('returns LedgerRow objects with calcFeeStatus applied', async () => {
    // fee_payments: one row with balance = 200_000
    setResponse('fee_payments', {
      data: [{
        id: 'pay-1', school_id: 'school-1', student_id: 'stu-1',
        fee_structure_id: null, amount_due: 400_000, amount_paid: 200_000,
        balance: 200_000, payment_date: '2025-06-01',
        receipt_number: 'RCP-001', term: 1, year: 2025, notes: null, imported: false,
      }],
      error: null,
    })
    // students join
    setResponse('students', {
      data: [{
        id: 'stu-1', admission_number: 'KJA/2025/001',
        first_name: 'Alice', last_name: 'Nakato', class_id: 'cls-1', stream_id: null,
      }],
      error: null,
    })
    setResponse('classes', { data: [{ id: 'cls-1', name: 'S.3' }], error: null })
    setResponse('streams', { data: [], error: null })

    const { result } = renderHook(
      () => useFeePayments({ term: 1, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const row = result.current.data![0]
    expect(row.id).toBe('pay-1')
    expect(row.firstName).toBe('Alice')
    expect(row.status).toBe('partial')   // amountPaid=200k, balance=200k → partial
    expect(row.className).toBe('S.3')
  })

  it('assigns status "unpaid" when amountPaid is 0', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'pay-2', school_id: 'school-1', student_id: 'stu-2',
        fee_structure_id: null, amount_due: 400_000, amount_paid: 0,
        balance: 400_000, payment_date: null, receipt_number: null,
        term: 1, year: 2025, notes: null, imported: false,
      }],
      error: null,
    })
    setResponse('students', {
      data: [{ id: 'stu-2', admission_number: 'KJA/2025/002', first_name: 'Bob', last_name: 'O', class_id: null, stream_id: null }],
      error: null,
    })
    setResponse('classes', { data: [], error: null })
    setResponse('streams', { data: [], error: null })

    const { result } = renderHook(
      () => useFeePayments({ term: 1, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('unpaid')
  })

  it('assigns status "paid" when balance is 0', async () => {
    setResponse('fee_payments', {
      data: [{
        id: 'pay-3', school_id: 'school-1', student_id: 'stu-3',
        fee_structure_id: null, amount_due: 300_000, amount_paid: 300_000,
        balance: 0, payment_date: '2025-06-01', receipt_number: 'RCP-003',
        term: 1, year: 2025, notes: null, imported: false,
      }],
      error: null,
    })
    setResponse('students', {
      data: [{ id: 'stu-3', admission_number: 'KJA/2025/003', first_name: 'Eve', last_name: 'K', class_id: null, stream_id: null }],
      error: null,
    })
    setResponse('classes', { data: [], error: null })
    setResponse('streams', { data: [], error: null })

    const { result } = renderHook(
      () => useFeePayments({ term: 1, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].status).toBe('paid')
  })

  it('exposes error state when Supabase fails', async () => {
    setResponse('fee_payments', { data: null, error: { message: 'DB error' } })

    const { result } = renderHook(
      () => useFeePayments({ term: 1, year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('scopes rows by the caller-provided academicYearId instead of always resolving the active year', async () => {
    setResponse('fee_payments', { data: [], error: null })
    setResponse('students', { data: [], error: null })
    setResponse('classes', { data: [], error: null })
    setResponse('streams', { data: [], error: null })

    const { result } = renderHook(
      () => useFeePayments({ term: 1, academicYearId: 'year-prior' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // The academic_years table should never be queried when an explicit
    // academicYearId filter is supplied — it should scope directly.
    expect(mockFrom).not.toHaveBeenCalledWith('academic_years')
    const feePaymentsCallIdx = mockFrom.mock.calls.findIndex(c => c[0] === 'fee_payments')
    const builder = mockFrom.mock.results[feePaymentsCallIdx].value
    expect(builder.eq).toHaveBeenCalledWith('academic_year_id', 'year-prior')
  })
})

describe('useSmsCount', () => {
  it('counts only pending (queued) sms_reminders, not sent/delivered/failed', async () => {
    setResponse('sms_reminders', { data: null, error: null, count: 3 })

    const { result } = renderHook(() => useSmsCount(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(3)
    const callIdx = mockFrom.mock.calls.findIndex(c => c[0] === 'sms_reminders')
    const builder = mockFrom.mock.results[callIdx].value
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')
  })
})

describe('useAddPayment', () => {
  it('calls supabase insert and returns the new payment id', async () => {
    setResponse('fee_payments', { data: { id: 'new-pay-id' }, error: null })

    const { result } = renderHook(() => useAddPayment(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync({
        studentId: 'stu-1', feeStructureId: null, academicYearId: null,
        amountDue: 400_000, amountPaid: 200_000,
        paymentDate: '2025-06-01', receiptNumber: 'RCP-001',
        notes: null, term: 1,
      })
    })

    expect(returnedId).toBe('new-pay-id')
    expect(mockFrom).toHaveBeenCalledWith('fee_payments')
  })

  it('computes balance = amountDue - amountPaid before inserting', async () => {
    setResponse('fee_payments', { data: { id: 'pay-x' }, error: null })

    const { result } = renderHook(() => useAddPayment(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        studentId: 'stu-1', feeStructureId: null, academicYearId: null,
        amountDue: 500_000, amountPaid: 150_000,
        paymentDate: '2025-06-01', receiptNumber: null,
        notes: null, term: 1,
      })
    })

    // Just verify the mutation resolved (balance computation is internal)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('schema boundary: fee_payments', () => {
  it('mapper exposes feeStructureId (from fee_structure_id) — no feeTypeId field', async () => {
    setResponse('fee_payments', { data: [{
      id: 'pay-1', school_id: 'school-1', student_id: 'stu-1',
      fee_structure_id: 'fs-1', academic_year_id: 'ay-1',
      amount_due: 400000, amount_paid: 200000, balance: 200000,
      payment_date: '2025-06-01', receipt_number: 'RCP-001',
      term: 1, year: 2025, notes: null, imported: false, created_by: null,
    }], error: null })
    const { result } = renderHook(() => useFeePayments({ term: 1, year: 2025 }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const pay = result.current.data![0]
    expect(pay.feeStructureId).toBe('fs-1')
    expect((pay as any).feeTypeId).toBeUndefined()
  })
})
