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
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { last_sign_in_at: '2025-06-01T08:00:00Z' } } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: mockFrom,
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'auth-1', role: 'teacher', schoolId: 'school-1', name: 'Tina', email: 'tina@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useMyProfile, useUpdateProfile } from '../../hooks/useProfile'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

const dbStaff = {
  id: 'staff-1', first_name: 'Tina', last_name: 'Nakato',
  email: 'tina@k.ug', phone: '0700000001', address: '123 Main St',
  role: 'teacher', staff_number: 'STF-001', photo_url: null,
  department_id: null,
  employment_type: 'full_time', qualification_level: 4, salary_band: 'B3',
  join_date: '2020-01-15', is_active: true,
}

describe('useMyProfile', () => {
  it('maps staff and school profile correctly', async () => {
    setResponse('staff', { data: dbStaff, error: null })
    setResponse('school_profile', { data: { school_name: 'Nakasero Academy' }, error: null })
    setResponse('departments', { data: { name: 'Sciences' }, error: null })

    const { result } = renderHook(() => useMyProfile(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const p = result.current.data!
    expect(p.firstName).toBe('Tina')
    expect(p.lastName).toBe('Nakato')
    expect(p.staffNumber).toBe('STF-001')
    expect(p.employmentType).toBe('full_time')
    expect(p.qualificationLevel).toBe(4)
  })

  it('returns null fields when optional columns are null', async () => {
    setResponse('staff', { data: { ...dbStaff, phone: null, address: null, photo_url: null }, error: null })
    setResponse('school_profile', { data: null, error: null })

    const { result } = renderHook(() => useMyProfile(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.phone).toBeNull()
    expect(result.current.data!.schoolName).toBeNull()
  })

  it('exposes error when staff query fails', async () => {
    setResponse('staff', { data: null, error: { message: 'RLS denied' } })
    setResponse('school_profile', { data: null, error: null })

    const { result } = renderHook(() => useMyProfile(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateProfile', () => {
  it('updates phone and address via Supabase', async () => {
    setResponse('staff', { data: { id: 'staff-1' }, error: null })

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ phone: '0700111222', address: 'New Address' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('staff')
  })

  it('throws when staff record not found', async () => {
    setResponse('staff', { data: null, error: null })
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ phone: '0700000001' })
      ).rejects.toThrow('Staff record not found')
    })
  })
})
