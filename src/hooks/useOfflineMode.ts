// useOfflineMode.ts — Tracks both browser-level offline state and Supabase
// reachability. The two can diverge: the browser may think it's online while
// a corporate firewall or Supabase outage blocks the API.
//
// Usage:
//   const { isOffline, isSupabaseUnreachable, lastOnlineAt } = useOfflineMode()

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// How often to probe Supabase when the browser reports it is online (ms).
const PROBE_INTERVAL_MS = 60_000     // 1 minute
// How long to wait before calling a probe "timed out" (ms).
const PROBE_TIMEOUT_MS  = 8_000

// ── Supabase reachability probe ───────────────────────────────────────────────
// We use a lightweight RPC-like query against a small table with a 1-row
// limit.  This avoids hitting auth endpoints (which have rate limits).
async function probeSupabase(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    // Plain GET — avoids HEAD + count:exact which some proxies reject.
    const { error } = await supabase
      .from('school_profile')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal)
    // Any PostgREST error (4xx) means we reached the API fine.
    // Only true network/abort errors mean unreachable.
    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('networkerror') || msg.includes('abort')) {
        return false
      }
    }
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export type OfflineModeResult = {
  /** True when navigator.onLine is false */
  isOffline: boolean
  /** True when online but Supabase is unreachable */
  isSupabaseUnreachable: boolean
  /** Timestamp of the last confirmed Supabase connection */
  lastOnlineAt: Date | null
}

export function useOfflineMode(): OfflineModeResult {
  const [isOffline,             setIsOffline]             = useState(!navigator.onLine)
  const [isSupabaseUnreachable, setIsSupabaseUnreachable] = useState(false)
  const [lastOnlineAt,          setLastOnlineAt]          = useState<Date | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runProbe = useCallback(async () => {
    if (!navigator.onLine) {
      setIsSupabaseUnreachable(false) // Let isOffline cover this case
      return
    }
    const reachable = await probeSupabase()
    setIsSupabaseUnreachable(!reachable)
    if (reachable) setLastOnlineAt(new Date())
  }, [])

  // Start / stop the periodic probe
  const startProbe = useCallback(() => {
    if (intervalRef.current) return
    void runProbe()
    intervalRef.current = setInterval(() => { void runProbe() }, PROBE_INTERVAL_MS)
  }, [runProbe])

  const stopProbe = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true)
      setIsSupabaseUnreachable(false)
      stopProbe()
    }

    function handleOnline() {
      setIsOffline(false)
      startProbe()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)

    // Kick off an initial probe when online
    if (navigator.onLine) startProbe()

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
      stopProbe()
    }
  }, [startProbe, stopProbe])

  return { isOffline, isSupabaseUnreachable, lastOnlineAt }
}

// ── Classify a Supabase/fetch error as a network error ───────────────────────
// Use this in catch blocks to decide whether to serve cached data.
export function isNetworkError(err: unknown): boolean {
  if (!err) return false
  const msg = (err as Error).message?.toLowerCase() ?? ''
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('abort')
  )
}
