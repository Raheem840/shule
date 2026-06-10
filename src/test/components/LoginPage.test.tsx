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
  },
}))

import { LoginPage } from '../../pages/auth/LoginPage'
import { supabase } from '../../lib/supabase'

const mockSignIn = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>

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
