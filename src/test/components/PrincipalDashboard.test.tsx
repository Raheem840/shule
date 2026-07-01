import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

// ── Recharts stub ──────────────────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart:            ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar:                 () => null,
  XAxis:               () => null,
  YAxis:               () => null,
  CartesianGrid:       () => null,
  Tooltip:             () => null,
}))

// ── TermProgressTimeline stub ──────────────────────────────────────────────
vi.mock('../../components/shared/TermProgressTimeline', () => ({
  SafeTermProgressTimeline: () => <div data-testid="term-progress" />,
  TermProgressTimeline:     () => <div />,
}))

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

// ── Bandwidth stub ─────────────────────────────────────────────────────────
vi.mock('../../store/BandwidthContext', () => ({
  useBandwidth: () => ({ isLowBandwidth: false }),
  BandwidthProvider: ({ children }: any) => children,
}))

// ── Hook mocks ─────────────────────────────────────────────────────────────
vi.mock('../../hooks/usePrincipal', () => ({
  usePrincipalKpis:    vi.fn(),
  useTopClasses:       vi.fn(),
  useSchoolFeeSummary: vi.fn(),
  useAuditLog:         vi.fn(),
}))

vi.mock('../../hooks/useDeputy', () => ({
  useDisciplineRecords: vi.fn(),
}))

import {
  usePrincipalKpis, useTopClasses, useSchoolFeeSummary, useAuditLog,
} from '../../hooks/usePrincipal'
import { useDisciplineRecords } from '../../hooks/useDeputy'
import { PrincipalDashboard } from '../../pages/principal/PrincipalDashboard'

const mockKpis       = usePrincipalKpis    as ReturnType<typeof vi.fn>
const mockTopClasses = useTopClasses       as ReturnType<typeof vi.fn>
const mockFeeSummary = useSchoolFeeSummary as ReturnType<typeof vi.fn>
const mockAuditLog   = useAuditLog         as ReturnType<typeof vi.fn>
const mockDiscipline = useDisciplineRecords as ReturnType<typeof vi.fn>

const KPI_DATA = {
  totalStudents:          320,
  totalStaff:             45,
  overallPassRate:        74,
  feeCollectionRate:      82,
  attendanceRateThisWeek: 88,
  pendingReportCards:     5,
}

function setupMocks(kpiData: any = null, kpiLoading = false) {
  mockKpis.mockReturnValue({ data: kpiData, isLoading: kpiLoading, isError: false })
  mockTopClasses.mockReturnValue({ data: [], isLoading: false, isError: false })
  mockFeeSummary.mockReturnValue({ data: null, isLoading: false })
  mockAuditLog.mockReturnValue({ data: [], isLoading: false })
  mockDiscipline.mockReturnValue({ data: [], isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('PrincipalDashboard', () => {
  it('renders the School Overview heading', () => {
    setupMocks()
    render(<PrincipalDashboard />)
    expect(screen.getByText(/school overview/i)).toBeInTheDocument()
  })

  it('renders the TermProgressTimeline', () => {
    setupMocks()
    render(<PrincipalDashboard />)
    expect(screen.getByTestId('term-progress')).toBeInTheDocument()
  })

  it('shows loading skeletons while KPI data is loading', () => {
    setupMocks(null, true)
    render(<PrincipalDashboard />)
    // When loading, KPI cards render as skeleton blocks — heading still visible
    expect(screen.getByText(/school overview/i)).toBeInTheDocument()
    // No KPI label text visible while loading
    expect(screen.queryByText(/total students/i)).not.toBeInTheDocument()
  })

  it('renders KPI cards with data', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getByText(/total students/i)).toBeInTheDocument()
    expect(screen.getByText(/total staff/i)).toBeInTheDocument()
    expect(screen.getAllByText(/pass rate/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/fee collection/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/attendance/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/pending approvals/i).length).toBeGreaterThan(0)
  })

  it('shows numeric KPI values with data', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getAllByText('320').length).toBeGreaterThan(0)
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('74%')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('renders quick action buttons', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getByText(/approve report cards/i)).toBeInTheDocument()
    expect(screen.getByText(/view audit log/i)).toBeInTheDocument()
    expect(screen.getByText(/send announcement/i)).toBeInTheDocument()
    expect(screen.getByText(/fee summary/i)).toBeInTheDocument()
  })

  it('shows fee collection summary section heading', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getByText(/fee collection summary/i)).toBeInTheDocument()
  })

  it('renders fee overview rows when fee data is available', () => {
    mockKpis.mockReturnValue({ data: KPI_DATA, isLoading: false, isError: false })
    mockTopClasses.mockReturnValue({ data: [], isLoading: false, isError: false })
    mockFeeSummary.mockReturnValue({
      data: {
        totalExpected:  5_000_000,
        totalCollected: 4_000_000,
        outstanding:    1_000_000,
        overdueCount:   8,
      },
      isLoading: false,
    })
    mockAuditLog.mockReturnValue({ data: [], isLoading: false })
    mockDiscipline.mockReturnValue({ data: [], isLoading: false })

    render(<PrincipalDashboard />)
    expect(screen.getByText('Total Expected')).toBeInTheDocument()
    expect(screen.getByText('Total Collected')).toBeInTheDocument()
    expect(screen.getByText('Outstanding')).toBeInTheDocument()
  })

  it('renders "No class performance data yet" when top classes is empty', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getByText(/no class performance data yet/i)).toBeInTheDocument()
  })

  it('renders "Recent Audit Log" panel heading', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getByText('Recent Audit Log')).toBeInTheDocument()
  })

  it('shows "No audit entries yet" when audit log is empty', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getByText(/no audit entries yet/i)).toBeInTheDocument()
  })

  it('shows "No discipline records" when discipline list is empty', () => {
    setupMocks(KPI_DATA)
    render(<PrincipalDashboard />)
    expect(screen.getByText(/no discipline records/i)).toBeInTheDocument()
  })

  it('shows audit log entry when data is provided', () => {
    mockKpis.mockReturnValue({ data: KPI_DATA, isLoading: false, isError: false })
    mockTopClasses.mockReturnValue({ data: [], isLoading: false, isError: false })
    mockFeeSummary.mockReturnValue({ data: null, isLoading: false })
    mockDiscipline.mockReturnValue({ data: [], isLoading: false })
    mockAuditLog.mockReturnValue({
      data: [{
        id: 'a1', action: 'INSERT', tableName: 'students',
        entityName: 'Grace Apio', userRole: 'secretary',
        createdAt: '2026-06-30T08:00:00Z',
        oldData: null, newData: null,
      }],
      isLoading: false,
    })

    render(<PrincipalDashboard />)
    expect(screen.getByText('Added')).toBeInTheDocument()
    expect(screen.getByText(/Grace Apio/)).toBeInTheDocument()
  })

  it('shows error message when KPIs fail to load', () => {
    mockKpis.mockReturnValue({ data: null, isLoading: false, isError: true })
    mockTopClasses.mockReturnValue({ data: [], isLoading: false, isError: false })
    mockFeeSummary.mockReturnValue({ data: null, isLoading: false })
    mockAuditLog.mockReturnValue({ data: [], isLoading: false })
    mockDiscipline.mockReturnValue({ data: [], isLoading: false })

    render(<PrincipalDashboard />)
    expect(screen.getByText(/could not load kpis/i)).toBeInTheDocument()
  })
})
