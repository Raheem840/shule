import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub ──────────────────────────────────────────────────────────────
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

// ── AuthContext stub ───────────────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'deputy', schoolId: 's1', name: 'Deputy', email: 'dep@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Hook mocks ─────────────────────────────────────────────────────────────────
vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
  useStreams:  vi.fn(),
}))

// Mobile mode — avoids the virtualised desktop table
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(true),
}))

// Avatar stub — avoids signed URL logic
vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}))

// Toast stub — PromoteStudentsSection (rendered when "Promote Students" is clicked) uses useToast()
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

import { useStudents }         from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { DeputyStudentsPage }  from '../../pages/deputy/DeputyStudentsPage'

const mockStudents = useStudents as ReturnType<typeof vi.fn>
const mockClasses  = useClasses  as ReturnType<typeof vi.fn>
const mockStreams   = useStreams   as ReturnType<typeof vi.fn>

const CLASSES = [
  { id: 'c1', name: 'S.1', level: '1', schoolId: 's1' },
  { id: 'c2', name: 'S.2', level: '2', schoolId: 's1' },
]

const STUDENTS = [
  {
    id: 'stu1',
    firstName: 'Alice',
    lastName:  'Nakato',
    admissionNumber: 'ST/2026/001',
    classId:   'c1',
    streamId:  null,
    status:    'active' as const,
    gender:    'Female',
    studentType: 'day',
    photoUrl:  null,
  },
  {
    id: 'stu2',
    firstName: 'Brian',
    lastName:  'Ssempa',
    admissionNumber: 'ST/2026/002',
    classId:   'c2',
    streamId:  null,
    status:    'suspended' as const,
    gender:    'Male',
    studentType: 'day',
    photoUrl:  null,
  },
]

function setupMocks(opts: { students?: any[]; isLoading?: boolean; classes?: any[] } = {}) {
  mockStudents.mockReturnValue({ data: opts.students ?? [], isLoading: opts.isLoading ?? false })
  mockClasses.mockReturnValue({ data: opts.classes ?? CLASSES, isLoading: false })
  mockStreams.mockReturnValue({ data: [], isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('DeputyStudentsPage', () => {
  it('renders the Students heading', () => {
    setupMocks()
    render(<DeputyStudentsPage />)
    expect(screen.getByText('Students')).toBeInTheDocument()
  })

  it('renders the student directory subtitle', () => {
    setupMocks()
    render(<DeputyStudentsPage />)
    expect(screen.getByText(/student directory/i)).toBeInTheDocument()
  })

  it('renders a "Promote Students" button that reveals the promotion section', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<DeputyStudentsPage />)

    const btn = screen.getByRole('button', { name: /promote students/i })
    expect(btn).toBeInTheDocument()
    expect(screen.queryByText(/end-of-year: promote students/i)).not.toBeInTheDocument()

    await user.click(btn)
    expect(screen.getByText(/end-of-year: promote students/i)).toBeInTheDocument()
  })

  it('shows loading skeletons while students load', () => {
    setupMocks({ isLoading: true })
    render(<DeputyStudentsPage />)
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "No students enrolled yet" when list is empty', () => {
    setupMocks({ students: [] })
    render(<DeputyStudentsPage />)
    expect(screen.getByText(/no students enrolled yet/i)).toBeInTheDocument()
  })

  it('renders student names when students exist', () => {
    setupMocks({ students: STUDENTS })
    render(<DeputyStudentsPage />)
    expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
    expect(screen.getByText('Brian Ssempa')).toBeInTheDocument()
  })

  it('renders admission numbers', () => {
    setupMocks({ students: STUDENTS })
    render(<DeputyStudentsPage />)
    expect(screen.getByText('ST/2026/001')).toBeInTheDocument()
    expect(screen.getByText('ST/2026/002')).toBeInTheDocument()
  })

  it('renders Active and Suspended status badges', () => {
    setupMocks({ students: STUDENTS })
    render(<DeputyStudentsPage />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })

  it('renders class badges for enrolled students', () => {
    setupMocks({ students: STUDENTS })
    render(<DeputyStudentsPage />)
    expect(screen.getAllByText('S.1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S.2').length).toBeGreaterThan(0)
  })

  it('shows total student count badge', () => {
    setupMocks({ students: STUDENTS })
    render(<DeputyStudentsPage />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders class filter dropdown', () => {
    setupMocks()
    render(<DeputyStudentsPage />)
    expect(screen.getByText('All Classes')).toBeInTheDocument()
  })

  it('shows "Export CSV" button when students are present', () => {
    setupMocks({ students: STUDENTS })
    render(<DeputyStudentsPage />)
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('search by name filters results', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<DeputyStudentsPage />)

    const input = screen.getByPlaceholderText(/search name or adm\. number/i)
    await user.type(input, 'Alice')

    await waitFor(() => {
      expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
      expect(screen.queryByText('Brian Ssempa')).not.toBeInTheDocument()
    })
  })

  it('shows "No matching students" when search finds nothing', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<DeputyStudentsPage />)

    await user.type(screen.getByPlaceholderText(/search name or adm\. number/i), 'zzznomatch')

    await waitFor(() => {
      expect(screen.getByText(/no matching students/i)).toBeInTheDocument()
    })
  })

  it('does NOT render any fee balance or financial column', () => {
    setupMocks({ students: STUDENTS })
    render(<DeputyStudentsPage />)
    expect(screen.queryByText(/fee/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/ugx/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/payment/i)).not.toBeInTheDocument()
  })
})
