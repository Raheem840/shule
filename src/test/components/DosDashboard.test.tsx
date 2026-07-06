import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Virtual scroller (TeacherPerformanceTab uses it)
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 52, size: 52, key: i })),
    getTotalSize: () => count * 52,
  }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'dos', schoolId: 's1', name: 'DoS', email: 'dos@k.ug', staffId: 'st-dos' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useDos', () => ({
  useDosOverview:          vi.fn(),
  useDosClassPerformance:  vi.fn(),
  useDosTeacherPerformance: vi.fn(),
  useDosCurriculumPlan:    vi.fn(),
  useAssignClassTeacher:   vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses:  vi.fn(),
  useStreams:   vi.fn(),
  useSubjects:  vi.fn(),
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

// Avoid rendering the real TermProgressTimeline (it calls useAcademicYear internally)
vi.mock('../../components/shared/TermProgressTimeline', () => ({
  SafeTermProgressTimeline: () => <div data-testid="term-progress" />,
  TermProgressTimeline:     () => <div />,
}))

// Recharts — stub out chart components (ResponsiveContainer has 0 width in jsdom)
vi.mock('recharts', () => ({
  LineChart:         ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line:              () => null,
  XAxis:             () => null,
  YAxis:             () => null,
  CartesianGrid:     () => null,
  Tooltip:           () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ReferenceLine:     () => null,
  BarChart:          ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar:               ({ children }: any) => <div>{children}</div>,
  Cell:              () => null,
}))

import {
  useDosOverview, useDosClassPerformance, useDosTeacherPerformance,
  useDosCurriculumPlan, useAssignClassTeacher,
} from '../../hooks/useDos'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { DosDashboard } from '../../pages/dos/DosDashboard'

const mockOverview      = useDosOverview           as ReturnType<typeof vi.fn>
const mockClassPerf     = useDosClassPerformance    as ReturnType<typeof vi.fn>
const mockTeacherPerf   = useDosTeacherPerformance  as ReturnType<typeof vi.fn>
const mockCurriculum    = useDosCurriculumPlan       as ReturnType<typeof vi.fn>
const mockAssign        = useAssignClassTeacher      as ReturnType<typeof vi.fn>
const mockClasses       = useClasses                as ReturnType<typeof vi.fn>
const mockStreams        = useStreams                as ReturnType<typeof vi.fn>
const mockSubjects      = useSubjects               as ReturnType<typeof vi.fn>

const OVERVIEW_DATA = {
  overallPassRate:         72,
  examJournalsThisTerm:    14,
  curriculumTopicsCovered: 38,
  activeTeachers:          9,
  subjectRankings:         [],
  passRateTrend:           [],
}

