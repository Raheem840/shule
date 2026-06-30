// Tests for useIsMobile — matchMedia-based mobile detection
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useIsMobile } from '../../hooks/useIsMobile'

// ── helpers ──────────────────────────────────────────────────────────────────
type ChangeHandler = (e: MediaQueryListEvent) => void

function makeMockMQ(matches: boolean): MediaQueryList & { _fire: (m: boolean) => void } {
  const handlers: ChangeHandler[] = []
  const mq = {
    matches,
    media: '',
    onchange: null,
    addEventListener: vi.fn((_: string, h: EventListenerOrEventListenerObject) => {
      handlers.push(h as ChangeHandler)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    _fire(newMatches: boolean) {
      handlers.forEach(h => h({ matches: newMatches } as MediaQueryListEvent))
    },
  }
  return mq as unknown as MediaQueryList & { _fire: (m: boolean) => void }
}

let currentMQ: ReturnType<typeof makeMockMQ>

beforeEach(() => {
  currentMQ = makeMockMQ(false)
  vi.stubGlobal('matchMedia', vi.fn(() => currentMQ))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useIsMobile', () => {
  it('returns false when matchMedia does not match (desktop)', () => {
    currentMQ = makeMockMQ(false)
    vi.mocked(window.matchMedia).mockReturnValue(currentMQ)

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when matchMedia matches (mobile)', () => {
    currentMQ = makeMockMQ(true)
    vi.mocked(window.matchMedia).mockReturnValue(currentMQ)

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('updates to true when a change event fires with matches: true', () => {
    currentMQ = makeMockMQ(false)
    vi.mocked(window.matchMedia).mockReturnValue(currentMQ)

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => { currentMQ._fire(true) })
    expect(result.current).toBe(true)
  })

  it('updates to false when a change event fires with matches: false', () => {
    currentMQ = makeMockMQ(true)
    vi.mocked(window.matchMedia).mockReturnValue(currentMQ)

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => { currentMQ._fire(false) })
    expect(result.current).toBe(false)
  })

  it('uses default breakpoint of 768', () => {
    currentMQ = makeMockMQ(false)
    vi.mocked(window.matchMedia).mockReturnValue(currentMQ)

    renderHook(() => useIsMobile())
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 768px)')
  })

  it('accepts a custom breakpoint', () => {
    currentMQ = makeMockMQ(true)
    vi.mocked(window.matchMedia).mockReturnValue(currentMQ)

    renderHook(() => useIsMobile(480))
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 480px)')
  })

  it('removes the event listener on unmount', () => {
    currentMQ = makeMockMQ(false)
    vi.mocked(window.matchMedia).mockReturnValue(currentMQ)

    const { unmount } = renderHook(() => useIsMobile())
    unmount()
    expect(currentMQ.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
