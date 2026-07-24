import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub (vi.hoisted so mockChain is in scope inside vi.mock factory)
const { mockChain } = vi.hoisted(() => {
  const mockChain = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    is:          vi.fn().mockReturnThis(),
    not:         vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    in:          vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    delete:      vi.fn().mockReturnThis(),
    insert:      vi.fn().mockReturnThis(),
    single:      vi.fn().mockResolvedValue({ data: { id: 'school-1', short_name: 'NYS', school_name: 'Nile Youth School' }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    // Default: list queries return empty array; count queries return 0
    then: (resolve: any) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
  }
  return { mockChain }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from:      vi.fn().mockReturnValue(mockChain),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
  },
}))

// ── Auth ───────────────────────────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'it_admin', schoolId: 's1', name: 'IT Admin', email: 'admin@nys.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Hook-layer mocks ───────────────────────────────────────────────────────────
vi.mock('../../hooks/useStaff', () => ({ useStaff: vi.fn() }))

vi.mock('../../hooks/useClasses', () => ({
  useClasses:     vi.fn(),
  useDepartments: vi.fn(),
}))

vi.mock('../../hooks/useAdmin', () => ({ useSchoolSettings: vi.fn(), useDeactivateUser: vi.fn() }))

vi.mock('../../hooks/useStaffAuth', () => ({
  useActivateStaffLogin:  vi.fn(),
  useResetStaffPassword:  vi.fn(),
  useLinkAuthUser:        vi.fn(),
  useSendCredentialsSms:  vi.fn(),
}))

vi.mock('../../hooks/useStudents', () => ({
  useCreateStudentLogin:          vi.fn(),
  useResetStudentPassword:        vi.fn(),
  getPendingStudentActivations:   vi.fn().mockReturnValue({}),
  setPendingStudentActivation:    vi.fn(),
  clearPendingStudentActivation:  vi.fn(),
}))

// ── Toast + Avatar + passwords ─────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}))

