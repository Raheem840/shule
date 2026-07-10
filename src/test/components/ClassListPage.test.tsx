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
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      then:   (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    }),
  },
}))

// ── Auth ───────────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'secretary', schoolId: 's1', name: 'Secretary', email: 'sec@school.ac.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Hooks ──────────────────────────────────────────────────────
vi.mock('../../hooks/useClasses', () => ({
  useClasses:     vi.fn(),
  useStreams:      vi.fn(),
  useCreateClass:  vi.fn(),
  useCreateStream: vi.fn(),
  useMoveStudent:  vi.fn(),
  useSubjects:     vi.fn(),
  useDepartments:  vi.fn(),
}))

vi.mock('../../hooks/useStaff', () => ({
  useStaff: vi.fn(),
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
}))

vi.mock('../../hooks/useAdmin', () => ({ useSchoolSettings: vi.fn() }))

// ── Toast ──────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

// ── Imports after mocks ────────────────────────────────────────
import {
  useClasses, useStreams, useCreateClass, useCreateStream, useMoveStudent,
} from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import { useStudents } from '../../hooks/useStudents'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { ClassListPage } from '../../pages/secretary/ClassListPage'

const mockUseClasses     = useClasses     as ReturnType<typeof vi.fn>
const mockUseStreams      = useStreams      as ReturnType<typeof vi.fn>
const mockUseCreateClass  = useCreateClass  as ReturnType<typeof vi.fn>
const mockUseCreateStream = useCreateStream as ReturnType<typeof vi.fn>
const mockUseMoveStudent  = useMoveStudent  as ReturnType<typeof vi.fn>
const mockUseStaff        = useStaff        as ReturnType<typeof vi.fn>
const mockUseStudents     = useStudents     as ReturnType<typeof vi.fn>
const mockUseSchoolSettings = useSchoolSettings as ReturnType<typeof vi.fn>

const MUTATION_STUB = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }

function setupMocks(classes: any[] = []) {
  mockUseClasses.mockReturnValue({ data: classes, isLoading: false })
  mockUseStreams.mockReturnValue({ data: [], isLoading: false })
  mockUseCreateClass.mockReturnValue(MUTATION_STUB)
  mockUseCreateStream.mockReturnValue(MUTATION_STUB)
  mockUseMoveStudent.mockReturnValue(MUTATION_STUB)
  mockUseStaff.mockReturnValue({ data: [], isLoading: false })
  mockUseStudents.mockReturnValue({ data: [], isLoading: false })
  mockUseSchoolSettings.mockReturnValue({
    data: { schoolName: 'Test School', shortName: 'TS', motto: null, logoUrl: null },
    isLoading: false,
  })
}

const SAMPLE_CLASSES = [
  { id: 'c1', name: 'S.1', level: '1', academicYearId: 'ay1' },
  { id: 'c2', name: 'S.2', level: '2', academicYearId: 'ay1' },
  { id: 'c3', name: 'S.3', level: '3', academicYearId: 'ay1' },
]

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('ClassListPage', () => {
  it('renders the page heading "Class List"', () => {
    render(<ClassListPage />)
    expect(screen.getByRole('heading', { name: /class list/i })).toBeInTheDocument()
  })

  it('renders "Add Class" button', () => {
    render(<ClassListPage />)
    expect(screen.getByRole('button', { name: /add class/i })).toBeInTheDocument()
  })

  it('shows loading skeletons while data loads', () => {
    mockUseClasses.mockReturnValue({ data: [], isLoading: true })
    render(<ClassListPage />)
    // Skeleton divs are present (class "shule-skeleton")
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no classes exist', () => {
    render(<ClassListPage />)
    expect(screen.getByText(/no classes yet/i)).toBeInTheDocument()
    expect(screen.getByText(/click "add class" above/i)).toBeInTheDocument()
  })

  it('renders class cards when classes data is provided', () => {
    setupMocks(SAMPLE_CLASSES)
    render(<ClassListPage />)
    // Each class name now appears twice — once in the interactive card, once
    // in the (CSS-hidden, not jsdom-hidden) print-only roster — so use
    // getAllByText rather than assuming a single match.
    expect(screen.getAllByText('S.1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S.2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S.3').length).toBeGreaterThan(0)
  })

  it('shows correct class count in subtitle', () => {
    setupMocks(SAMPLE_CLASSES)
    render(<ClassListPage />)
    expect(screen.getByText(/3 classes/i)).toBeInTheDocument()
  })

  it('shows "0 classes" when no classes', () => {
    render(<ClassListPage />)
    expect(screen.getByText(/0 classes/i)).toBeInTheDocument()
  })

  it('shows level labels for classes', () => {
    setupMocks(SAMPLE_CLASSES)
    render(<ClassListPage />)
    // Level label: S.1 → "S.1 (O-Level)"
    expect(screen.getAllByText(/O-Level/).length).toBeGreaterThan(0)
  })

  it('opens Add Class modal when "Add Class" button is clicked', async () => {
    const user = userEvent.setup()
    render(<ClassListPage />)
    await user.click(screen.getByRole('button', { name: /add class/i }))
    await waitFor(() => {
      expect(screen.getByText(/add new class/i)).toBeInTheDocument()
    })
  })

  it('Add Class modal has a class name input', async () => {
    const user = userEvent.setup()
    render(<ClassListPage />)
    await user.click(screen.getByRole('button', { name: /add class/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. S\.1/i)).toBeInTheDocument()
    })
  })

  it('Add Class modal can be dismissed with Cancel', async () => {
    const user = userEvent.setup()
    render(<ClassListPage />)
    await user.click(screen.getByRole('button', { name: /add class/i }))
    await waitFor(() => screen.getByText(/add new class/i))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText(/add new class/i)).not.toBeInTheDocument()
    })
  })

  it('shows Print Class List button when classes exist', () => {
    setupMocks(SAMPLE_CLASSES)
    render(<ClassListPage />)
    expect(screen.getByRole('button', { name: /print class list/i })).toBeInTheDocument()
  })

  it('does not show Print Class List button when no classes', () => {
    render(<ClassListPage />)
    expect(screen.queryByRole('button', { name: /print class list/i })).not.toBeInTheDocument()
  })

  it('shows "Add Stream" button inside each class card', () => {
    setupMocks(SAMPLE_CLASSES)
    render(<ClassListPage />)
    const addStreamBtns = screen.getAllByRole('button', { name: /add stream/i })
    expect(addStreamBtns.length).toBe(SAMPLE_CLASSES.length)
  })

  it('shows "No streams yet" message inside class card when no streams', () => {
    setupMocks(SAMPLE_CLASSES)
    render(<ClassListPage />)
    expect(screen.getAllByText(/no streams yet/i).length).toBeGreaterThan(0)
  })
})
