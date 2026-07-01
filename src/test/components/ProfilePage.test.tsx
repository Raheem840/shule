// Tests for ProfilePage — password section used to fork by role (IT admin
// got a direct change form; everyone else had to submit a plaintext-password
// "request" that IT admin manually approved via the Supabase dashboard).
// That request flow is gone: every role now changes their own password
// directly via useChangePassword (self-service, same as the login page's
// "Forgot password" → email flow, but while already signed in).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

const { mockChangePassword } = vi.hoisted(() => ({
  mockChangePassword: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../hooks/useProfile', () => ({
  useMyProfile: vi.fn(),
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProfilePhoto: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutateAsync: mockChangePassword, isPending: false }),
}))

vi.mock('../../hooks/useStaffPhotoUrl', () => ({
  useStaffPhotoUrl: () => null,
}))

vi.mock('../../store/BandwidthContext', () => ({
  useBandwidth: () => ({ isLowBandwidth: false, toggleBandwidth: vi.fn() }),
}))

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}))
vi.mock('../../store/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

import { useMyProfile } from '../../hooks/useProfile'
import { ProfilePage } from '../../pages/shared/ProfilePage'

const mockUseMyProfile = useMyProfile as ReturnType<typeof vi.fn>

const PROFILE = {
  id: 'p1', firstName: 'Jane', lastName: 'Doe', email: 'jane@k.ug', phone: null, address: null,
  role: 'teacher', staffNumber: 'S1', photoUrl: null, departmentName: null, schoolName: 'Test School',
  employmentType: null, qualificationLevel: null, joinDate: null, isActive: true, lastSignInAt: null,
}

function setup(role: string) {
  mockUseAuth.mockReturnValue({ user: { id: 'u1', role, schoolId: 's1', name: 'Jane Doe', email: 'jane@k.ug' } })
  mockUseMyProfile.mockReturnValue({ data: { ...PROFILE, role }, isLoading: false, isError: false })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe.each(['it_admin', 'teacher', 'secretary', 'deputy', 'bursar', 'principal'])(
  'ProfilePage password section — role: %s',
  (role) => {
    it('shows a direct "Change Password" form (no "Request Password Change" flow)', () => {
      setup(role)
      render(<ProfilePage />)
      expect(screen.getAllByText('Change Password').length).toBeGreaterThan(0)
      expect(screen.queryByText(/request password change/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/submit a request to the it admin/i)).not.toBeInTheDocument()
    })

    it('calls useChangePassword directly on submit — never goes through IT admin', async () => {
      setup(role)
      const user = userEvent.setup()
      render(<ProfilePage />)

      await user.type(screen.getByPlaceholderText('At least 8 characters'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Repeat new password'), 'NewPass123')
      await user.click(screen.getByRole('button', { name: /change password/i }))

      await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('NewPass123'))
    })
  }
)
