// Tests for AuthContext — specifically that a deactivated staff account (which now
// receives an `account_status: deactivated` claim instead of role/school_id claims,
// see custom_access_token_hook) is denied a working session and shown a clear
// message, rather than silently logging in or falling back to a stale cache.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useAuth, AuthProvider } from '../../store/AuthContext'

const { mockGetSession, mockOnAuthStateChange, mockSignOut, mockRefreshSession, mockDbGet, mockDbDelete, mockDbPut } = vi.hoisted(() => ({
  mockGetSession:       vi.fn(),
  mockOnAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  mockSignOut:          vi.fn().mockResolvedValue({ error: null }),
  mockRefreshSession:   vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  mockDbGet:            vi.fn().mockResolvedValue(undefined),
  mockDbDelete:         vi.fn().mockResolvedValue(undefined),
  mockDbPut:            vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut:            mockSignOut,
      refreshSession:     mockRefreshSession,
    },
  },
}))

vi.mock('../../lib/db', () => ({
  db: {
    auth_session: { get: mockDbGet, delete: mockDbDelete, put: mockDbPut },
  },
}))

vi.mock('../../lib/syncQueue', () => ({
  primeOfflineCache: vi.fn().mockResolvedValue(undefined),
}))

function b64url(obj: unknown): string {
  const json = JSON.stringify(obj)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`
}

function fakeSession(payload: Record<string, unknown>) {
  return {
    access_token: fakeJwt(payload),
    user: { id: payload.sub ?? 'u1', email: 'user@k.ug' },
  }
}

function Probe() {
  const { user, authError, loading } = useAuth()
  if (loading) return <div>loading</div>
  return (
    <div>
      <div data-testid="user">{user ? user.role : 'none'}</div>
      <div data-testid="error">{authError ?? ''}</div>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  mockDbGet.mockResolvedValue(undefined)
})

describe('AuthContext — deactivated account handling', () => {
  it('signs a user in normally when the session carries full role/school_id claims', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession({ sub: 'u1', user_role: 'it_admin', school_id: 's1', full_name: 'IT' }) },
    })

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('it_admin'))
    expect(screen.getByTestId('error').textContent).toBe('')
  })

  it('shows the deactivated message and does not set a user when the session carries account_status: deactivated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession({ sub: 'u1', account_status: 'deactivated' }) },
    })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toMatch(/deactivated by the IT Admin/i)
    })
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('forces a real sign-out (clears IndexedDB cache + Supabase session) when deactivation is detected', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession({ sub: 'u1', account_status: 'deactivated' }) },
    })

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled())
    expect(mockDbDelete).toHaveBeenCalledWith('current')
  })

  it('shows the generic "not linked" message (not the deactivated one) when claims are simply missing', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession({ sub: 'u1' }) },
    })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toMatch(/not linked to a school role/i)
    })
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('does not resurrect a deactivated user from a stale IndexedDB cache once the background refresh reveals deactivation', async () => {
    // No live Supabase session (bridge path) — but a cached session exists on-device.
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockDbGet.mockResolvedValue({
      id: 'current',
      user: { id: 'u1', role: 'it_admin', schoolId: 's1', name: 'IT', email: 'it@k.ug' },
      savedAt: new Date().toISOString(),
    })
    // Background refresh (fired because navigator.onLine) reveals the account was deactivated.
    mockRefreshSession.mockResolvedValue({
      data: { session: fakeSession({ sub: 'u1', account_status: 'deactivated' }) },
    })

    render(<AuthProvider><Probe /></AuthProvider>)

    // The background refresh detects deactivation and clears the resurrected cache user.
    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toMatch(/deactivated by the IT Admin/i)
    })
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(mockDbDelete).toHaveBeenCalledWith('current')
  })
})
