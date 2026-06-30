import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub ──────────────────────────────────────────────
// vi.hoisted runs before vi.mock factories — required so mockChain is in scope
const { mockChain } = vi.hoisted(() => {
  const mockChain = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    single:      vi.fn().mockResolvedValue({ data: { short_name: 'NYS' }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert:      vi.fn().mockResolvedValue({ data: { id: 'pa-new' }, error: null }),
    update:      vi.fn().mockReturnThis(),
    in:          vi.fn().mockReturnThis(),
    // Default list-style response — parent_accounts returns []
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
  }
  return { mockChain }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:            vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange:     vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword:    vi.fn().mockResolvedValue({ error: null }),
      signOut:               vi.fn(),
    },
    from:      vi.fn().mockReturnValue(mockChain),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
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

// ── Hook-layer mocks ───────────────────────────────────────────
vi.mock('../../hooks/useStudents', () => ({
  useStudents:              vi.fn(),
  useCreateStudentLogin:    vi.fn(),
  useResetStudentPassword:  vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
}))

// ── Toast ──────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

// ── Avatar: stub to avoid signed-URL logic ─────────────────────
vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}))

// ── passwords ──────────────────────────────────────────────────
vi.mock('../../lib/passwords', () => ({
  generateTempPassword: vi.fn().mockReturnValue('Temp@1234'),
}))

// ── Imports after mocks ────────────────────────────────────────
import { useStudents, useCreateStudentLogin, useResetStudentPassword } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import { ParentCredentialsPage } from '../../pages/secretary/ParentCredentialsPage'

const mockUseStudents             = useStudents            as ReturnType<typeof vi.fn>
const mockUseCreateStudentLogin   = useCreateStudentLogin  as ReturnType<typeof vi.fn>
const mockUseResetStudentPassword = useResetStudentPassword as ReturnType<typeof vi.fn>
const mockUseClasses              = useClasses              as ReturnType<typeof vi.fn>

const MUTATION_STUB = {
  mutate:      vi.fn(),
  mutateAsync: vi.fn(),
  isPending:   false,
}

const SAMPLE_STUDENTS = [
  { id: 's1', firstName: 'Grace',  lastName: 'Apio',   admissionNumber: 'NYS/2024/0001', classId: 'c1', streamId: null, photoUrl: null, authUserId: null, authEmail: null, tempPassword: null },
  { id: 's2', firstName: 'Moses',  lastName: 'Okello', admissionNumber: 'NYS/2024/0002', classId: 'c1', streamId: null, photoUrl: null, authUserId: null, authEmail: null, tempPassword: null },
  { id: 's3', firstName: 'Sandra', lastName: 'Nambi',  admissionNumber: 'NYS/2024/0003', classId: 'c2', streamId: null, photoUrl: null, authUserId: null, authEmail: null, tempPassword: null },
]

const SAMPLE_CLASSES = [
  { id: 'c1', name: 'S.1', level: '1', academicYearId: 'ay1' },
  { id: 'c2', name: 'S.2', level: '2', academicYearId: 'ay1' },
]

