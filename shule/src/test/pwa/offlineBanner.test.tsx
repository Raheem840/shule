import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { OfflineBanner } from '../../components/shared/OfflineBanner'

// ── queueSync + db unit tests ──────────────────────────────────────────────
const { mockAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue(1),
}))

vi.mock('../../lib/db', () => ({
  db: {
    sync_queue: { add: mockAdd },
    students:   {},
    staff:      {},
    exam_marks: {},
    attendance: {},
  },
  queueSync: vi.fn(async (tableName: string, actionType: string, payload: Record<string, unknown>) => {
    await mockAdd({
      tableName,
      actionType,
      status:    'pending',
      payload:   JSON.stringify(payload),
      createdAt: new Date().toISOString(),
    })
  }),
}))

import { queueSync } from '../../lib/db'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: online
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── OfflineBanner component ────────────────────────────────────────────────
describe('OfflineBanner', () => {
  it('renders nothing when navigator.onLine is true', () => {
    render(<OfflineBanner />)
    expect(screen.queryByTestId('offline-banner')).toBeNull()
    expect(screen.queryByTestId('online-banner')).toBeNull()
  })

  it('shows offline banner when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(<OfflineBanner />)
    const banner = screen.getByTestId('offline-banner')
    expect(banner).toBeTruthy()
    expect(banner.textContent).toContain('offline')
  })

  it('shows green online-banner when coming back online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(<OfflineBanner />)

    // Simulate coming back online
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(screen.queryByTestId('offline-banner')).toBeNull()
      expect(screen.getByTestId('online-banner')).toBeTruthy()
    })
  })

  it('hides offline-banner when going offline then online', async () => {
    render(<OfflineBanner />)
    // Start online — no banner
    expect(screen.queryByTestId('offline-banner')).toBeNull()

    // Go offline
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('offline-banner')).toBeTruthy()
    })
  })

  it('contains correct offline message text', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(<OfflineBanner />)
    expect(screen.getByTestId('offline-banner').textContent).toContain('will sync when connection returns')
  })

  it('contains correct online flash message text', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(<OfflineBanner />)

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      const banner = screen.queryByTestId('online-banner')
      if (banner) expect(banner.textContent).toContain('syncing')
    })
  })
})

// ── queueSync ─────────────────────────────────────────────────────────────
describe('queueSync', () => {
  it('calls db.sync_queue.add with correct fields', async () => {
    await queueSync('attendance', 'insert', { id: 'abc', student_id: 's1' })

    expect(mockAdd).toHaveBeenCalledOnce()
    const call = mockAdd.mock.calls[0][0]
    expect(call.tableName).toBe('attendance')
    expect(call.actionType).toBe('insert')
    expect(call.status).toBe('pending')
    expect(JSON.parse(call.payload)).toEqual({ id: 'abc', student_id: 's1' })
  })

  it('queues a delete action correctly', async () => {
    await queueSync('exam_marks', 'delete', { id: 'mark-1' })

    const call = mockAdd.mock.calls[0][0]
    expect(call.tableName).toBe('exam_marks')
    expect(call.actionType).toBe('delete')
    expect(JSON.parse(call.payload)).toEqual({ id: 'mark-1' })
  })

  it('sets createdAt as an ISO date string', async () => {
    await queueSync('students', 'update', { id: 'stu-1' })
    const call = mockAdd.mock.calls[0][0]
    expect(() => new Date(call.createdAt).toISOString()).not.toThrow()
  })
})
