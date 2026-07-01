// Tests for useSyncQueue — background flush service for offline writes
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ── Hoist all mocks ───────────────────────────────────────────────────────────
const { mockUseConnection, mockGetPendingSync, mockMarkSynced, mockMarkFailed, mockFrom } = vi.hoisted(() => {
  const mockUseConnection = vi.fn((): {
    isVerified: boolean
    isOnline: boolean
    lastOnlineAt: Date | null
    connectionQuality: 'good' | 'slow' | 'offline'
  } => ({
    isVerified: false,
    isOnline: false,
    lastOnlineAt: null,
    connectionQuality: 'offline',
  }))
  const mockGetPendingSync = vi.fn().mockResolvedValue([])
  const mockMarkSynced     = vi.fn().mockResolvedValue(undefined)
  const mockMarkFailed     = vi.fn().mockResolvedValue(undefined)

  function makeBuilder() {
    const b: any = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(), upsert: vi.fn().mockReturnThis(),
      then: (res: any, rej?: any) => Promise.resolve({ data: null, error: null }).then(res, rej),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockUseConnection, mockGetPendingSync, mockMarkSynced, mockMarkFailed, mockFrom }
})

vi.mock('../../hooks/useConnectionStatus', () => ({
  useConnection: mockUseConnection,
  ConnectionProvider: ({ children }: any) => children,
}))

vi.mock('../../lib/db', () => ({
  getPendingSync: mockGetPendingSync,
  markSynced:     mockMarkSynced,
  markFailed:     mockMarkFailed,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
}))

import { useSyncQueue } from '../../hooks/useSyncQueue'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPendingSync.mockResolvedValue([])
  // Default: not verified
  mockUseConnection.mockReturnValue({ isVerified: false, isOnline: false, lastOnlineAt: null, connectionQuality: 'offline' })
})

describe('useSyncQueue — initial state', () => {
  it('exposes correct initial state when not verified', () => {
    const { result } = renderHook(() => useSyncQueue(), { wrapper: createWrapper() })

    expect(result.current.pendingCount).toBe(0)
    expect(result.current.isSyncing).toBe(false)
    expect(result.current.lastSyncAt).toBeNull()
    expect(result.current.failedCount).toBe(0)
  })

  it('does not flush when isVerified is false', async () => {
    vi.useFakeTimers()
    try {
      mockUseConnection.mockReturnValue({ isVerified: false, isOnline: false, lastOnlineAt: null, connectionQuality: 'offline' })

      renderHook(() => useSyncQueue(), { wrapper: createWrapper() })

      // Advance well past 2s initial + 90s interval — no flush should occur
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100_000)
      })

      expect(mockGetPendingSync).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useSyncQueue — flush behavior', () => {
  beforeEach(() => {
    mockUseConnection.mockReturnValue({ isVerified: true, isOnline: true, lastOnlineAt: null, connectionQuality: 'good' })
  })

  it('flushes after 2s when isVerified and queue is empty', async () => {
    vi.useFakeTimers()
    try {
      mockGetPendingSync.mockResolvedValue([])

      const { result } = renderHook(() => useSyncQueue(), { wrapper: createWrapper() })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2001)
      })

      expect(mockGetPendingSync).toHaveBeenCalled()
      expect(result.current.isSyncing).toBe(false) // flush completed
      // lastSyncAt is only set when items are processed; empty queue returns early without setting it
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes a pending insert item and marks it synced', async () => {
    vi.useFakeTimers()
    try {
      const pendingItem = {
        id: 1,
        tableName: 'attendance',
        actionType: 'insert' as const,
        status: 'pending' as const,
        payload: JSON.stringify({ id: 'att-1', school_id: 'school-1', student_id: 'stu-1', status: 'present' }),
        createdAt: new Date().toISOString(),
        retryCount: 0,
        schoolId: 'school-1',
      }

      mockGetPendingSync
        .mockResolvedValueOnce([pendingItem])
        .mockResolvedValue([]) // After sync, nothing pending

      const { result } = renderHook(() => useSyncQueue(), { wrapper: createWrapper() })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2001)
      })

      expect(mockMarkSynced).toHaveBeenCalledWith(1)
      expect(result.current.failedCount).toBe(0)
      expect(result.current.pendingCount).toBe(0)
      expect(result.current.lastSyncAt).toBeInstanceOf(Date)
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks an item failed when the table is not in the sync allowlist', async () => {
    vi.useFakeTimers()
    try {
      const blockedItem = {
        id: 2,
        tableName: 'fee_payments', // finance table — deliberately blocked
        actionType: 'insert' as const,
        status: 'pending' as const,
        payload: JSON.stringify({ id: 'fp-1', school_id: 'school-1' }),
        createdAt: new Date().toISOString(),
        retryCount: 0,
        schoolId: 'school-1',
      }

      mockGetPendingSync
        .mockResolvedValueOnce([blockedItem])
        .mockResolvedValue([])

      const { result } = renderHook(() => useSyncQueue(), { wrapper: createWrapper() })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2001)
      })

      expect(mockMarkFailed).toHaveBeenCalledWith(2, expect.stringContaining('not in sync allowlist'))
      expect(result.current.failedCount).toBe(1)
      expect(mockMarkSynced).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks an upsert item failed when payload is missing school_id', async () => {
    vi.useFakeTimers()
    try {
      const badItem = {
        id: 3,
        tableName: 'attendance',
        actionType: 'upsert' as const,
        status: 'pending' as const,
        payload: JSON.stringify({ id: 'att-x' }), // no school_id
        createdAt: new Date().toISOString(),
        retryCount: 0,
        schoolId: 'school-1',
      }

      mockGetPendingSync
        .mockResolvedValueOnce([badItem])
        .mockResolvedValue([])

      const { result } = renderHook(() => useSyncQueue(), { wrapper: createWrapper() })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2001)
      })

      expect(mockMarkFailed).toHaveBeenCalledWith(3, 'upsert payload missing school_id')
      expect(result.current.failedCount).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks a duplicate key (23505) as synced rather than failed', async () => {
    vi.useFakeTimers()
    try {
      // Override mockFrom to return a 23505 error for this test
      mockFrom.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        then: (res: any, rej?: any) =>
          Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } }).then(res, rej),
      }))

      const duplicateItem = {
        id: 4,
        tableName: 'attendance',
        actionType: 'insert' as const,
        status: 'pending' as const,
        payload: JSON.stringify({ id: 'att-dup', school_id: 'school-1' }),
        createdAt: new Date().toISOString(),
        retryCount: 0,
        schoolId: 'school-1',
      }

      mockGetPendingSync
        .mockResolvedValueOnce([duplicateItem])
        .mockResolvedValue([])

      const { result } = renderHook(() => useSyncQueue(), { wrapper: createWrapper() })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2001)
      })

      expect(mockMarkSynced).toHaveBeenCalledWith(4)
      expect(result.current.failedCount).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