function setupMocks(opts: { overviewLoading?: boolean; overviewData?: any | null } = {}) {
  mockOverview.mockReturnValue({
    data:      opts.overviewData !== undefined ? opts.overviewData : OVERVIEW_DATA,
    isLoading: opts.overviewLoading ?? false,
    isError:   false,
  })
  mockClassPerf.mockReturnValue({ data: null, isLoading: false })
  mockTeacherPerf.mockReturnValue({ data: [], isLoading: false })
  mockCurriculum.mockReturnValue({ data: [], isLoading: false })
  mockAssign.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockClasses.mockReturnValue({ data: [], isLoading: false })
  mockStreams.mockReturnValue({ data: [], isLoading: false })
  mockSubjects.mockReturnValue({ data: [], isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('DosDashboard', () => {
  it('renders the "Director of Studies" heading', () => {
    setupMocks()
    render(<DosDashboard />)
    expect(screen.getByText(/director of studies/i)).toBeInTheDocument()
  })

  it('renders the SafeTermProgressTimeline', () => {
    setupMocks()
    render(<DosDashboard />)
    expect(screen.getByTestId('term-progress')).toBeInTheDocument()
  })

  it('renders all 4 KPI card labels', () => {
    setupMocks()
    render(<DosDashboard />)
    expect(screen.getAllByText(/school pass rate/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/exam journals/i)).toBeInTheDocument()
    expect(screen.getByText(/curriculum topics/i)).toBeInTheDocument()
    expect(screen.getByText(/active teachers/i)).toBeInTheDocument()
  })

  it('shows "—" placeholder in KPI cards while loading', () => {
    setupMocks({ overviewLoading: true })
    render(<DosDashboard />)
    // All numeric KPI values show "—" when loading
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })

  it('shows real values in KPI cards once data is loaded', () => {
    setupMocks()
    render(<DosDashboard />)
    expect(screen.getAllByText('72%').length).toBeGreaterThan(0)
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('renders the 4 dashboard tabs', () => {
    setupMocks()
    render(<DosDashboard />)
    // Radix Tabs.Trigger with asChild renders as role="tab"
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /class performance/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /teacher performance/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /curriculum plan/i })).toBeInTheDocument()
  })

  it('Overview tab shows "Loading overview…" when data is loading', () => {
    setupMocks({ overviewLoading: true })
    render(<DosDashboard />)
    expect(screen.getByText(/loading overview/i)).toBeInTheDocument()
  })

  it('Overview tab shows "Failed to load data" when overview errors', () => {
    mockOverview.mockReturnValue({ data: null, isLoading: false, isError: true })
    render(<DosDashboard />)
    expect(screen.getByText(/failed to load data/i)).toBeInTheDocument()
  })

  it('Overview tab shows Subject Rankings table header when data is loaded', () => {
    setupMocks()
    render(<DosDashboard />)
    expect(screen.getByText('Subject Rankings')).toBeInTheDocument()
  })

  it('clicking Class Performance tab shows class selector', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<DosDashboard />)

    await user.click(screen.getByRole('tab', { name: /class performance/i }))

    await waitFor(() => {
      expect(screen.getByText(/select class/i)).toBeInTheDocument()
    })
  })

  it('Class Performance tab shows "Select a class" prompt when no class chosen', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<DosDashboard />)

    await user.click(screen.getByRole('tab', { name: /class performance/i }))

    await waitFor(() => {
      expect(screen.getByText(/select a class to view performance/i)).toBeInTheDocument()
    })
  })

  // StudentDetailModal was a non-functional stub (just showed a raw student
  // ID) while DosStudentsPage already navigated to a fully-wired profile
  // route — clicking a top/bottom performer now navigates there too, instead
  // of opening the stub.
  it('clicking a Top 5 student navigates to the student profile route instead of opening a stub modal', async () => {
    setupMocks()
    mockClasses.mockReturnValue({ data: [{ id: 'c1', name: 'S.1', level: '1' }], isLoading: false })
    mockClassPerf.mockReturnValue({
      data: {
        subjectBreakdown: [],
        topStudents:    [{ studentId: 'stu-1', name: 'Grace Apio', average: 92 }],
        bottomStudents: [],
      },
      isLoading: false,
    })

    const user = userEvent.setup()
    render(<DosDashboard />)
    await user.click(screen.getByRole('tab', { name: /class performance/i }))

    const classSelect = await screen.findByRole('combobox')
    await user.selectOptions(classSelect, 'c1')

    await waitFor(() => expect(screen.getByText('Grace Apio')).toBeInTheDocument())
    await user.click(screen.getByText('Grace Apio'))

    expect(mockNavigate).toHaveBeenCalledWith('/dos/students/stu-1')
    expect(screen.queryByText(/academic profile/i)).not.toBeInTheDocument()
  })

  // subjectName is a string field — the sort comparator used to do
  // `av - bv` regardless of field type, which is NaN for two strings.
  // Array.sort() treats NaN as "equal", so clicking the "Subject" column
  // header silently did nothing instead of alphabetizing.
  it('sorting the Subject column by text actually reorders rows', async () => {
    setupMocks({
      overviewData: {
        ...OVERVIEW_DATA,
        subjectRankings: [
          { subjectName: 'Physics', classAverage: 60, passRate: 70, highest: 90, lowest: 20 },
          { subjectName: 'Biology', classAverage: 65, passRate: 75, highest: 88, lowest: 30 },
        ],
      },
    })
    const user = userEvent.setup()
    render(<DosDashboard />)

    const rowsInOrder = () => screen.getAllByRole('row').slice(1).map(r => r.textContent)

    // Initial sort is classAverage desc — Biology (65) ranks above Physics (60).
    await waitFor(() => expect(rowsInOrder()[0]).toContain('Biology'))

    // First click on a new field defaults to desc — subjectName desc puts
    // "Physics" (P > B) first. Before the fix this comparator returned NaN
    // for every pair, so the row order never changed at all.
    await user.click(screen.getByText('Subject'))
    await waitFor(() => expect(rowsInOrder()[0]).toContain('Physics'))
  })

  it('clicking Teacher Performance tab shows teacher table headers', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<DosDashboard />)

    await user.click(screen.getByRole('tab', { name: /teacher performance/i }))

    await waitFor(() => {
      expect(screen.getByText('Teacher')).toBeInTheDocument()
      expect(screen.getByText('Pass Rate')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
  })

  it('clicking Curriculum Plan tab shows class and subject selectors', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<DosDashboard />)

    await user.click(screen.getByRole('tab', { name: /curriculum plan/i }))

    await waitFor(() => {
      expect(screen.getByText(/select a class and subject/i)).toBeInTheDocument()
    })
  })
})
