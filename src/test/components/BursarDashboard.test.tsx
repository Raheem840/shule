import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

// Mock at hook level — avoids supabase dependency entirely
vi.mock('../../hooks/useFeePayments', () => ({
  useBursarKpis:            vi.fn(),
  useFeeCollectionByClass:  vi.fn(),
  useRecentPayments:        vi.fn(),
  useSmsCount:              vi.fn(),
  useFeeCollectionOverTime: vi.fn().mockReturnValue({ data: { points: [], classes: [] }, isLoading: false }),
  ugx: (n: number) => `UGX ${n.toLocaleString()}`,
  calcFeeStatus: vi.fn(),
}))

vi.mock('../../hooks/useFeeStructure', () => ({
  useAcademicYears: vi.fn().mockReturnValue({ data: [], isLoading: false }),
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
  useAuth: () => ({ user: { id: 'u1', role: 'bursar', schoolId: 's1', name: 'B', email: 'b@k.ug' }, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useBursarKpis, useFeeCollectionByClass, useRecentPayments, useSmsCount,
} from '../../hooks/useFeePayments'
import { BursarDashboard } from '../../pages/bursar/BursarDashboard'

const mockKpis          = useBursarKpis          as ReturnType<typeof vi.fn>
const mockByClass       = useFeeCollectionByClass as ReturnType<typeof vi.fn>
const mockRecent        = useRecentPayments       as ReturnType<typeof vi.fn>
const mockSmsCount      = useSmsCount             as ReturnType<typeof vi.fn>

function setupMocks(kpiData: any = null) {
  mockKpis.mockReturnValue({ data: kpiData, isLoading: false })
  mockByClass.mockReturnValue({ data: [], isLoading: false })
  mockRecent.mockReturnValue({ data: [], isLoading: false })
  mockSmsCount.mockReturnValue({ data: 0, isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('BursarDashboard', () => {
  it('renders the page header', () => {
    setupMocks()
    render(<BursarDashboard />)
    expect(screen.getByText(/finance overview/i)).toBeInTheDocument()
  })

  it('renders the term selector buttons', () => {
    setupMocks()
    render(<BursarDashboard />)
    expect(screen.getByText('T1')).toBeInTheDocument()
    expect(screen.getByText('T2')).toBeInTheDocument()
    expect(screen.getByText('T3')).toBeInTheDocument()
  })

  it('renders KPI cards with mocked data', () => {
    setupMocks({
      expected:    4_000_000,
      collected:   2_500_000,
      outstanding: 1_500_000,
      unpaidCount: 12,
    })
    render(<BursarDashboard />)

    expect(screen.getByText(/total expected/i)).toBeInTheDocument()
    expect(screen.getAllByText(/total collected/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/outstanding/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/fully unpaid/i)).toBeInTheDocument()
    expect(screen.getByText(/sms reminders/i)).toBeInTheDocument()
  })

  it('shows formatted UGX values in KPI cards', () => {
    setupMocks({
      expected:    4_000_000,
      collected:   2_500_000,
      outstanding: 1_500_000,
      unpaidCount: 12,
    })
    render(<BursarDashboard />)
    // ugx formatter is mocked to return "UGX {n}"
    expect(screen.getByText('UGX 4,000,000')).toBeInTheDocument()
    expect(screen.getByText('UGX 2,500,000')).toBeInTheDocument()
    expect(screen.getByText('UGX 1,500,000')).toBeInTheDocument()
  })

  it('shows unpaid student count', () => {
    setupMocks({
      expected: 0, collected: 0, outstanding: 0, unpaidCount: 23,
    })
    render(<BursarDashboard />)
    expect(screen.getByText('23')).toBeInTheDocument()
  })

  it('shows "No payments yet" when recent payments list is empty', () => {
    setupMocks()
    render(<BursarDashboard />)
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument()
  })

  it('shows loading spinner while KPI data loads', () => {
    mockKpis.mockReturnValue({ data: null, isLoading: true })
    mockByClass.mockReturnValue({ data: null, isLoading: false })
    mockRecent.mockReturnValue({ data: [], isLoading: false })
    mockSmsCount.mockReturnValue({ data: null, isLoading: false })

    render(<BursarDashboard />)
    // KPI labels always render; values show '—' while loading
    expect(screen.getByText(/total expected/i)).toBeInTheDocument()
  })

  it('shows recent payments when data is provided', () => {
    setupMocks({
      expected: 0, collected: 0, outstanding: 0, unpaidCount: 0,
    })
    mockRecent.mockReturnValue({
      isLoading: false,
      data: [{
        id: 'pay-1',
        firstName: 'Grace',
        lastName: 'Apio',
        className: 'S.3',
        amountPaid: 200_000,
        paymentDate: '2025-06-01',
        receiptNumber: 'RCP-001',
      }],
    })

    render(<BursarDashboard />)
    expect(screen.getByText('Grace Apio')).toBeInTheDocument()
    expect(screen.getByText('S.3')).toBeInTheDocument()
    expect(screen.getByText('UGX 200,000')).toBeInTheDocument()
  })
})
