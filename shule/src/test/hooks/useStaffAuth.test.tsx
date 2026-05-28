import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, mockFunctions, setResponse, clearResponses } = vi.hoisted(() => {
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
  const mockFrom      = vi.fn().mockImplementation(makeBuilder)
  const mockFunctions = { invoke: vi.fn() }
  return { mockFrom, mockFunctions, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: mockFrom,
    functions: mockFunctions,
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'it-admin-1', role: 'it_admin', schoolId: 'school-1', name: 'IT', email: 'it@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useActivateStaffLogin, useLinkAuthUser } from '../../hooks/useStaffAuth'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

const dbStaff = {
  id: 'staff-1', email: 'john@k.ug', first_name: 'John', last_name: 'Doe', auth_user_id: null,
}

describe('useActivateStaffLogin', () => {
  it('returns manual=false when Edge Function succeeds', async () => {
    setResponse('staff', { data: dbStaff, error: null })
    mockFunctions.invoke.mockResolvedValue({ data: { authUserId: 'new-uid' }, error: null })

    const { result } = renderHook(() => useActivateStaffLogin(), { wrapper: createWrapper() })
    let outcome: any
    await act(async () => {
      outcome = await result.current.mutateAsync('staff-1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(outcome.manual).toBe(false)
    expect(outcome.email).toBe('john@k.ug')
  })

  it('returns manual=true when Edge Function fails (not deployed)', async () => {
    setResponse('staff', { data: dbStaff, error: null })
    mockFunctions.invoke.mockResolvedValue({ data: null, error: { message: 'Function not deployed' } })

    const { result } = renderHook(() => useActivateStaffLogin(), { wrapper: createWrapper() })
    let outcome: any
    await act(async () => {
      outcome = await result.current.mutateAsync('staff-1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(outcome.manual).toBe(true)
    expect(typeof outcome.tempPassword).toBe('string')
  })

  it('throws when staff not found', async () => {
    setResponse('staff', { data: null, error: null })
    const { result } = renderHook(() => useActivateStaffLogin(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(result.current.mutateAsync('staff-99')).rejects.toThrow('Staff member not found')
    })
  })

  it('throws when staff already has auth_user_id', async () => {
    setResponse('staff', { data: { ...dbStaff, auth_user_id: 'existing-uid' }, error: null })
    const { result } = renderHook(() => useActivateStaffLogin(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(result.current.mutateAsync('staff-1')).rejects.toThrow('already activated')
    })
  })
})

describe('useLinkAuthUser', () => {
  it('updates staff.auth_user_id with valid UUID', async () => {
    setResponse('staff', { data: null, error: null })
    const { result } = renderHook(() => useLinkAuthUser(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        staffId: 'staff-1',
        authUserId: '123e4567-e89b-12d3-a456-426614174000',
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('staff')
  })

  it('throws on invalid UUID format', async () => {
    const { result } = renderHook(() => useLinkAuthUser(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ staffId: 'staff-1', authUserId: 'not-a-uuid' })
      ).rejects.toThrow('Invalid UUID')
    })
  })
})
