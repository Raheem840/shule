// Tests for useConnectionStatus — ConnectionProvider + useConnection
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// ── fetch mock (must be in place before the module is imported) ──────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── navigator.onLine default ─────────────────────────────────────────────────
vi.stubGlobal('navigator', { ...navigator, onLine: true })

import { ConnectionProvider, useConnection } from '../../hooks/useConnectionStatus'

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <ConnectionProvider>{children}</ConnectionProvider>
  )
}

describe('useConnection', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('throws when used outside ConnectionProvider', () => {
    // renderHook without wrapper — the hook must throw
    expect(() => {
      // We call renderHook but suppress the React error boundary noise;
      // the thrown error is what we assert on.
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        renderHook(() => useConnection())
      } finally {
        consoleSpy.mockRestore()
      }
    }).toThrow('useConnection must be used inside <ConnectionProvider>')
  })

  it('is verified and online when ping succeeds', async () => {
    // Resolve for all pings (provider fires 2 on mount)
    mockFetch.mockResolvedValue({ ok: true } as Response)

    const { result } = renderHook(() => useConnection(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isVerified).toBe(true))
    expect(result.current.isOnline).toBe(true)
    expect(['good', 'slow']).toContain(result.current.connectionQuality)
  })

  it('is verified but offline when ping fails with network error', async () => {
    mockFetch.mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useConnection(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isVerified).toBe(true))
    expect(result.current.isOnline).toBe(false)
    expect(result.current.connectionQuality).toBe('offline')
  })

  it('is verified but offline when ping returns non-ok status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 } as Response)

    const { result } = renderHook(() => useConnection(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isVerified).toBe(true))
    expect(result.current.isOnline).toBe(false)
    expect(result.current.connectionQuality).toBe('offline')
  })

  it('lastOnlineAt is set after a successful ping', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response)

    const { result } = renderHook(() => useConnection(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isVerified).toBe(true))
    expect(result.current.lastOnlineAt).toBeInstanceOf(Date)
  })

  it('lastOnlineAt is null after a failed ping', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useConnection(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isVerified).toBe(true))
    expect(result.current.lastOnlineAt).toBeNull()
  })
})
