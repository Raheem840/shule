import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

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
vi.mock('../../hooks/useDeputy', () => ({
  useDeputyKpis:      vi.fn(),
  useRecentDiscipline: vi.fn(),
  useDeputyOverview:  vi.fn(),
}))

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}))

// ── Shared component stubs ─────────────────────────────────────────────────────
vi.mock('../../components/shared/TermProgressTimeline', () => ({
  SafeTermProgressTimeline: () => <div data-testid="term-timeline" />,
}))

import { useDeputyKpis, useRecentDiscipline, useDeputyOverview } from '../../hooks/useDeputy'
import { DeputyDashboard } from '../../pages/deputy/DeputyDashboard'

const mockKpis     = useDeputyKpis      as ReturnType<typeof vi.fn>
const mockRecent   = useRecentDiscipline as ReturnType<typeof vi.fn>
const mockOverview = useDeputyOverview  as ReturnType<typeof vi.fn>

function setupMocks(kpiData: any = null) {
  mockKpis.mockReturnValue({ data: kpiData, isLoading: false })
  mockRecent.mockReturnValue({ data: [], isLoading: false })
  mockOverview.mockReturnValue({ data: [], isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('DeputyDashboard', () => {
  it('renders the Deputy Principal hero heading', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getByText(/deputy principal/i)).toBeInTheDocument()
  })

  it('renders all four KPI card labels', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getAllByText(/discipline incidents/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/below threshold/i)).toBeInTheDocument()
    expect(screen.getByText(/class teachers/i)).toBeInTheDocument()
    expect(screen.getByText(/timetable gaps/i)).toBeInTheDocument()
  })

  it('shows "—" placeholder while KPI data is loading', () => {
    mockKpis.mockReturnValue({ data: null, isLoading: true })
    mockRecent.mockReturnValue({ data: [], isLoading: false })
    mockOverview.mockReturnValue({ data: [], isLoading: false })
    render(<DeputyDashboard />)
    // Placeholders render as "—" when loading=true
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('shows KPI values when data is loaded', () => {
    setupMocks({ disciplineIncidents: 7, studentsBelowThreshold: 3, activeClassTeachers: 12 })
    render(<DeputyDashboard />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders the Recent Incidents panel', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getByText(/recent incidents/i)).toBeInTheDocument()
  })

  it('renders the Attendance Alerts panel', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getByText(/attendance alerts/i)).toBeInTheDocument()
  })

  it('shows "All clear" when no discipline records exist', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getByText(/all clear/i)).toBeInTheDocument()
  })

  it('shows "No discipline incidents recorded" sub-text in empty state', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getByText(/no discipline incidents recorded/i)).toBeInTheDocument()
  })

  it('renders discipline records when data provided', () => {
    mockKpis.mockReturnValue({ data: { disciplineIncidents: 1, studentsBelowThreshold: 0, activeClassTeachers: 5 }, isLoading: false })
    mockRecent.mockReturnValue({
      isLoading: false,
      data: [{
        id: 'dr1',
        studentName: 'Alice Nalwoga',
        nature: 'lateness' as const,
        incidentDate: '2026-06-01',
        classId: 'c1',
        resolution: 'Warned',
      }],
    })
    mockOverview.mockReturnValue({ data: [], isLoading: false })
    render(<DeputyDashboard />)
    expect(screen.getByText('Alice Nalwoga')).toBeInTheDocument()
  })

  it('shows "No attendance data" when overview is empty', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getByText(/no attendance data/i)).toBeInTheDocument()
  })

  it('shows "All classes on track" when all are above threshold', () => {
    setupMocks()
    mockOverview.mockReturnValue({
      isLoading: false,
      data: [{ classId: 'c1', className: 'S.1', level: '1', attendanceRate: 90, isBelowThreshold: false }],
    })
    render(<DeputyDashboard />)
    expect(screen.getByText(/all classes on track/i)).toBeInTheDocument()
  })

  it('renders the term timeline placeholder', () => {
    setupMocks()
    render(<DeputyDashboard />)
    expect(screen.getByTestId('term-timeline')).toBeInTheDocument()
  })

  it('does NOT render any fee or finance data', () => {
    setupMocks({ disciplineIncidents: 5, studentsBelowThreshold: 2, activeClassTeachers: 8 })
    render(<DeputyDashboard />)
    expect(screen.queryByText(/ugx/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fee/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/payment/i)).not.toBeInTheDocument()
  })
})
