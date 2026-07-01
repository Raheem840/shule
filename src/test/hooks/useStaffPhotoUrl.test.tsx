// Tests for useStaffPhotoUrl — resolves signed URL for private staff-photos bucket
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// ── Mock storage lib ──────────────────────────────────────────────────────────
const { mockGetSignedUrl } = vi.hoisted(() => {
  const mockGetSignedUrl = vi.fn()
  return { mockGetSignedUrl }
})

vi.mock('../../lib/storage', () => ({
  getSignedUrl: mockGetSignedUrl,
}))

import { useStaffPhotoUrl } from '../../hooks/useStaffPhotoUrl'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useStaffPhotoUrl', () => {
  it('returns null when photoPath is null', () => {
    const { result } = renderHook(() => useStaffPhotoUrl(null))
    expect(result.current).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('returns null when photoPath is undefined', () => {
    const { result } = renderHook(() => useStaffPhotoUrl(undefined))
    expect(result.current).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('returns null when photoPath is empty string', () => {
    const { result } = renderHook(() => useStaffPhotoUrl(''))
    expect(result.current).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('calls getSignedUrl and returns the signed URL for a valid path', async () => {
    const signedUrl = 'https://supabase.example.com/storage/v1/object/sign/staff-photos/photo.jpg?token=abc123'
    mockGetSignedUrl.mockResolvedValue(signedUrl)

    const { result } = renderHook(() => useStaffPhotoUrl('staff-photos/photo.jpg'))

    // Initially null while the async call is in flight
    expect(result.current).toBeNull()

    await waitFor(() => expect(result.current).toBe(signedUrl))
    expect(mockGetSignedUrl).toHaveBeenCalledWith('staff-photos', 'staff-photos/photo.jpg', 3600)
  })

  it('stays null if getSignedUrl resolves to null', async () => {
    mockGetSignedUrl.mockResolvedValue(null)

    const { result } = renderHook(() => useStaffPhotoUrl('broken/path.jpg'))

    // Wait for the async call to complete
    await waitFor(() => expect(mockGetSignedUrl).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })

  it('updates the signed URL when photoPath changes', async () => {
    const urlA = 'https://example.com/photo-a?token=aaa'
    const urlB = 'https://example.com/photo-b?token=bbb'
    mockGetSignedUrl
      .mockResolvedValueOnce(urlA)
      .mockResolvedValue(urlB)

    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useStaffPhotoUrl(path),
      { initialProps: { path: 'photos/a.jpg' } },
    )

    await waitFor(() => expect(result.current).toBe(urlA))
    expect(mockGetSignedUrl).toHaveBeenCalledWith('staff-photos', 'photos/a.jpg', 3600)

    rerender({ path: 'photos/b.jpg' })
    await waitFor(() => expect(result.current).toBe(urlB))
    expect(mockGetSignedUrl).toHaveBeenCalledWith('staff-photos', 'photos/b.jpg', 3600)
  })

  it('resets to null when photoPath changes to null', async () => {
    const signedUrl = 'https://example.com/photo?token=x'
    mockGetSignedUrl.mockResolvedValue(signedUrl)

    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useStaffPhotoUrl(path),
      { initialProps: { path: 'photos/test.jpg' as string | null } },
    )

    await waitFor(() => expect(result.current).toBe(signedUrl))

    rerender({ path: null })
    // The effect cleanup sets url to null immediately
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('refreshes the signed URL after 55 minutes', async () => {
    vi.useFakeTimers()
    try {
      const firstUrl  = 'https://example.com/photo?token=first'
      const secondUrl = 'https://example.com/photo?token=second'
      mockGetSignedUrl
        .mockResolvedValueOnce(firstUrl)
        .mockResolvedValue(secondUrl)

      const { result } = renderHook(() => useStaffPhotoUrl('photos/avatar.jpg'))

      // Let the initial refresh() promise resolve
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current).toBe(firstUrl)
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)

      // Advance 55 minutes to trigger the setInterval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(55 * 60 * 1000)
      })

      expect(result.current).toBe(secondUrl)
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    mockGetSignedUrl.mockResolvedValue('https://example.com/signed')

    const { unmount } = renderHook(() => useStaffPhotoUrl('photos/test.jpg'))

    await waitFor(() => expect(mockGetSignedUrl).toHaveBeenCalled())

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
