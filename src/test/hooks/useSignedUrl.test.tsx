import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { mockGetSignedUrl } = vi.hoisted(() => {
  const mockGetSignedUrl = vi.fn()
  return { mockGetSignedUrl }
})

vi.mock('../../lib/storage', () => ({
  getSignedUrl: mockGetSignedUrl,
}))

import { useSignedUrl } from '../../hooks/useSignedUrl'

beforeEach(() => { vi.clearAllMocks() })

describe('useSignedUrl', () => {
  it('resolves to null initially while loading', () => {
    mockGetSignedUrl.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useSignedUrl('student-photos', 'school-1/stu-1.jpg'))
    expect(result.current).toBeNull()
  })

  it('resolves signed URL after getSignedUrl resolves', async () => {
    const signed = 'https://storage.url/signed?token=abc'
    mockGetSignedUrl.mockResolvedValue(signed)

    const { result } = renderHook(() => useSignedUrl('student-photos', 'school-1/stu-1.jpg'))
    await waitFor(() => expect(result.current).toBe(signed))
    expect(mockGetSignedUrl).toHaveBeenCalledWith('student-photos', 'school-1/stu-1.jpg')
  })

  it('returns null when bucket is null', () => {
    const { result } = renderHook(() => useSignedUrl(null, 'school-1/stu-1.jpg'))
    expect(result.current).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('returns null when path is null', () => {
    const { result } = renderHook(() => useSignedUrl('student-photos', null))
    expect(result.current).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('returns null when path is empty string', () => {
    const { result } = renderHook(() => useSignedUrl('student-photos', ''))
    expect(result.current).toBeNull()
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('does not use getPublicUrl — signed URLs only for private buckets', async () => {
    const signed = 'https://storage.url/signed?token=xyz'
    mockGetSignedUrl.mockResolvedValue(signed)

    const { result } = renderHook(() => useSignedUrl('documents', 'school-1/staff-1/contract.pdf'))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toContain('signed')
  })
})
