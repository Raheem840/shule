import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// ── Supabase mock ──────────────────────────────────────────────
const { mockFrom, mockFunctions, mockRpc, setTableData, setRpcResult, clearAll } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setTableData = (t: string, r: any) => { tableData[t] = r }

  const mockFunctionsInvoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null })
  const mockFunctions = { invoke: mockFunctionsInvoke }

  // supabase-js's real .rpc() return value is both directly awaitable
  // (used by save_school_api_key) and chainable with .maybeSingle()/.single()
  // (used by get_messaging_config_status) — mirror both here.
  const DEFAULT_RPC_RESULT = { data: { at_enabled: true, wa_enabled: false }, error: null }
  let rpcResult: any = DEFAULT_RPC_RESULT
  const setRpcResult = (r: any) => { rpcResult = r }
  const clearAll = () => {
    for (const k of Object.keys(tableData)) delete tableData[k]
    rpcResult = DEFAULT_RPC_RESULT
  }
  const mockRpc = vi.fn().mockImplementation(() => ({
    then: (resolve: any, reject?: any) => Promise.resolve(rpcResult).then(resolve, reject),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(rpcResult)),
    single: vi.fn().mockImplementation(() => Promise.resolve(rpcResult)),
  }))

  function makeBuilder(table: string) {
    const b: any = {
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      is:      vi.fn().mockReturnThis(),
      order:   vi.fn().mockReturnThis(),
      update:  vi.fn().mockReturnThis(),
      single:  vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
      maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, mockFunctions, mockRpc, setTableData, setRpcResult, clearAll }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from:      mockFrom,
    functions: mockFunctions,
    rpc:       mockRpc,
  },
}))

// ── Dexie db mock ───────────────────────────────────────────────
vi.mock('../../lib/db', () => ({
  db: {
    sync_queue: {
      where: vi.fn().mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 1, status: 'pending' },
            { id: 2, status: 'failed' },
          ]),
        }),
        equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
    },
  },
  queueSync: vi.fn(),
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'it_admin', schoolId: 'school-1', name: 'Admin', email: 'a@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useUserManagement,
  useSchoolSettings,
  useSaveSchoolSettings,
  useSaveApiConfig,
  useApiConfigStatus,
} from '../../hooks/useAdmin'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearAll()
})