function setupMocks(students: any[] = [], classes: any[] = []) {
  mockUseStudents.mockReturnValue({ data: students, isLoading: false })
  mockUseClasses.mockReturnValue({ data: classes, isLoading: false })
  mockUseCreateStudentLogin.mockReturnValue(MUTATION_STUB)
  mockUseResetStudentPassword.mockReturnValue(MUTATION_STUB)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('ParentCredentialsPage', () => {
  it('renders the "Parent Portal Access" heading', () => {
    render(<ParentCredentialsPage />)
    expect(screen.getByRole('heading', { name: /parent portal access/i })).toBeInTheDocument()
  })

  it('renders the subtitle describing the page purpose', () => {
    render(<ParentCredentialsPage />)
    expect(screen.getByText(/generate and manage parent login credentials/i)).toBeInTheDocument()
  })

  it('shows stat chips — Total Accounts, Students Linked, New This Term', () => {
    render(<ParentCredentialsPage />)
    expect(screen.getByText(/total accounts/i)).toBeInTheDocument()
    expect(screen.getByText(/students linked/i)).toBeInTheDocument()
    expect(screen.getByText(/new this term/i)).toBeInTheDocument()
  })

  it('shows skeleton loading state while data is fetching', () => {
    mockUseStudents.mockReturnValue({ data: [], isLoading: true })
    mockUseClasses.mockReturnValue({ data: [], isLoading: false })
    render(<ParentCredentialsPage />)
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "No students registered yet" when no students exist', async () => {
    render(<ParentCredentialsPage />)
    // useParentAccounts (local useQuery) is async — wait for it to settle
    await waitFor(() => {
      expect(screen.getByText(/no students registered yet/i)).toBeInTheDocument()
    })
  })

  it('renders student list rows when students exist', async () => {
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => {
      expect(screen.getByText(/grace apio/i)).toBeInTheDocument()
      expect(screen.getByText(/moses okello/i)).toBeInTheDocument()
      expect(screen.getByText(/sandra nambi/i)).toBeInTheDocument()
    })
  })

  it('shows admission numbers in the student list', async () => {
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => {
      expect(screen.getByText(/NYS\/2024\/0001/)).toBeInTheDocument()
    })
  })

  it('renders a search input for filtering students', () => {
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    expect(screen.getByPlaceholderText(/search students/i)).toBeInTheDocument()
  })

  it('filters student list by name when search is typed', async () => {
    const user = userEvent.setup()
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    // Wait for accounts query to settle before interacting
    await waitFor(() => screen.getByText(/grace apio/i))

    const searchInput = screen.getByPlaceholderText(/search students/i)
    await user.type(searchInput, 'grace')

    expect(screen.getByText(/grace apio/i)).toBeInTheDocument()
    expect(screen.queryByText(/moses okello/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sandra nambi/i)).not.toBeInTheDocument()
  })

  it('shows "No students match your filters" when search finds nothing', async () => {
    const user = userEvent.setup()
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => screen.getByText(/grace apio/i))

    await user.type(screen.getByPlaceholderText(/search students/i), 'zzz_nonexistent')
    expect(screen.getByText(/no students match your filters/i)).toBeInTheDocument()
  })

  it('renders access filter pills — All, Has Access, No Access', async () => {
    render(<ParentCredentialsPage />)
    // Filter pills are always rendered
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /has access/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /no access/i })).toBeInTheDocument()
    })
  })

  it('shows class filter pills when classes exist', async () => {
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all classes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^S\.1$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^S\.2$/i })).toBeInTheDocument()
    })
  })

  it('filters by class when class pill is clicked', async () => {
    const user = userEvent.setup()
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => screen.getByText(/grace apio/i))

    await user.click(screen.getByRole('button', { name: /^S\.2$/i }))
    // Only Sandra Nambi is in S.2 (classId: c2)
    expect(screen.getByText(/sandra nambi/i)).toBeInTheDocument()
    expect(screen.queryByText(/grace apio/i)).not.toBeInTheDocument()
  })

  it('shows "Select a student" prompt in right panel when no student selected', async () => {
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => {
      expect(screen.getByText(/select a student/i)).toBeInTheDocument()
    })
  })

  it('shows student info in right panel when a student row is clicked', async () => {
    const user = userEvent.setup()
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => screen.getByText(/grace apio/i))

    await user.click(screen.getByText(/grace apio/i))
    await waitFor(() => {
      // Right panel should show student name header (appears twice — list row + right panel)
      expect(screen.getAllByText(/grace apio/i).length).toBeGreaterThan(1)
    })
  })

  it('shows footer count — "N of M students"', async () => {
    setupMocks(SAMPLE_STUDENTS, SAMPLE_CLASSES)
    render(<ParentCredentialsPage />)
    await waitFor(() => {
      expect(screen.getByText(/3 of 3 students/i)).toBeInTheDocument()
    })
  })
})
