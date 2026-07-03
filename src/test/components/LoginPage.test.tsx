import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// Mock supabase before any imports that transitively depend on it
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn(),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))

import { LoginPage } from '../../pages/auth/LoginPage'
import { supabase } from '../../lib/supabase'

const mockSignIn = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>
const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('name@school.ac.ug')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('does not show an error message on initial render', () => {
    render(<LoginPage />)
    // Error div is conditionally rendered — should be absent initially
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/wrong/i)).not.toBeInTheDocument()
  })

  it('shows error message on failed login', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('name@school.ac.ug'), 'bad@email.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })
  })

  it('shows "no session" error when signIn returns no session', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('name@school.ac.ug'), 'x@y.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/no session returned/i)).toBeInTheDocument()
    })
  })

  it('disables the submit button while loading', async () => {
    // signIn never resolves so loading state persists
    mockSignIn.mockReturnValueOnce(new Promise(() => {}))

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('name@school.ac.ug'), 'x@y.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('calls supabase signInWithPassword with entered credentials', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: 'Wrong password' },
    })

    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByPlaceholderText('name@school.ac.ug'), 'teacher@school.ac.ug')
    await user.type(screen.getByPlaceholderText('••••••••'), 'mypassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'teacher@school.ac.ug',
        password: 'mypassword',
      })
    })
  })
})

// The modal reuses the same email placeholder as the main login form, so
// scope queries to the LAST match (the modal renders after the form in DOM order).
function lastOf<T>(matches: T[]): T { return matches[matches.length - 1] }
const modalScope = {
  getByPlaceholderText: (t: any) => lastOf(screen.getAllByPlaceholderText(t)),
  getByRole: (role: any, opts: any) => lastOf(screen.getAllByRole(role, opts)),
}

describe('LoginPage — password request modal', () => {
  it('submits a request with email, staff number, and new password', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true, message: 'ok' }, error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByText(/forgot password \/ new staff/i))
    await screen.findByText(/set or reset your password/i)
    const modal = modalScope
    await user.type(modal.getByPlaceholderText('name@school.ac.ug'), 'teacher@school.ac.ug')
    await user.type(modal.getByPlaceholderText(/GM\/STAFF/i), 'GM/STAFF/2026/001')
    await user.type(modal.getByPlaceholderText(/at least 8 characters/i), 'mynewpassword1')
    await user.click(modal.getByRole('button', { name: /submit for approval/i }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('request-staff-password', {
        body: { email: 'teacher@school.ac.ug', staffNumber: 'GM/STAFF/2026/001', newPassword: 'mynewpassword1' },
      })
    })
    expect(await screen.findByText(/request submitted/i)).toBeInTheDocument()
  })

  it('shows an error message if the request fails', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { error: 'No matching staff record' }, error: { message: 'No matching staff record' } })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByText(/forgot password \/ new staff/i))
    await screen.findByText(/set or reset your password/i)
    const modal = modalScope
    await user.type(modal.getByPlaceholderText('name@school.ac.ug'), 'x@y.ug')
    await user.type(modal.getByPlaceholderText(/GM\/STAFF/i), 'BAD-NUM')
    await user.type(modal.getByPlaceholderText(/at least 8 characters/i), 'mynewpassword1')
    await user.click(modal.getByRole('button', { name: /submit for approval/i }))

    expect(await screen.findByText('No matching staff record')).toBeInTheDocument()
  })

  it('disables submit until email, staff number, and an 8+ char password are all filled', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByText(/forgot password \/ new staff/i))
    await screen.findByText(/set or reset your password/i)
    const modal = modalScope
    expect(modal.getByRole('button', { name: /submit for approval/i })).toBeDisabled()

    await user.type(modal.getByPlaceholderText('name@school.ac.ug'), 'x@y.ug')
    await user.type(modal.getByPlaceholderText(/GM\/STAFF/i), 'GM/STAFF/2026/001')
    await user.type(modal.getByPlaceholderText(/at least 8 characters/i), 'short')
    expect(modal.getByRole('button', { name: /submit for approval/i })).toBeDisabled()
  })
})