// ── useUserManagement ──────────────────────────────────────────────────────
describe('useUserManagement', () => {
  it('returns staff mapped to UserRow objects', async () => {
    setTableData('staff', {
      data: [
        {
          id: 'staff-1', auth_user_id: 'auth-1',
          first_name: 'Alice', last_name: 'Smith',
          role: 'teacher', last_login_at: '2026-05-24T08:00:00Z', is_active: true,
        },
        {
          id: 'staff-2', auth_user_id: null,
          first_name: 'Bob', last_name: 'Jones',
          role: 'class_teacher', last_login_at: null, is_active: false,
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useUserManagement(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const users = result.current.data!
    expect(users).toHaveLength(2)
    expect(users[0].name).toBe('Alice Smith')
    expect(users[0].authUserId).toBe('auth-1')
    expect(users[0].isActive).toBe(true)
    expect(users[1].lastLogin).toBeNull()
    expect(users[1].isActive).toBe(false)
  })
})

// useResetPassword (this file's former duplicate of useResetStaffPassword)
// was removed in favor of the single canonical hook — see
// src/test/hooks/useStaffAuth.test.tsx's 'useResetStaffPassword' describe
// block for this coverage.

// ── useSchoolSettings ──────────────────────────────────────────────────────
describe('useSchoolSettings', () => {
  it('returns school settings from school_profile table', async () => {
    setTableData('school_profile', {
      data: {
        id: 'school-1', school_name: 'Test Academy',
        short_name: 'TA', motto: 'Excellence',
        logo_url: null, primary_color: '#0d9488', currency: 'UGX',
      },
      error: null,
    })

    const { result } = renderHook(() => useSchoolSettings(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const s = result.current.data!
    expect(s.schoolName).toBe('Test Academy')
    expect(s.shortName).toBe('TA')
    expect(s.primaryColor).toBe('#0d9488')
    expect(s.currency).toBe('UGX')
  })

  it('defaults educationLevel to secondary when the column is null/unset', async () => {
    setTableData('school_profile', {
      data: { id: 'school-1', school_name: 'Test Academy', short_name: 'TA', motto: null, logo_url: null, primary_color: '#0d9488', education_level: null },
      error: null,
    })
    const { result } = renderHook(() => useSchoolSettings(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.educationLevel).toBe('secondary')
  })

  it('reads educationLevel=primary when set', async () => {
    setTableData('school_profile', {
      data: { id: 'school-1', school_name: 'Test Academy', short_name: 'TA', motto: null, logo_url: null, primary_color: '#0d9488', education_level: 'primary' },
      error: null,
    })
    const { result } = renderHook(() => useSchoolSettings(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.educationLevel).toBe('primary')
  })
})

// ── useSaveSchoolSettings ────────────────────────────────────────────────
describe('useSaveSchoolSettings', () => {
  it('includes education_level in the update payload when provided', async () => {
    setTableData('school_profile', { data: null, error: null })
    const { result } = renderHook(() => useSaveSchoolSettings(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ educationLevel: 'primary' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const updateBuilder = mockFrom.mock.results.find(r => r.value.update?.mock.calls.length > 0)?.value
    expect(updateBuilder?.update.mock.calls[0][0]).toEqual({ education_level: 'primary' })
  })

  it('omits education_level from the payload when not provided', async () => {
    setTableData('school_profile', { data: null, error: null })
    const { result } = renderHook(() => useSaveSchoolSettings(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ motto: 'New motto' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const updateBuilder = mockFrom.mock.results.find(r => r.value.update?.mock.calls.length > 0)?.value
    expect(updateBuilder?.update.mock.calls[0][0]).not.toHaveProperty('education_level')
  })
})

// ── useSaveApiConfig ───────────────────────────────────────────────────────
describe('useSaveApiConfig', () => {
  it('calls supabase.rpc to store API key in Vault (never plain text)', async () => {
    const { result } = renderHook(() => useSaveApiConfig(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        keyName: 'at_api_key',
        keyValue: 'secret-key-12345',
        enabled: true,
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Verify the key was sent via RPC (server-side Vault storage)
    expect(mockRpc).toHaveBeenCalledWith('save_school_api_key', {
      p_school_id: 'school-1',
      p_key_name:  'at_api_key',
      p_key_value: 'secret-key-12345',
      p_enabled:   true,
    })
  })

  it('throws when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Vault error' } })

    const { result } = renderHook(() => useSaveApiConfig(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ keyName: 'wa_access_token', keyValue: 'tok', enabled: true })
      ).rejects.toThrow('Vault error')
    })
  })
})

// ── useApiConfigStatus ─────────────────────────────────────────────────────
describe('useApiConfigStatus', () => {
  it('returns only enabled flags — never raw key values', async () => {
    // The raw secret columns aren't selectable by the client at all (see
    // migration 20260721_000001) — the hook calls a SECURITY DEFINER RPC
    // that returns only presence booleans, never the actual values.
    setRpcResult({
      data: {
        at_api_key_set: true, at_username_set: false, at_sender_id_set: false,
        wa_phone_number_id_set: false, wa_access_token_set: false,
      },
      error: null,
    })

    const { result } = renderHook(() => useApiConfigStatus(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cfg = result.current.data!
    expect(cfg.atEnabled).toBe(true)
    expect(cfg.waEnabled).toBe(false)
    expect(cfg.atApiKey).toBeNull()
    expect(cfg.waAccessToken).toBeNull()
  })
})
