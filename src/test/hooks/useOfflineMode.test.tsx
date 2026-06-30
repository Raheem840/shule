// Tests for useOfflineMode + isNetworkError utility
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── supabase mock ─────────────────────────────────────────────────────────────
const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (t: string, r: any) => { tableData[t] = r }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      then: (res: any, rej?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(res, rej),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { useOfflineMode, isNetworkError } from '../../hooks/useOfflineMode'

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── isNetworkError ────────────────────────────────────────────────────────────
describe('isNetworkError', () => {
  it('returns true for "Failed to fetch" messages', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
  })

  it('returns true for "NetworkError" messages', () => {
    expect(isNetworkError(new Error('NetworkError when attempting fetch'))).toBe(true)
  })

  it('returns true for "network" messages', () => {
    expect(isNetworkError(new Error('network request failed'))).toBe(true)
  })

  it('returns true for "abort" messages', () => {
    expect(isNetworkError(new Error('The operation was aborted'))).toBe(true)
  })

  it('returns false for non-network errors', () => {
    expect(isNetworkError(new Error('RLS denied'))).toBe(false)
    expect(isNetworkError(new Error('duplicate key value violates unique constraint'))).toBe(false)
    expect(isNetworkError(new Error('permission denied'))).toBe(false)
  })

  it('returns false for null / undefined', () => {
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
})

// ── useOfflineMode ────────────────────────────────────────────────────────────
describe('useOfflineMode', () => {
  it('initialises isOffline: false when browser is online', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    // Supabase probe succeeds — no error
    setResponse('school_profile', { data: [{ id: 'sp-1' }], error: null })

    const { result } = renderHook(() => useOfflineMode())
    // Initial synchronous state reflects navigator.onLine
    expect(result.current.isOffline).toBe(false)
  })

  it('initialises isOffline: true when browser is offline', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    const { result } = renderHook(() => useOfflineMode())
    expect(result.current.isOffline).toBe(true)
    // When offline, supabase unreachability is suppressed
    expect(result.current.isSupabaseUnreachable).toBe(false)
  })

  it('sets isOffline: true when offline window event fires', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    setResponse('school_profile', { data: [{ id: 'sp-1' }], error: null })

    const { result } = renderHook(() => useOfflineMode())
    expect(result.current.isOffline).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOffline).toBe(true)
    expect(result.current.isSupabaseUnreachable).toBe(false)
  })

  it('clears isOffline when online window event fires', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    const { result } = renderHook(() => useOfflineMode())
    expect(result.current.isOffline).toBe(true)

    // Now browser comes back online
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    setResponse('school_profile', { data: [{ id: 'sp-1' }], error: null })

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOffline).toBe(false)
  })

  it('sets isSupabaseUnreachable: true when probe returns network error', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    // Probe fails with a network-style error
    setResponse('school_profile', {
      data: null,
      error: { message: 'Failed to fetch' },
    })

    const { result } = renderHook(() => useOfflineMode())

    await waitFor(() => expect(result.current.isSupabaseUnreachable).toBe(true))
    expect(result.current.isOffline).toBe(false) // browser still thinks it's online
  })

  it('exposes lastOnlineAt after a successful probe', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    setResponse('school_profile', { data: [{ id: 'sp-1' }], error: null })

    const { result } = renderHook(() => useOfflineMode())

    await waitFor(() => expect(result.current.lastOnlineAt).not.toBeNull())
    expect(result.current.lastOnlineAt).toBeInstanceOf(Date)
  })
})
