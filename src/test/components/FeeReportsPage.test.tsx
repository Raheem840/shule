import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

// Mock at hook level — avoids supabase dependency entirely
vi.mock('../../hooks/useFeePayments', () => ({
  useBursarKpis:                 vi.fn(),
  useFeeCollectionByClass:       vi.fn(),
  useFeeCollectionOverTime:      vi.fn(),
  useTopDefaulters:              vi.fn(),
  useFeeCollectionByStudentType: vi.fn(),
  ugx: (n: number) => `UGX ${n.toLocaleString()}`,
}))

vi.mock('../../hooks/useFeeStructure', () => ({
  useAcademicYears: vi.fn().mockReturnValue({ data: [{ id: 'ay1', name: '2025/2026', isActive: true }], isLoading: false }),
}))

vi.mock('exceljs', () => ({
  default: class Workbook {
    creator = ''; created = new Date()
    addWorksheet() {
      return {
        mergeCells: vi.fn(),
        getCell:    vi.fn().mockReturnValue({}),
        getRow:     vi.fn().mockReturnValue({ height: 0, eachCell: vi.fn() }),
        addRow:     vi.fn().mockReturnValue({ height: 0, eachCell: vi.fn() }),
        columns:    [],
        rowCount:   1,
      }
    }
    xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array()) }
  },
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
  useBursarKpis, useFeeCollectionByClass, useFeeCollectionOverTime,
  useTopDefaulters, useFeeCollectionByStudentType,
} from '../../hooks/useFeePayments'
import { FeeReportsPage } from '../../pages/bursar/FeeReportsPage'

const mockKpis       = useBursarKpis                 as ReturnType<typeof vi.fn>
const mockByClass     = useFeeCollectionByClass       as ReturnType<typeof vi.fn>
const mockOverTime    = useFeeCollectionOverTime      as ReturnType<typeof vi.fn>
const mockDefaulters  = useTopDefaulters              as ReturnType<typeof vi.fn>
const mockTypeSplit   = useFeeCollectionByStudentType as ReturnType<typeof vi.fn>

function setupMocks(overrides: Partial<{ kpis: any; classes: any[]; defaulters: any[] }> = {}) {
  mockKpis.mockReturnValue({ data: overrides.kpis ?? { expected: 1_000_000, collected: 700_000, outstanding: 300_000, unpaidCount: 2 }, isLoading: false, isError: false })
  mockByClass.mockReturnValue({ data: overrides.classes ?? [], isLoading: false })
  mockOverTime.mockReturnValue({ data: { points: [], classes: [] }, isLoading: false })
  mockDefaulters.mockReturnValue({ data: overrides.defaulters ?? [], isLoading: false })
  mockTypeSplit.mockReturnValue({ data: { day: { collected: 0, outstanding: 0 }, boarder: { collected: 0, outstanding: 0 } }, isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('FeeReportsPage', () => {
  it('renders the page header and Export Report button', () => {
    setupMocks()
    render(<FeeReportsPage />)
    expect(screen.getByText('Fee Reports')).toBeInTheDocument()
    expect(screen.getByText('Export Report')).toBeInTheDocument()
  })

  it('renders KPI chips from useBursarKpis', () => {
    setupMocks()
    render(<FeeReportsPage />)
    expect(screen.getByText('Expected')).toBeInTheDocument()
    expect(screen.getAllByText('Collected').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Outstanding').length).toBeGreaterThan(0)
    expect(screen.getByText('Collection Rate')).toBeInTheDocument()
  })

  it('renders the Boarder vs Day-Scholar Collection section', () => {
    setupMocks()
    render(<FeeReportsPage />)
    expect(screen.getByText('Boarder vs Day-Scholar Collection')).toBeInTheDocument()
    expect(screen.getByText('Boarders')).toBeInTheDocument()
    expect(screen.getByText('Day Scholars')).toBeInTheDocument()
  })

  it('renders a Top Outstanding Balances table with defaulter rows', () => {
    setupMocks({
      defaulters: [{
        studentId: 'stu-1', admissionNumber: 'A1', firstName: 'Grace', lastName: 'Apio',
        className: 'S.1', studentType: 'day', amountDue: 400_000, amountPaid: 100_000, balance: 300_000,
      }],
    })
    render(<FeeReportsPage />)
    expect(screen.getByText('Top Outstanding Balances')).toBeInTheDocument()
    expect(screen.getByText(/Grace Apio/)).toBeInTheDocument()
  })

  it('shows an empty state when there are no outstanding balances', () => {
    setupMocks({ defaulters: [] })
    render(<FeeReportsPage />)
    expect(screen.getByText(/fully collected/i)).toBeInTheDocument()
  })

  it('renders the Collection Trend section', () => {
    setupMocks()
    render(<FeeReportsPage />)
    expect(screen.getByText('Collection Trend This Term')).toBeInTheDocument()
  })

  it('renders the per-class table', () => {
    setupMocks({ classes: [{ className: 'S.1', collected: 200_000, outstanding: 50_000 }] })
    render(<FeeReportsPage />)
    expect(screen.getByText('Collection by Class')).toBeInTheDocument()
  })
})