vi.mock('../../lib/passwords', () => ({
  generateTempPassword: vi.fn().mockReturnValue('Temp@9876'),
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { useStaff } from '../../hooks/useStaff'
import { useClasses, useDepartments } from '../../hooks/useClasses'
import { useSchoolSettings, useDeactivateUser } from '../../hooks/useAdmin'
import {
  useActivateStaffLogin, useResetStaffPassword,
  useLinkAuthUser, useSendCredentialsSms,
} from '../../hooks/useStaffAuth'
import { useCreateStudentLogin, useResetStudentPassword } from '../../hooks/useStudents'
import { AdminUsersPage } from '../../pages/admin/AdminUsersPage'

const mockUseStaff               = useStaff               as ReturnType<typeof vi.fn>
const mockUseClasses             = useClasses             as ReturnType<typeof vi.fn>
const mockUseDepartments         = useDepartments         as ReturnType<typeof vi.fn>
const mockUseSchoolSettings      = useSchoolSettings      as ReturnType<typeof vi.fn>
const mockUseDeactivateUser      = useDeactivateUser      as ReturnType<typeof vi.fn>
const mockUseActivateStaffLogin  = useActivateStaffLogin  as ReturnType<typeof vi.fn>
const mockUseResetStaffPassword  = useResetStaffPassword  as ReturnType<typeof vi.fn>
const mockUseLinkAuthUser        = useLinkAuthUser        as ReturnType<typeof vi.fn>
const mockUseSendCredentialsSms  = useSendCredentialsSms  as ReturnType<typeof vi.fn>
const mockUseCreateStudentLogin  = useCreateStudentLogin  as ReturnType<typeof vi.fn>
const mockUseResetStudentPassword= useResetStudentPassword as ReturnType<typeof vi.fn>

const MUTATION_STUB = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }

// Two pending staff (no authUserId) + one active
const PENDING_STAFF_1 = {
  id: 'st1', firstName: 'Alice', lastName: 'Nakato', role: 'teacher',
  email: 'alice@nys.ug', staffNumber: 'NYS/STAFF/001',
  authUserId: null, departmentId: null, photoUrl: null,
  phone: '+256700111222', isActive: true, schoolId: 's1', tempPassword: null,
}
const PENDING_STAFF_2 = {
  id: 'st2', firstName: 'Carol', lastName: 'Tendo', role: 'dos',
  email: 'carol@nys.ug', staffNumber: 'NYS/STAFF/002',
  authUserId: null, departmentId: null, photoUrl: null,
  phone: null, isActive: true, schoolId: 's1', tempPassword: null,
}
const ACTIVE_STAFF = {
  id: 'st3', firstName: 'Bob', lastName: 'Okello', role: 'bursar',
  email: 'bob@nys.ug', staffNumber: 'NYS/STAFF/003',
  authUserId: 'auth-003', departmentId: null, photoUrl: null,
  phone: null, isActive: true, schoolId: 's1', tempPassword: null,
}

function setupMocks(staffData = [PENDING_STAFF_1, PENDING_STAFF_2, ACTIVE_STAFF], isLoading = false) {
  mockUseStaff.mockReturnValue({ data: staffData, isLoading, error: null })
  mockUseClasses.mockReturnValue({ data: [], isLoading: false })
  mockUseDepartments.mockReturnValue({ data: [], isLoading: false })
  mockUseSchoolSettings.mockReturnValue({
    data: { schoolName: 'Nile Youth School', shortName: 'nys' },
    isLoading: false,
  })
  mockUseDeactivateUser.mockReturnValue(MUTATION_STUB)
  mockUseActivateStaffLogin.mockReturnValue(MUTATION_STUB)
  mockUseResetStaffPassword.mockReturnValue(MUTATION_STUB)
  mockUseLinkAuthUser.mockReturnValue(MUTATION_STUB)
  mockUseSendCredentialsSms.mockReturnValue(MUTATION_STUB)
  mockUseCreateStudentLogin.mockReturnValue(MUTATION_STUB)
  mockUseResetStudentPassword.mockReturnValue(MUTATION_STUB)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('AdminUsersPage', () => {
  // ── Page structure ────────────────────────────────────────────────────────
  it('renders the "User Logins" heading', () => {
    render(<AdminUsersPage />)
    expect(screen.getByRole('heading', { name: /user logins/i })).toBeInTheDocument()
  })

  it('renders the hero subtitle', () => {
    render(<AdminUsersPage />)
    expect(screen.getByText(/activate and manage system access/i)).toBeInTheDocument()
  })

  it('renders a "Create User" button in the hero area', () => {
    render(<AdminUsersPage />)
    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument()
  })

  it('opens the Create User modal using the shared modal dialog class (correct mobile/viewport positioning)', async () => {
    const user = userEvent.setup()
    render(<AdminUsersPage />)
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(screen.getByText('Create Staff Account')).toBeInTheDocument()
    })
    // The dialog must carry .sui-modal-dialog — that's what drives the app's
    // shared mobile bottom-sheet / viewport-safe positioning (index.css). A
    // bespoke unstyled div here previously caused the modal to render outside
    // the visible viewport on mobile, requiring a scroll to see it.
    const dialog = screen.getByText('Create Staff Account').closest('.sui-modal-dialog')
    expect(dialog).not.toBeNull()
  })

  it('renders all four section tabs: Staff, Students, Parents, Credentials', async () => {
    render(<AdminUsersPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^staff/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^students$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^parents$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^credentials$/i })).toBeInTheDocument()
    })
  })

  it('renders sub-tabs: Pending Activation and Active Logins', async () => {
    render(<AdminUsersPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pending activation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /active logins/i })).toBeInTheDocument()
    })
  })

  // ── Staff section (default) ───────────────────────────────────────────────
  it('shows pending staff cards with names from hook data', async () => {
    render(<AdminUsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
      expect(screen.getByText('Carol Tendo')).toBeInTheDocument()
    })
  })

  it('shows "Activate Login" button for pending staff (no authUserId)', async () => {
    render(<AdminUsersPage />)
    await waitFor(() => {
      const activateBtns = screen.getAllByRole('button', { name: /activate login/i })
      expect(activateBtns.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows skeleton cards while staff is loading', () => {
    setupMocks([], true)
    render(<AdminUsersPage />)
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "All staff have active logins" when no pending staff', async () => {
    setupMocks([ACTIVE_STAFF])
    render(<AdminUsersPage />)
    await waitFor(() => {
      expect(screen.getByText(/all staff have active logins/i)).toBeInTheDocument()
    })
  })

  it('shows search input for staff', () => {
    render(<AdminUsersPage />)
    expect(screen.getByPlaceholderText(/search by name, staff number or email/i)).toBeInTheDocument()
  })

  it('filters pending staff by search query', async () => {
    const user = userEvent.setup()
    render(<AdminUsersPage />)
    await waitFor(() => screen.getByText('Alice Nakato'))

    await user.type(
      screen.getByPlaceholderText(/search by name, staff number or email/i),
      'alice',
    )
    expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
    expect(screen.queryByText('Carol Tendo')).not.toBeInTheDocument()
  })

  it('renders role filter pills for Staff section', async () => {
    render(<AdminUsersPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^teacher$/i })).toBeInTheDocument()
    })
  })

  // ── Pending Activations banner ────────────────────────────────────────────
  it('shows Pending Activations banner when staff are pending', async () => {
    render(<AdminUsersPage />)
    await waitFor(() => {
      expect(screen.getByText(/pending activations/i)).toBeInTheDocument()
    })
  })

  it('shows "Activate All N Staff" button in the banner', async () => {
    render(<AdminUsersPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate all.*staff/i })).toBeInTheDocument()
    })
  })

  it('does not show Pending Activations banner when all staff have logins', async () => {
    setupMocks([ACTIVE_STAFF])
    render(<AdminUsersPage />)
    await waitFor(() => {
      // Banner only shows when pending > 0
      expect(screen.queryByText(/pending activations/i)).not.toBeInTheDocument()
    })
  })

  // ── Section switching ─────────────────────────────────────────────────────
  it('switches to Students section and shows student search placeholder', async () => {
    const user = userEvent.setup()
    render(<AdminUsersPage />)

    await user.click(screen.getByRole('button', { name: /^students$/i }))
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by name or admission number/i),
      ).toBeInTheDocument()
    })
  })

  it('switches to Parents section and renders the section', async () => {
    const user = userEvent.setup()
    render(<AdminUsersPage />)

    await user.click(screen.getByRole('button', { name: /^parents$/i }))
    // After switching to parents, sub-tabs change to parents context
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pending activation/i })).toBeInTheDocument()
    })
  })

  it('switches to Credentials section and hides sub-tabs', async () => {
    const user = userEvent.setup()
    render(<AdminUsersPage />)

    await user.click(screen.getByRole('button', { name: /^credentials$/i }))
    await waitFor(() => {
      // "Pending Activation" sub-tab should be gone in Credentials section
      expect(screen.queryByRole('button', { name: /pending activation/i })).not.toBeInTheDocument()
    })
  })

  // ── Active Logins sub-tab ─────────────────────────────────────────────────
  it('clicking Active Logins sub-tab shows active staff with Reset Password button', async () => {
    const user = userEvent.setup()
    render(<AdminUsersPage />)

    await user.click(screen.getByRole('button', { name: /active logins/i }))
    await waitFor(() => {
      expect(screen.getByText('Bob Okello')).toBeInTheDocument()
    })
    // Active staff card shows Reset Password button
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })
})
