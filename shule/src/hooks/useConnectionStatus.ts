// useConnectionStatus.ts — Context + hook for real network connectivity status.
// Pings Supabase REST API to verify actual internet (not just navigator.onLine).

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  createElement,
  type ReactNode,
} from 'react'

/** How responsive the connection is based on ping latency. */
type ConnectionQuality = 'good' | 'slow' | 'offline'

/** Full connection state exposed to consumers. */
interface ConnectionState {
  /** Whether the last ping succeeded. */
  isOnline: boolean
  /** True once the first ping has resolved (avoids flash of "offline" on mount). */
  isVerified: boolean
  /** Timestamp of the most recent successful ping. */
  lastOnlineAt: Date | null
  /** Latency bucket from the last ping. */
  connectionQuality: ConnectionQuality
}

const ConnectionContext = createContext<ConnectionState | null>(null)

/** Supabase REST endpoint that needs no auth (school_profile has RLS OFF). */
const PING_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/school_profile?select=id&limit=1`
const PING_HEADERS = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string }

/** Timeout for each ping attempt in ms. */
const PING_TIMEOUT_MS = 5000
/** Latency threshold below which quality is 'good'. */
const GOOD_MS = 1500

/** Fires a single ping and returns connection quality + whether it succeeded. */
async function doPing(): Promise<{ ok: boolean; quality: ConnectionQuality }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  const start = Date.now()
  try {
    const res = await fetch(PING_URL, { signal: controller.signal, headers: PING_HEADERS })
    const elapsed = Date.now() - start
    clearTimeout(timer)
    if (!res.ok) return { ok: false, quality: 'offline' }
    const quality: ConnectionQuality = elapsed < GOOD_MS ? 'good' : 'slow'
    return { ok: true, quality }
  } catch {
    clearTimeout(timer)
    return { ok: false, quality: 'offline' }
  }
}

/** Provides real network connectivity state to all children. */
export function ConnectionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<ConnectionState>({
    isOnline: navigator.onLine,
    isVerified: false,
    lastOnlineAt: null,
    connectionQuality: 'offline',
  })

  // Ref to track last ping time so focus handler can throttle
  const lastPingAt = useRef<number>(0)

  const ping = async () => {
    lastPingAt.current = Date.now()
    const { ok, quality } = await doPing()
    setState(prev => ({
      isOnline: ok,
      isVerified: true,
      lastOnlineAt: ok ? new Date() : prev.lastOnlineAt,
      connectionQuality: quality,
    }))
    return ok
  }

  useEffect(() => {
    // Ping immediately on mount
    void ping()

    // Recurring ping — 45s when online, 10s when offline
    let interval: ReturnType<typeof setTimeout>

    function schedule(isOnline: boolean) {
      clearTimeout(interval)
      interval = setTimeout(async () => {
        const ok = await ping()
        schedule(ok)
      }, isOnline ? 45_000 : 10_000)
    }

    // Kick off the scheduling loop once first ping resolves
    ping().then(ok => schedule(ok))

    // On browser 'online' event: ping immediately
    function handleOnline() {
      void ping()
    }

    // On window focus: ping only if > 60s since last ping
    function handleFocus() {
      if (Date.now() - lastPingAt.current > 60_000) {
        void ping()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createElement(ConnectionContext.Provider, { value: state }, children)
}

/** Returns the current connection state. Must be used inside ConnectionProvider. */
export function useConnection(): ConnectionState {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnection must be used inside <ConnectionProvider>')
  return ctx
}
