// Phase 4 — Hook tests for useFeeStructure.ts
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
      in:          vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
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

import { useFeeStructure, useAddFeeType, useToggleFeeActive, useAcademicYears, useUpdateFeeAmount, useUnchargedCounts } from '../../hooks/useFeeStructure'
import type { FeeStructure } from '../../types/app'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const dbFeeRow = {
  id:               'fee-1',
  school_id:        'school-1',
  name:             'School Fees',
  amount:           400_000,
  applies_to:       'all',
  term:             1,
  is_active:        true,
  academic_year_id: 'year-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useFeeStructure', () => {
  it('returns mapped FeeStructure objects', async () => {
    setResponse('fee_structure', { data: [dbFeeRow], error: null })
    const { result } = renderHook(() => useFeeStructure(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const fee = result.current.data![0]
    expect(fee.id).toBe('fee-1')
    expect(fee.name).toBe('School Fees')
    expect(fee.amount).toBe(400_000)
    expect(fee.appliesTo).toBe('all')
    expect(fee.term).toBe(1)
    expect(fee.isActive).toBe(true)
    expect(fee.academicYearId).toBe('year-1')
  })

  it('returns empty array when no fee types exist', async () => {
    setResponse('fee_structure', { data: [], error: null })
    const { result } = renderHook(() => useFeeStructure(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('exposes error when Supabase fails', async () => {
    setResponse('fee_structure', { data: null, error: { message: 'RLS violation' } })
    const { result } = renderHook(() => useFeeStructure(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useAddFeeType', () => {
  it('calls supabase insert and returns the new fee id', async () => {
    setResponse('fee_structure', { data: { id: 'new-fee-id' }, error: null })
    const { result } = renderHook(() => useAddFeeType(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync({
        name: '  Boarding Fees  ',   // has leading/trailing spaces — should be trimmed
        amount: 600_000,
        appliesTo: 'boarders',
        term: 2,
        academicYearId: 'year-1',
        classId: null,
        isCompulsory: false,
      })
    })

    expect(returnedId).toBe('new-fee-id')
    expect(mockFrom).toHaveBeenCalledWith('fee_structure')
  })

  it('throws when supabase insert returns an error', async () => {
    setResponse('fee_structure', { data: null, error: { message: 'Duplicate fee type' } })
    const { result } = renderHook(() => useAddFeeType(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          name: 'School Fees', amount: 400_000,
          appliesTo: 'all', term: 1, academicYearId: 'year-1', classId: null, isCompulsory: false,
        })
      ).rejects.toEqual({ message: 'Duplicate fee type' })
    })
  })
})

describe('useToggleFeeActive', () => {
  it('calls supabase update to deactivate a fee type', async () => {
    setResponse('fee_structure', { data: null, error: null })
    const { result } = renderHook(() => useToggleFeeActive(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'fee-1', isActive: false })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('fee_structure')
  })

  it('calls supabase update to reactivate a fee type', async () => {
    setResponse('fee_structure', { data: null, error: null })
    const { result } = renderHook(() => useToggleFeeActive(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'fee-1', isActive: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useFeeStructure with academicYearId filter', () => {
  it('passes academicYearId to Supabase .eq()', async () => {
    setResponse('fee_structure', { data: [dbFeeRow], error: null })
    const { result } = renderHook(
      () => useFeeStructure('year-1'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('returns all fees when academicYearId is null', async () => {
    setResponse('fee_structure', { data: [dbFeeRow], error: null })
    const { result } = renderHook(
      () => useFeeStructure(null),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

describe('useAcademicYears', () => {
  it('returns mapped AcademicYear objects', async () => {
    setResponse('academic_years', {
      data: [{
        id: 'year-1', school_id: 'school-1', label: '2025',
        start_date: '2025-01-01', end_date: '2025-12-31', is_active: true,
      }],
      error: null,
    })
    const { result } = renderHook(() => useAcademicYears(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const yr = result.current.data![0]
    expect(yr.id).toBe('year-1')
    expect(yr.name).toBe('2025')
    expect(yr.isActive).toBe(true)
  })

  it('returns empty array when no academic years exist', async () => {
    setResponse('academic_years', { data: [], error: null })
    const { result } = renderHook(() => useAcademicYears(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('exposes error when Supabase fails', async () => {
    setResponse('academic_years', { data: null, error: { message: 'RLS denied' } })
    const { result } = renderHook(() => useAcademicYears(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateFeeAmount', () => {
  it('calls supabase update with new amount', async () => {
    setResponse('fee_structure', { data: null, error: null })
    const { result } = renderHook(() => useUpdateFeeAmount(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'fee-1', amount: 450_000 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('fee_structure')
  })

  it('throws when supabase update fails', async () => {
    setResponse('fee_structure', { data: null, error: { message: 'RLS denied' } })
    const { result } = renderHook(() => useUpdateFeeAmount(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'fee-1', amount: 500_000 })
      ).rejects.toEqual({ message: 'RLS denied' })
    })
  })
})

describe('useUnchargedCounts', () => {
  const fee: FeeStructure = {
    id: 'fee-1', schoolId: 'school-1', name: 'School Fees', amount: 400_000,
    appliesTo: 'all', term: 1, academicYearId: 'year-1', classId: null,
    isActive: true, isCompulsory: true,
  } as FeeStructure

  it('filters the already-billed check by academic_year_id — matching useAutoChargeFees exactly', async () => {
    setResponse('students', { data: [{ id: 'stu-1' }, { id: 'stu-2' }], error: null })
    setResponse('fee_payments', { data: [{ student_id: 'stu-1' }], error: null })

    const { result } = renderHook(() => useUnchargedCounts([fee]), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ 'fee-1': 1 })
    const feePaymentsCallIdx = mockFrom.mock.calls.findIndex(c => c[0] === 'fee_payments')
    const builder = mockFrom.mock.results[feePaymentsCallIdx].value
    expect(builder.eq).toHaveBeenCalledWith('academic_year_id', 'year-1')
  })
})
