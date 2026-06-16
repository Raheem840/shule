import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// vi.hoisted runs before vi.mock factories so we can reference these in the factory
const { mockBuilder } = vi.hoisted(() => {
  const mockSingle  = vi.fn().mockResolvedValue({ data: { short_name: 'KJA' }, error: null })
  const mockBuilder = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    single: mockSingle,
    insert: vi.fn().mockReturnThis(),
    then:   (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
  }
  return { mockSingle, mockBuilder }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from:    vi.fn().mockReturnValue(mockBuilder),
    storage: { from: vi.fn().mockReturnValue({ upload: vi.fn(), getPublicUrl: vi.fn() }) },
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'secretary', schoolId: 's1', name: 'Secretary', email: 'sec@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useStudents', () => ({
  useNextAdmissionNumber: () => ({ data: 'KJA/2025/0001', isLoading: false }),
  useRegisterStudent:     () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: () => ({ data: [], isLoading: false }),
  useStreams:  () => ({ data: [], isLoading: false }),
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

import { StudentRegistrationWizard } from '../../pages/secretary/StudentRegistrationWizard'

beforeEach(() => vi.clearAllMocks())

describe('StudentRegistrationWizard', () => {
  it('step 1 renders first name and last name fields', () => {
    render(<StudentRegistrationWizard open onClose={vi.fn()} />)
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
  })

  it('step 1 has a Continue button', () => {
    render(<StudentRegistrationWizard open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('does not render when open=false', () => {
    render(<StudentRegistrationWizard open={false} onClose={vi.fn()} />)
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument()
  })

  it('Next button click with empty required fields does not advance to step 2', async () => {
    const user = userEvent.setup()
    render(<StudentRegistrationWizard open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 1 fields must still be present — validation blocked advance
    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    })
  })

  it('filling step 1 and clicking Next advances to step 2', async () => {
    const user = userEvent.setup()
    render(<StudentRegistrationWizard open onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/first name/i), 'Alice')
    await user.type(screen.getByLabelText(/last name/i), 'Nakato')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2 shows the "Placement" content (admission number field)
    await waitFor(() => {
      expect(screen.getByLabelText(/admission number/i)).toBeInTheDocument()
    })
  })

  it('Back button on step 2 returns to step 1', async () => {
    const user = userEvent.setup()
    render(<StudentRegistrationWizard open onClose={vi.fn()} />)

    // Advance to step 2
    await user.type(screen.getByLabelText(/first name/i), 'Alice')
    await user.type(screen.getByLabelText(/last name/i), 'Nakato')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(screen.getByLabelText(/admission number/i)).toBeInTheDocument())

    // Go back
    await user.click(screen.getByRole('button', { name: /back/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    })
  })
})
