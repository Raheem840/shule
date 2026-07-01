// Tests for SecretaryStudentsPage — specifically the new "Promote Students"
// toggle (secretary is now one of the two roles allowed to promote students,
// alongside deputy — see usePromoteStudents.test.tsx for the hook-level gate).
// Heavy children (StudentsPage, wizards, modal) are stubbed since this page's
// own contribution is just the toggle + PromoteStudentsSection wiring.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import userEvent from '@testing-library/user-event'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'secretary', schoolId: 's1', name: 'Secretary', email: 'sec@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useStreams: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

vi.mock('../../pages/secretary/StudentsPage', () => ({
  StudentsPage: () => <div data-testid="students-page">students list</div>,
}))
vi.mock('../../pages/secretary/StudentRegistrationWizard', () => ({
  StudentRegistrationWizard: () => null,
}))
vi.mock('../../components/shared/ImportWizard', () => ({
  ImportWizard: () => null,
}))
vi.mock('../../components/ui/Modal', () => ({
  Modal: ({ children, open }: any) => (open ? <div>{children}</div> : null),
}))
vi.mock('../../components/shared/PromoteStudentsSection', () => ({
  PromoteStudentsSection: () => <div data-testid="promote-section">End-of-Year: Promote Students</div>,
}))

import { SecretaryStudentsPage } from '../../pages/secretary/SecretaryStudentsPage'

describe('SecretaryStudentsPage — promotion toggle', () => {
  it('renders a "Promote Students" button', () => {
    render(<SecretaryStudentsPage />)
    expect(screen.getByRole('button', { name: /promote students/i })).toBeInTheDocument()
  })

  it('reveals PromoteStudentsSection on click, and hides it again on second click', async () => {
    const user = userEvent.setup()
    render(<SecretaryStudentsPage />)

    expect(screen.queryByTestId('promote-section')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /promote students/i }))
    expect(screen.getByTestId('promote-section')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hide promotion/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /hide promotion/i }))
    expect(screen.queryByTestId('promote-section')).not.toBeInTheDocument()
  })

  it('still renders the main student list', () => {
    render(<SecretaryStudentsPage />)
    expect(screen.getByTestId('students-page')).toBeInTheDocument()
  })
})
