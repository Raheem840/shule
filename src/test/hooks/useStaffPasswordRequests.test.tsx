import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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

import {
  useRequestStaffPassword,
  usePendingStaffPasswordRequests,
  useResolveStaffPasswordRequest,
} from '../../hooks/useStaffPasswordRequests'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

describe('useRequestStaffPassword', () => {
  it('resolves on success', async () => {
    mockFunctions.invoke.mockResolvedValue({ data: { success: true, message: 'ok' }, error: null })
    const { result } = renderHook(() => useRequestStaffPassword(), { wrapper: createWrapper() })

    const res = await result.current.mutateAsync({ email: 'a@k.ug', staffNumber: 'GM/STAFF/2026/001', newPassword: 'longpassword1' })
    expect(res.success).toBe(true)
    expect(mockFunctions.invoke).toHaveBeenCalledWith('request-staff-password', {
      body: { email: 'a@k.ug', staffNumber: 'GM/STAFF/2026/001', newPassword: 'longpassword1' },
    })
  })

  it('throws with the edge function error detail on failure', async () => {
    mockFunctions.invoke.mockResolvedValue({ data: { error: 'Bad input' }, error: { message: 'Bad input' } })
    const { result } = renderHook(() => useRequestStaffPassword(), { wrapper: createWrapper() })

    await expect(
      result.current.mutateAsync({ email: 'a@k.ug', staffNumber: 'X', newPassword: 'longpassword1' })
    ).rejects.toThrow('Bad input')
  })
})

describe('usePendingStaffPasswordRequests', () => {
  it('joins request rows with staff names', async () => {
    setResponse('staff_password_requests', { data: [
      { id: 'req-1', staff_id: 'staff-1', kind: 'activation', status: 'pending', requested_at: '2026-07-01T00:00:00Z' },
    ], error: null })
    setResponse('staff', { data: [
      { id: 'staff-1', first_name: 'Jane', last_name: 'Doe', staff_number: 'GM/STAFF/2026/001', role: 'teacher' },
    ], error: null })

    const { result } = renderHook(() => usePendingStaffPasswordRequests(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([{
      id: 'req-1', staffId: 'staff-1', kind: 'activation', status: 'pending',
      requestedAt: '2026-07-01T00:00:00Z', staffName: 'Jane Doe',
      staffNumber: 'GM/STAFF/2026/001', staffRole: 'teacher',
    }])
  })

  it('returns an empty array when there are no pending requests', async () => {
    setResponse('staff_password_requests', { data: [], error: null })
    const { result } = renderHook(() => usePendingStaffPasswordRequests(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useResolveStaffPasswordRequest', () => {
  it('approves a request', async () => {
    mockFunctions.invoke.mockResolvedValue({ data: { success: true, action: 'approved' }, error: null })
    const { result } = renderHook(() => useResolveStaffPasswordRequest(), { wrapper: createWrapper() })

    const res = await result.current.mutateAsync({ requestId: 'req-1', action: 'approve' })
    expect(res.action).toBe('approved')
    expect(mockFunctions.invoke).toHaveBeenCalledWith('resolve-staff-password-request', {
      body: { requestId: 'req-1', action: 'approve' },
    })
  })

  it('throws on failure', async () => {
    mockFunctions.invoke.mockResolvedValue({ data: { error: 'Already resolved' }, error: { message: 'Already resolved' } })
    const { result } = renderHook(() => useResolveStaffPasswordRequest(), { wrapper: createWrapper() })

    await expect(
      result.current.mutateAsync({ requestId: 'req-1', action: 'reject' })
    ).rejects.toThrow('Already resolved')
  })
})
