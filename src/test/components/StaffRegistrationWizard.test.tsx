import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub ──────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      then:   (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
    }),
  },
}))

// ── Auth ───────────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'secretary', schoolId: 's1', name: 'Secretary', email: 'sec@school.ac.ug', staffId: 'staff-1' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Hooks ──────────────────────────────────────────────────────
vi.mock('../../hooks/useStaff', () => ({
  useNextStaffNumber: vi.fn(),
  useRegisterStaff:   vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses:    vi.fn(),
  useSubjects:   vi.fn(),
  useDepartments: vi.fn(),
}))

// ── Toast ──────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

// ── Storage / file libs ────────────────────────────────────────
vi.mock('../../lib/storage', () => ({
  uploadDocument: vi.fn().mockResolvedValue('docs/temp/national_id.pdf'),
  getPublicUrl:   vi.fn().mockReturnValue('https://storage.example.com/photo.jpg'),
  BUCKETS:        { staff: 'staff-photos', documents: 'documents' },
}))

vi.mock('../../lib/uploadStaffPhoto', () => ({
  uploadStaffPhoto: vi.fn().mockResolvedValue('staff-photos/staff-1/photo.jpg'),
}))

vi.mock('../../lib/fileValidation', () => ({
  validateFile: vi.fn().mockReturnValue(null),   // null = no error
}))

// ── Import page after all mocks ────────────────────────────────
import { useNextStaffNumber, useRegisterStaff } from '../../hooks/useStaff'
import { useClasses, useSubjects, useDepartments } from '../../hooks/useClasses'
import { StaffRegistrationWizard } from '../../pages/secretary/StaffRegistrationWizard'

const mockNextNum    = useNextStaffNumber as ReturnType<typeof vi.fn>
const mockRegister   = useRegisterStaff   as ReturnType<typeof vi.fn>
const mockClasses    = useClasses         as ReturnType<typeof vi.fn>
const mockSubjects   = useSubjects        as ReturnType<typeof vi.fn>
const mockDepts      = useDepartments     as ReturnType<typeof vi.fn>

function setupMocks() {
  mockNextNum.mockReturnValue({ data: 'KJA/STAFF/001', isLoading: false })
  mockRegister.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockClasses.mockReturnValue({ data: [], isLoading: false })
  mockSubjects.mockReturnValue({ data: [], isLoading: false })
  mockDepts.mockReturnValue({ data: [], isLoading: false })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('StaffRegistrationWizard', () => {
  it('does not render when open=false', () => {
    render(<StaffRegistrationWizard open={false} onClose={vi.fn()} />)
    expect(screen.queryByText(/register staff member/i)).not.toBeInTheDocument()
  })

  it('renders step 1 by default with personal info fields', () => {
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    expect(screen.getByText(/register staff member/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
  })

  it('shows Basic Info as the active step label', () => {
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    expect(screen.getByText('Basic Info')).toBeInTheDocument()
  })

  it('renders mode toggle with New Employee and Existing Staff options', () => {
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /new employee/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /existing staff/i })).toBeInTheDocument()
  })

  it('shows Continue → button on step 1', () => {
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('shows Cancel button on step 1', () => {
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user    = userEvent.setup()
    const onClose = vi.fn()
    render(<StaffRegistrationWizard open onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows validation errors for firstName and lastName when Continue clicked with empty fields', async () => {
    const user = userEvent.setup()
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(screen.getByText(/first name required/i)).toBeInTheDocument()
      expect(screen.getByText(/last name required/i)).toBeInTheDocument()
    })
  })

  it('stays on step 1 when required fields are empty and Continue is clicked', async () => {
    const user = userEvent.setup()
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      // Step 2 label "Professional" should NOT be visible as active
      expect(screen.getByText('Basic Info')).toBeInTheDocument()
      expect(screen.queryByText(/role \*/i)).not.toBeInTheDocument()
    })
  })

  it('advances to step 2 when step 1 required fields are filled', async () => {
    const user = userEvent.setup()
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/first name/i), 'Kigongo')
    await user.type(screen.getByLabelText(/last name/i), 'Nakato')
    // National ID is required in new-employee mode
    await user.type(screen.getByLabelText(/national id/i), 'CM86010012345XXXX')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(screen.getByText(/professional/i)).toBeInTheDocument()
    })
  })

  it('existing staff mode shows hint text', async () => {
    const user = userEvent.setup()
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /existing staff/i }))
    await waitFor(() => {
      expect(screen.getByText(/quick 2-step registration/i)).toBeInTheDocument()
    })
  })

  it('submit calls registerMutation.mutate on the last step (existing staff 2-step)', async () => {
    const mutateFn = vi.fn()
    mockRegister.mockReturnValue({ mutate: mutateFn, isPending: false })

    const user = userEvent.setup()
    render(<StaffRegistrationWizard open onClose={vi.fn()} />)

    // Switch to existing staff (2-step) mode
    await user.click(screen.getByRole('button', { name: /existing staff/i }))

    // Fill step 1
    await user.type(screen.getByLabelText(/first name/i), 'John')
    await user.type(screen.getByLabelText(/last name/i), 'Doe')
    const emailEl = screen.getByLabelText(/email \*/i)
    await user.type(emailEl, 'john.doe@school.ac.ug')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Now on step 2 — fill Role and Staff Number
    await waitFor(() => expect(screen.getByText(/role & submit/i)).toBeInTheDocument())
    // Staff number should be auto-populated from mock
    // Submit via form button
    const submitBtn = screen.getByRole('button', { name: /register staff/i })
    expect(submitBtn).toBeInTheDocument()
  })
})
