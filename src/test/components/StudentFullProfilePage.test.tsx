// Suspend/expel authority now belongs to the Deputy. StudentFullProfilePage
// (shared between /principal/students/:id and /deputy/students/:id) only
// renders the Actions block (Suspend/Expel/Reinstate + confirm modal) when
// the logged-in user is a deputy. Principal sees a read-only note instead.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}))

// Mutable role for the two describe blocks below.
const authState: { role: string } = { role: 'principal' }
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: authState.role, schoolId: 's1', name: 'U', email: 'u@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

const { PROFILE } = vi.hoisted(() => ({
  PROFILE: {
    id: 'stu-1',
    firstName: 'Grace',
    lastName: 'Apio',
    admissionNumber: 'KAB/2026/001',
    dob: '2010-01-01',
    gender: 'female',
    status: 'active',
    photoUrl: null,
    nationality: 'Ugandan',
    religion: 'Christian',
    medicalNotes: null,
    studentType: 'day',
    previousSchool: null,
    enrolledAt: '2026-01-10',
    className: 'S.1',
    streamName: 'East',
    attendanceRate: 90,
    totalDays: 20,
    presentDays: 18,
    disciplineCount: 0,
    recentDiscipline: [],
    examResults: [],
    feeSummary: { totalPaid: 100000, totalDue: 200000 },
  },
}))

vi.mock('../../hooks/usePrincipal', () => ({
  useStudentFullProfile: vi.fn().mockReturnValue({ data: PROFILE, isLoading: false, isError: false }),
  useSuspendStudent: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}))

import { StudentFullProfilePage } from '../../pages/principal/StudentFullProfilePage'
import { useStudentFullProfile, useSuspendStudent } from '../../hooks/usePrincipal'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/principal/students/:studentId" element={<StudentFullProfilePage />} />
        <Route path="/deputy/students/:studentId" element={<StudentFullProfilePage />} />
        <Route path="/dos/students/:studentId" element={<StudentFullProfilePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StudentFullProfilePage — as principal', () => {
  it('does not show Suspend/Expel action buttons', () => {
    authState.role = 'principal'
    renderAt('/principal/students/stu-1')
    expect(screen.queryByText('Suspend Student')).not.toBeInTheDocument()
    expect(screen.queryByText('Expel Student')).not.toBeInTheDocument()
  })

  it('shows the read-only note about Deputy authority', () => {
    authState.role = 'principal'
    renderAt('/principal/students/stu-1')
    expect(screen.getByText(/suspension and expulsion are managed by the deputy principal/i)).toBeInTheDocument()
  })

  it('shows the Fee Status section', () => {
    authState.role = 'principal'
    renderAt('/principal/students/stu-1')
    expect(screen.getByText('Fee Status')).toBeInTheDocument()
    expect(screen.getByText(/200,000/)).toBeInTheDocument()
  })
})

describe('StudentFullProfilePage — as deputy', () => {
  it('shows Suspend Student and Expel Student action buttons', () => {
    authState.role = 'deputy'
    renderAt('/deputy/students/stu-1')
    expect(screen.getByText('Suspend Student')).toBeInTheDocument()
    expect(screen.getByText('Expel Student')).toBeInTheDocument()
  })

  it('does not show the read-only note', () => {
    authState.role = 'deputy'
    renderAt('/deputy/students/stu-1')
    expect(screen.queryByText(/this view is read-only/i)).not.toBeInTheDocument()
  })

  it('does not show the Fee Status section — deputy gets zero financial data', () => {
    authState.role = 'deputy'
    renderAt('/deputy/students/stu-1')
    expect(screen.queryByText('Fee Status')).not.toBeInTheDocument()
    expect(screen.queryByText(/200,000/)).not.toBeInTheDocument()
  })
})

describe('StudentFullProfilePage — as DOS (pure academics only)', () => {
  it('shows profile, attendance, and academic performance sections', () => {
    authState.role = 'dos'
    renderAt('/dos/students/stu-1')
    expect(screen.getByText('Personal Information')).toBeInTheDocument()
    expect(screen.getByText('Academic Performance')).toBeInTheDocument()
    expect(screen.getByText('Attendance Summary')).toBeInTheDocument()
  })

  it('does not show the Fee Status section', () => {
    authState.role = 'dos'
    renderAt('/dos/students/stu-1')
    expect(screen.queryByText('Fee Status')).not.toBeInTheDocument()
    expect(screen.queryByText(/200,000/)).not.toBeInTheDocument()
  })

  it('does not show Suspend/Expel action buttons', () => {
    authState.role = 'dos'
    renderAt('/dos/students/stu-1')
    expect(screen.queryByText('Suspend Student')).not.toBeInTheDocument()
    expect(screen.queryByText('Expel Student')).not.toBeInTheDocument()
  })
})

// Reinstate previously called suspendMut.mutate(...) directly on click with
// zero confirmation, unlike Suspend/Expel which both require typing the
// student's full name — a misclick instantly reactivated a suspended
// student's account. Now routes through the same confirm-dialog flow.
describe('StudentFullProfilePage — Reinstate requires confirmation', () => {
  const mockMutateAsync = vi.fn().mockResolvedValue(undefined)

  it('does not call the mutation immediately on click — opens a confirm dialog instead', async () => {
    authState.role = 'deputy'
    vi.mocked(useStudentFullProfile).mockReturnValue({
      data: { ...PROFILE, status: 'suspended' }, isLoading: false, isError: false,
    } as any)
    vi.mocked(useSuspendStudent).mockReturnValue({
      mutateAsync: mockMutateAsync, isPending: false, isError: false,
    } as any)

    const user = userEvent.setup()
    renderAt('/deputy/students/stu-1')

    await user.click(screen.getByText('Reinstate'))
    expect(mockMutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText('Confirm Reinstatement')).toBeInTheDocument()

    await user.click(screen.getByText('Confirm'))
    expect(mockMutateAsync).toHaveBeenCalledWith({ studentId: 'stu-1', status: 'active' })
  })
})
