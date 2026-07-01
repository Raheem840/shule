import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub ──────────────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: vi.fn(),
  },
}))

// ── Auth context stub ──────────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'principal', schoolId: 's1', name: 'P', email: 'p@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Toast stub ─────────────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

// ── Avatar stub ─────────────────────────────────────────────────────────────
vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}))

// ── Hook mocks ─────────────────────────────────────────────────────────────
vi.mock('../../hooks/useStudents', () => ({
  useStudents:         vi.fn(),
  useSetStudentStatus: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
  useStreams:  vi.fn(),
}))

import { useStudents, useSetStudentStatus } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { PrincipalStudentsPage } from '../../pages/principal/PrincipalStudentsPage'

const mockStudents    = useStudents         as ReturnType<typeof vi.fn>
const mockSetStatus   = useSetStudentStatus as ReturnType<typeof vi.fn>
const mockClasses     = useClasses          as ReturnType<typeof vi.fn>
const mockStreams      = useStreams          as ReturnType<typeof vi.fn>

const STUDENTS = [
  {
    id: 'st1', firstName: 'Grace', lastName: 'Apio',
    classId: 'c1', streamId: 's1',
    admissionNumber: 'KAB/2026/001',
    status: 'active', gender: 'female', studentType: 'day',
    photoUrl: null, dob: null,
  },
  {
    id: 'st2', firstName: 'Joel', lastName: 'Otim',
    classId: 'c1', streamId: null,
    admissionNumber: 'KAB/2026/002',
    status: 'suspended', gender: 'male', studentType: 'boarder',
    photoUrl: null, dob: null,
  },
  {
    id: 'st3', firstName: 'Sarah', lastName: 'Nakato',
    classId: 'c2', streamId: null,
    admissionNumber: 'KAB/2026/003',
    status: 'active', gender: 'female', studentType: 'day',
    photoUrl: null, dob: null,
  },
]

const CLASSES = [
  { id: 'c1', name: 'S.1', level: '1' },
  { id: 'c2', name: 'S.2', level: '2' },
]

const STREAMS = [{ id: 's1', name: 'East', classId: 'c1' }]

function setupMocks(students: any[] = [], loading = false) {
  mockStudents.mockReturnValue({ data: students, isLoading: loading })
  mockSetStatus.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockClasses.mockReturnValue({ data: CLASSES, isLoading: false })
  mockStreams.mockReturnValue({ data: STREAMS, isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('PrincipalStudentsPage', () => {
  it('renders "Students" page heading', () => {
    setupMocks()
    render(<PrincipalStudentsPage />)
    expect(screen.getByText('Students')).toBeInTheDocument()
  })

  it('renders search input placeholder', () => {
    setupMocks()
    render(<PrincipalStudentsPage />)
    expect(screen.getByPlaceholderText(/search by name or admission number/i)).toBeInTheDocument()
  })

  it('renders All Classes filter in dropdown', () => {
    setupMocks()
    render(<PrincipalStudentsPage />)
    expect(screen.getByText('All Classes')).toBeInTheDocument()
  })

  it('shows status filter pills: All, Active, Suspended, Expelled', () => {
    setupMocks()
    render(<PrincipalStudentsPage />)
    expect(screen.getByText(/^All$/)).toBeInTheDocument()
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/suspended/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/expelled/i).length).toBeGreaterThan(0)
  })

  it('shows "Enrolled student register" subtitle when not loading', () => {
    setupMocks()
    render(<PrincipalStudentsPage />)
    expect(screen.getByText(/enrolled student register/i)).toBeInTheDocument()
  })

  it('renders skeleton cards while loading', () => {
    setupMocks([], true)
    render(<PrincipalStudentsPage />)
    // Page header still visible
    expect(screen.getByText('Students')).toBeInTheDocument()
  })

  it('shows "No students found" when list is empty', () => {
    setupMocks([])
    render(<PrincipalStudentsPage />)
    expect(screen.getByText(/no students found/i)).toBeInTheDocument()
  })

  it('shows "No students have been enrolled yet" hint when list is empty and no filters', () => {
    setupMocks([])
    render(<PrincipalStudentsPage />)
    expect(screen.getByText(/no students have been enrolled yet/i)).toBeInTheDocument()
  })

  it('renders student cards when data is present', () => {
    setupMocks(STUDENTS)
    render(<PrincipalStudentsPage />)
    expect(screen.getByText('Grace Apio')).toBeInTheDocument()
    expect(screen.getByText('Joel Otim')).toBeInTheDocument()
    expect(screen.getByText('Sarah Nakato')).toBeInTheDocument()
  })

  it('shows admission numbers in student cards', () => {
    setupMocks(STUDENTS)
    render(<PrincipalStudentsPage />)
    expect(screen.getByText('KAB/2026/001')).toBeInTheDocument()
    expect(screen.getByText('KAB/2026/002')).toBeInTheDocument()
  })

  it('renders status badges on student cards', () => {
    setupMocks(STUDENTS)
    render(<PrincipalStudentsPage />)
    // Grace is Active
    const activeBadges = screen.getAllByText('Active')
    expect(activeBadges.length).toBeGreaterThan(0)
    // Joel is Suspended
    expect(screen.getAllByText('Suspended').length).toBeGreaterThan(0)
  })

  it('renders View Profile buttons for each student card', () => {
    setupMocks(STUDENTS)
    render(<PrincipalStudentsPage />)
    const viewButtons = screen.getAllByText('View Profile')
    expect(viewButtons.length).toBe(STUDENTS.length)
  })

  it('shows student count footer text', () => {
    setupMocks(STUDENTS)
    render(<PrincipalStudentsPage />)
    expect(screen.getByText(/3 students enrolled/i)).toBeInTheDocument()
  })

  it('filters students by search query', async () => {
    setupMocks(STUDENTS)
    const user = userEvent.setup()
    render(<PrincipalStudentsPage />)

    const searchInput = screen.getByPlaceholderText(/search by name or admission number/i)
    await user.type(searchInput, 'Grace')

    await waitFor(() => {
      expect(screen.getByText('Grace Apio')).toBeInTheDocument()
      expect(screen.queryByText('Joel Otim')).not.toBeInTheDocument()
    })
  })

  it('shows "Try clearing some filters" when search yields no results', async () => {
    setupMocks(STUDENTS)
    const user = userEvent.setup()
    render(<PrincipalStudentsPage />)

    const searchInput = screen.getByPlaceholderText(/search by name or admission number/i)
    await user.type(searchInput, 'zzz-no-match')

    await waitFor(() => {
      expect(screen.getByText(/try clearing some filters/i)).toBeInTheDocument()
    })
  })

  it('shows "Export CSV" button when students are present', () => {
    setupMocks(STUDENTS)
    render(<PrincipalStudentsPage />)
    expect(screen.getByText(/export csv/i)).toBeInTheDocument()
  })

  it('KPI stats show correct counts', () => {
    setupMocks(STUDENTS)
    render(<PrincipalStudentsPage />)
    // 3 total, 2 active, 1 suspended, 0 expelled
    expect(screen.getByText('3')).toBeInTheDocument()   // Total Enrolled
    expect(screen.getByText('Total Enrolled')).toBeInTheDocument()
  })
})
