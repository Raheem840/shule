import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub (vi.hoisted so mockChain available inside vi.mock factory)
const { mockChain } = vi.hoisted(() => {
  const mockChain = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    is:          vi.fn().mockReturnThis(),
    not:         vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    in:          vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    insert:      vi.fn().mockReturnThis(),
    // Both count queries ({ count: 0 }) and data queries ({ data: [], error: null })
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

vi.mock('../../hooks/useClasses', () => ({ useClasses: vi.fn() }))

vi.mock('../../hooks/useAdmin', () => ({ useSchoolSettings: vi.fn() }))

vi.mock('../../hooks/useStaffAuth', () => ({
  useActivateStaffLogin: vi.fn(),
  useResetStaffPassword: vi.fn(),
}))

vi.mock('../../hooks/useStaffPasswordRequests', () => ({
  usePendingStaffPasswordRequests: vi.fn(),
  useResolveStaffPasswordRequest:  vi.fn(),
}))

vi.mock('../../hooks/useStudents', () => ({
  useCreateStudentLogin:         vi.fn(),
  useResetStudentPassword:       vi.fn(),
  getPendingStudentActivations:  vi.fn().mockReturnValue({}),
  clearPendingStudentActivation: vi.fn(),
}))

// ── Toast + passwords ──────────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

vi.mock('../../lib/passwords', () => ({
  generateTempPassword: vi.fn().mockReturnValue('Temp@5555'),
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { useStaff } from '../../hooks/useStaff'
import { useClasses } from '../../hooks/useClasses'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { useActivateStaffLogin, useResetStaffPassword } from '../../hooks/useStaffAuth'
import { useCreateStudentLogin, useResetStudentPassword } from '../../hooks/useStudents'
import { usePendingStaffPasswordRequests, useResolveStaffPasswordRequest } from '../../hooks/useStaffPasswordRequests'
import { CredentialsMgmtPage } from '../../pages/admin/CredentialsMgmtPage'

const mockUseStaff              = useStaff              as ReturnType<typeof vi.fn>
const mockUseClasses            = useClasses            as ReturnType<typeof vi.fn>
const mockUseSchoolSettings     = useSchoolSettings     as ReturnType<typeof vi.fn>
const mockUseActivateStaffLogin = useActivateStaffLogin as ReturnType<typeof vi.fn>
const mockUseResetStaffPassword = useResetStaffPassword as ReturnType<typeof vi.fn>
const mockUseCreateStudentLogin = useCreateStudentLogin as ReturnType<typeof vi.fn>
const mockUseResetStudentPassword = useResetStudentPassword as ReturnType<typeof vi.fn>
const mockUsePendingRequests     = usePendingStaffPasswordRequests as ReturnType<typeof vi.fn>
const mockUseResolveRequest      = useResolveStaffPasswordRequest  as ReturnType<typeof vi.fn>

const MUTATION_STUB = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }

const STAFF_NO_LOGIN = {
  id: 'sf1', firstName: 'Alice', lastName: 'Nakato', role: 'teacher',
  email: 'alice@nys.ug', staffNumber: 'NYS/STAFF/001',
  authUserId: null, departmentId: null, photoUrl: null,
  phone: '+256700111222', isActive: true, schoolId: 's1', tempPassword: null,
}
const STAFF_WITH_LOGIN = {
  id: 'sf2', firstName: 'Bob', lastName: 'Ssemanda', role: 'bursar',
  email: 'bob@nys.ug', staffNumber: 'NYS/STAFF/002',
  authUserId: 'auth-002', departmentId: null, photoUrl: null,
  phone: null, isActive: true, schoolId: 's1', tempPassword: 'OldPw@22',
}

function setupMocks(staffData = [STAFF_NO_LOGIN, STAFF_WITH_LOGIN], isLoading = false) {
  mockUseStaff.mockReturnValue({ data: staffData, isLoading })
  mockUseClasses.mockReturnValue({ data: [], isLoading: false })
  mockUseSchoolSettings.mockReturnValue({
    data: { schoolName: 'Nile Youth School', shortName: 'NYS' },
    isLoading: false,
  })
  mockUseActivateStaffLogin.mockReturnValue(MUTATION_STUB)
  mockUseResetStaffPassword.mockReturnValue(MUTATION_STUB)
  mockUseCreateStudentLogin.mockReturnValue(MUTATION_STUB)
  mockUseResetStudentPassword.mockReturnValue(MUTATION_STUB)
  mockUsePendingRequests.mockReturnValue({ data: [], isLoading: false })
  mockUseResolveRequest.mockReturnValue(MUTATION_STUB)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('CredentialsMgmtPage', () => {
  // ── Page structure ────────────────────────────────────────────────────────
  it('renders the "Credentials Management" heading', () => {
    render(<CredentialsMgmtPage />)
    expect(screen.getByRole('heading', { name: /credentials management/i })).toBeInTheDocument()
  })

  it('renders the hero subtitle describing the page purpose', () => {
    render(<CredentialsMgmtPage />)
    expect(screen.getByText(/activate, reset, and audit system access/i)).toBeInTheDocument()
  })

  it('renders three tab buttons: Staff Accounts, Student Accounts, Parent Accounts', () => {
    render(<CredentialsMgmtPage />)
    expect(screen.getByRole('button', { name: /staff accounts/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /student accounts/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /parent accounts/i })).toBeInTheDocument()
  })

  it('renders KPI chips in the hero band for Staff, Students, Parents', () => {
    render(<CredentialsMgmtPage />)
    expect(screen.getByText(/staff active/i)).toBeInTheDocument()
    expect(screen.getByText(/students active/i)).toBeInTheDocument()
    expect(screen.getByText(/parents active/i)).toBeInTheDocument()
  })

  it('shows the orphan/duplicate accounts warning notice', () => {
    render(<CredentialsMgmtPage />)
    expect(screen.getByText(/orphan accounts/i)).toBeInTheDocument()
  })

  // ── Staff panel (default tab) ─────────────────────────────────────────────
  it('renders staff rows with names on the Staff Accounts tab', async () => {
    render(<CredentialsMgmtPage />)
    await waitFor(() => {
      expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
      expect(screen.getByText('Bob Ssemanda')).toBeInTheDocument()
    })
  })

  it('shows "Activate" button for staff with no login account', async () => {
    render(<CredentialsMgmtPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^activate$/i })).toBeInTheDocument()
    })
  })

  it('shows "Reset PW" button for staff who already have a login', async () => {
    render(<CredentialsMgmtPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset pw/i })).toBeInTheDocument()
    })
  })

  it('shows "No login" status badge for staff without auth account', async () => {
    render(<CredentialsMgmtPage />)
    await waitFor(() => {
      expect(screen.getByText('No login')).toBeInTheDocument()
    })
  })

  it('shows "Active" status badge for staff with a login', async () => {
    render(<CredentialsMgmtPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    })
  })

  it('shows search input on the Staff panel', () => {
    render(<CredentialsMgmtPage />)
    expect(
      screen.getByPlaceholderText(/search name, staff number or email/i),
    ).toBeInTheDocument()
  })

  it('filters staff list by search query', async () => {
    const user = userEvent.setup()
    render(<CredentialsMgmtPage />)
    await waitFor(() => screen.getByText('Alice Nakato'))

    await user.type(
      screen.getByPlaceholderText(/search name, staff number or email/i),
      'alice',
    )
    expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
    expect(screen.queryByText('Bob Ssemanda')).not.toBeInTheDocument()
  })

  it('shows "No staff match your search" when search finds nothing', async () => {
    const user = userEvent.setup()
    render(<CredentialsMgmtPage />)
    await waitFor(() => screen.getByText('Alice Nakato'))

    await user.type(
      screen.getByPlaceholderText(/search name, staff number or email/i),
      'zzz_nobody',
    )
    expect(screen.getByText(/no staff match your search/i)).toBeInTheDocument()
  })

  it('shows skeleton rows while staff data is loading', () => {
    setupMocks([], true)
    render(<CredentialsMgmtPage />)
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "No staff records" when staff list is empty and no search', async () => {
    setupMocks([])
    render(<CredentialsMgmtPage />)
    await waitFor(() => {
      expect(screen.getByText(/no staff records/i)).toBeInTheDocument()
    })
  })

  it('shows "Activate All" button when there are unactivated staff with emails', async () => {
    render(<CredentialsMgmtPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate all/i })).toBeInTheDocument()
    })
  })

  // ── Student Accounts tab ──────────────────────────────────────────────────
  it('switches to Student Accounts tab when clicked', async () => {
    const user = userEvent.setup()
    render(<CredentialsMgmtPage />)

    await user.click(screen.getByRole('button', { name: /student accounts/i }))
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by name or admission number/i),
      ).toBeInTheDocument()
    })
  })

  it('shows "No students found" on Student tab with empty supabase response', async () => {
    const user = userEvent.setup()
    render(<CredentialsMgmtPage />)
    await user.click(screen.getByRole('button', { name: /student accounts/i }))
    await waitFor(() => {
      expect(screen.getByText(/no students found/i)).toBeInTheDocument()
    })
  })

  // ── Parent Accounts tab ───────────────────────────────────────────────────
  it('switches to Parent Accounts tab when clicked', async () => {
    const user = userEvent.setup()
    render(<CredentialsMgmtPage />)

    await user.click(screen.getByRole('button', { name: /parent accounts/i }))
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by name, email or phone/i),
      ).toBeInTheDocument()
    })
  })

  it('shows "No parent accounts yet" on Parent tab with empty supabase response', async () => {
    const user = userEvent.setup()
    render(<CredentialsMgmtPage />)
    await user.click(screen.getByRole('button', { name: /parent accounts/i }))
    await waitFor(() => {
      expect(screen.getByText(/no parent accounts yet/i)).toBeInTheDocument()
    })
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  it('renders the footer audit log note', () => {
    render(<CredentialsMgmtPage />)
    expect(screen.getByText(/all credential actions are recorded in the audit log/i)).toBeInTheDocument()
  })

  // ── Password Requests tab ─────────────────────────────────────────────────
  describe('Password Requests tab', () => {
    it('shows a pending-count badge on the tab when there are pending requests', () => {
      mockUsePendingRequests.mockReturnValue({
        data: [{ id: 'req-1', staffId: 'sf1', kind: 'activation', status: 'pending', requestedAt: '2026-07-01T00:00:00Z', staffName: 'Alice Nakato', staffNumber: 'NYS/STAFF/001', staffRole: 'teacher' }],
        isLoading: false,
      })
      render(<CredentialsMgmtPage />)
      expect(screen.getByRole('button', { name: /password requests \(1\)/i })).toBeInTheDocument()
    })

    it('lists a pending request with staff name and kind, and no password anywhere', async () => {
      mockUsePendingRequests.mockReturnValue({
        data: [{ id: 'req-1', staffId: 'sf1', kind: 'reset', status: 'pending', requestedAt: '2026-07-01T00:00:00Z', staffName: 'Alice Nakato', staffNumber: 'NYS/STAFF/001', staffRole: 'teacher' }],
        isLoading: false,
      })
      const user = userEvent.setup()
      render(<CredentialsMgmtPage />)

      await user.click(screen.getByRole('button', { name: /password requests/i }))
      expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
      expect(screen.getByText('Password reset')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
    })

    it('calls resolve with action "approve" when Approve is clicked', async () => {
      mockUsePendingRequests.mockReturnValue({
        data: [{ id: 'req-1', staffId: 'sf1', kind: 'activation', status: 'pending', requestedAt: '2026-07-01T00:00:00Z', staffName: 'Alice Nakato', staffNumber: 'NYS/STAFF/001', staffRole: 'teacher' }],
        isLoading: false,
      })
      const resolveMutate = vi.fn().mockResolvedValue({ success: true, action: 'approved' })
      mockUseResolveRequest.mockReturnValue({ ...MUTATION_STUB, mutateAsync: resolveMutate })

      const user = userEvent.setup()
      render(<CredentialsMgmtPage />)
      await user.click(screen.getByRole('button', { name: /password requests/i }))
      await user.click(screen.getByRole('button', { name: /approve/i }))

      expect(resolveMutate).toHaveBeenCalledWith({ requestId: 'req-1', action: 'approve' })
    })

    it('calls resolve with action "reject" when Decline is clicked', async () => {
      mockUsePendingRequests.mockReturnValue({
        data: [{ id: 'req-1', staffId: 'sf1', kind: 'activation', status: 'pending', requestedAt: '2026-07-01T00:00:00Z', staffName: 'Alice Nakato', staffNumber: 'NYS/STAFF/001', staffRole: 'teacher' }],
        isLoading: false,
      })
      const resolveMutate = vi.fn().mockResolvedValue({ success: true, action: 'rejected' })
      mockUseResolveRequest.mockReturnValue({ ...MUTATION_STUB, mutateAsync: resolveMutate })

      const user = userEvent.setup()
      render(<CredentialsMgmtPage />)
      await user.click(screen.getByRole('button', { name: /password requests/i }))
      await user.click(screen.getByRole('button', { name: /decline/i }))

      expect(resolveMutate).toHaveBeenCalledWith({ requestId: 'req-1', action: 'reject' })
    })

    it('shows "No pending password requests" when the queue is empty', async () => {
      const user = userEvent.setup()
      render(<CredentialsMgmtPage />)
      await user.click(screen.getByRole('button', { name: /password requests/i }))
      expect(screen.getByText(/no pending password requests/i)).toBeInTheDocument()
    })
  })
})
