import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'

// The AuthContext must be mocked before importing ProtectedRoute
// so we can control the user/loading state per test.
const mockUseAuth = vi.fn()

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: any) => children,
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { ProtectedRoute } from '../../components/layout/ProtectedRoute'

// ── Helpers ────────────────────────────────────────────────────
const PROTECTED_TEXT = 'Secret content'
function ProtectedContent() {
  return <div>{PROTECTED_TEXT}</div>
}

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: vi.fn() })
    render(
      <ProtectedRoute allowedRoles={['teacher']}>
        <ProtectedContent />
      </ProtectedRoute>
    )
    // Loading spinner is rendered — children are not
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument()
  })

  it('redirects unauthenticated user to /login', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() })
    render(
      <ProtectedRoute allowedRoles={['teacher']}>
        <ProtectedContent />
      </ProtectedRoute>
    )
    // Navigate replaces the view — children not shown
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument()
  })

  it('renders children when user has the correct role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', role: 'teacher', schoolId: 's1', name: 'T', email: 'a@b.com' },
      loading: false,
      signOut: vi.fn(),
    })
    render(
      <ProtectedRoute allowedRoles={['teacher']}>
        <ProtectedContent />
      </ProtectedRoute>
    )
    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument()
  })

  it('shows Access Denied when user role is not in allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u2', role: 'teacher', schoolId: 's1', name: 'T', email: 'a@b.com' },
      loading: false,
      signOut: vi.fn(),
    })
    render(
      <ProtectedRoute allowedRoles={['bursar', 'principal']}>
        <ProtectedContent />
      </ProtectedRoute>
    )
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument()
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  it('renders children when user has one of multiple allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u3', role: 'bursar', schoolId: 's1', name: 'B', email: 'b@c.com' },
      loading: false,
      signOut: vi.fn(),
    })
    render(
      <ProtectedRoute allowedRoles={['bursar', 'principal', 'secretary']}>
        <ProtectedContent />
      </ProtectedRoute>
    )
    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument()
  })

  it('Access Denied page shows the user role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u4', role: 'teacher', schoolId: 's1', name: 'Teacher', email: 'x@y.com' },
      loading: false,
      signOut: vi.fn(),
    })
    render(
      <ProtectedRoute allowedRoles={['principal']}>
        <ProtectedContent />
      </ProtectedRoute>
    )
    expect(screen.getByText('teacher')).toBeInTheDocument()
  })
})
