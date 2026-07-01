// Tests for useOfflineMutation — online executes immediately; offline queues to IndexedDB
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ── Hoist mocks ───────────────────────────────────────────────────────────────
const { mockUseConnection, mockQueueSync, mockToastInfo } = vi.hoisted(() => {
  const mockUseConnection = vi.fn((): {
    isVerified: boolean
    isOnline: boolean
    lastOnlineAt: Date | null
    connectionQuality: 'good' | 'slow' | 'offline'
  } => ({
    isVerified: true,
    isOnline: true,
    lastOnlineAt: null,
    connectionQuality: 'good',
  }))
  const mockQueueSync = vi.fn().mockResolvedValue(undefined)
  const mockToastInfo = vi.fn()
  return { mockUseConnection, mockQueueSync, mockToastInfo }
})

vi.mock('../../hooks/useConnectionStatus', () => ({
  useConnection: mockUseConnection,
  ConnectionProvider: ({ children }: any) => children,
}))

vi.mock('../../lib/db', () => ({
  queueSync: mockQueueSync,
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ info: mockToastInfo, success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

vi.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
}))

import { useOfflineMutation } from '../../hooks/useOfflineMutation'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks() })

describe('useOfflineMutation — online path', () => {
  beforeEach(() => {
    mockUseConnection.mockReturnValue({ isVerified: true, isOnline: true, lastOnlineAt: null, connectionQuality: 'good' })
  })

  it('calls mutationFn directly when verified online', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ id: 'att-1' })

    const { result } = renderHook(
      () => useOfflineMutation({
        tableName: 'attendance',
        mutationFn,
        schoolId: 'school-1',
      }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutateAsync({ student_id: 'stu-1', status: 'present', school_id: 'school-1' })
    })

    // mutationFn receives vars as first arg; React Query appends a context object as second arg
    expect(mutationFn.mock.calls[0][0]).toEqual({ student_id: 'stu-1', status: 'present', school_id: 'school-1' })
    expect(mockQueueSync).not.toHaveBeenCalled()
  })

  it('calls onSuccess callback after successful mutation', async () => {
    const onSuccess = vi.fn()
    const mutationFn = vi.fn().mockResolvedValue({ id: 'att-2' })

    const { result } = renderHook(
      () => useOfflineMutation({
        tableName: 'attendance',
        mutationFn,
        schoolId: 'school-1',
        onSuccess,
      }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutateAsync({ student_id: 'stu-2', school_id: 'school-1' })
    })

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'att-2' }))
  })

  it('exposes isError: true when mutationFn throws', async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error('DB write failed'))

    const { result } = renderHook(
      () => useOfflineMutation({
        tableName: 'attendance',
        mutationFn,
        schoolId: 'school-1',
      }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({ student_id: 'stu-3', school_id: 'school-1' })
      ).rejects.toThrow('DB write failed')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useOfflineMutation — offline path', () => {
  beforeEach(() => {
    mockUseConnection.mockReturnValue({ isVerified: false, isOnline: false, lastOnlineAt: null, connectionQuality: 'offline' })
  })

  it('queues to IndexedDB instead of calling mutationFn when offline', async () => {
    const mutationFn = vi.fn().mockResolvedValue({})

    const { result } = renderHook(
      () => useOfflineMutation({
        tableName: 'attendance',
        mutationFn,
        schoolId: 'school-1',
      }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutateAsync({ student_id: 'stu-4', school_id: 'school-1' })
    })

    expect(mutationFn).not.toHaveBeenCalled()
    expect(mockQueueSync).toHaveBeenCalledWith(
      'attendance',
      'upsert',
      { student_id: 'stu-4', school_id: 'school-1' },
      'school-1',
    )
  })

  it('shows an info toast when queuing offline', async () => {
    const mutationFn = vi.fn()

    const { result } = renderHook(
      () => useOfflineMutation({
        tableName: 'curriculum_plan',
        mutationFn,
        schoolId: 'school-1',
      }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutateAsync({ id: 'cp-1', school_id: 'school-1' })
    })

    expect(mockToastInfo).toHaveBeenCalledWith('Saved — will sync when back online')
  })

  it('calls onOfflineQueue callback when queued', async () => {
    const onOfflineQueue = vi.fn()
    const mutationFn = vi.fn()

    const { result } = renderHook(
      () => useOfflineMutation({
        tableName: 'attendance',
        mutationFn,
        schoolId: 'school-1',
        onOfflineQueue,
      }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutateAsync({ school_id: 'school-1' })
    })

    expect(onOfflineQueue).toHaveBeenCalled()
  })

  it('synchronous mutate() also queues when offline', async () => {
    const mutationFn = vi.fn()

    const { result } = renderHook(
      () => useOfflineMutation({
        tableName: 'attendance',
        mutationFn,
        schoolId: 'school-1',
      }),
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.mutate({ student_id: 'stu-5', school_id: 'school-1' })
    })

    await waitFor(() => expect(mockQueueSync).toHaveBeenCalled())
    expect(mutationFn).not.toHaveBeenCalled()
  })
})
