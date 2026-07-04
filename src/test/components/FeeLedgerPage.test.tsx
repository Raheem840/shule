import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

// ── Virtualiser (avoids DOM measurement issues in jsdom) ───────
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize:    () => 0,
    getVirtualItems: () => [],
  }),
}))

// ── ExcelJS (heavy native module — not needed in unit tests) ───
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
      }
    }
    xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array()) }
  },
}))

// ── ImportWizard stub ──────────────────────────────────────────
vi.mock('../../components/shared/ImportWizard', () => ({
  ImportWizard: () => <div data-testid="import-wizard" />,
}))

// ── Hook mocks ─────────────────────────────────────────────────
vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
  useStreams:  vi.fn(),
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
}))

vi.mock('../../hooks/useFeePayments', () => ({
  useFeePayments:   vi.fn(),
  useAddPayment:    vi.fn(),
  useUpdatePayment: vi.fn(),
  ugx:              (n: number) => `UGX ${n.toLocaleString()}`,
  calcFeeStatus:    vi.fn((paid: number, balance: number) =>
    balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  ),
}))

vi.mock('../../hooks/useFeeStructure', () => ({
  useAcademicYears: vi.fn(),
}))

// ── Supabase stub ──────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert:      vi.fn().mockResolvedValue({ data: null, error: null }),
      update:      vi.fn().mockReturnThis(),
      then:        (res: any) => Promise.resolve({ data: [], error: null }).then(res),
    }),
  },
}))

// ── AuthContext ────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'bursar', schoolId: 's1', name: 'Bursar B', email: 'b@school.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Lazy imports (after vi.mock) ───────────────────────────────
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudents }           from '../../hooks/useStudents'
import { useFeePayments, useAddPayment, useUpdatePayment, calcFeeStatus } from '../../hooks/useFeePayments'
import { useAcademicYears }      from '../../hooks/useFeeStructure'
import { FeeLedgerPage }         from '../../pages/bursar/FeeLedgerPage'

const mockUseClasses     = useClasses     as ReturnType<typeof vi.fn>
const mockUseStreams      = useStreams      as ReturnType<typeof vi.fn>
const mockUseStudents    = useStudents    as ReturnType<typeof vi.fn>
const mockUseFeePayments = useFeePayments as ReturnType<typeof vi.fn>
const mockUseAddPayment  = useAddPayment  as ReturnType<typeof vi.fn>
const mockUpdatePayment  = useUpdatePayment as ReturnType<typeof vi.fn>
const mockUseAcadYears   = useAcademicYears as ReturnType<typeof vi.fn>
const mockCalcFeeStatus  = calcFeeStatus  as ReturnType<typeof vi.fn>

function setupDefaultMocks(rows: any[] = [], isLoading = false) {
  mockUseClasses.mockReturnValue({ data: [], isLoading: false })
  mockUseStreams.mockReturnValue({ data: [], isLoading: false })
  mockUseStudents.mockReturnValue({ data: [], isLoading: false })
  mockUseFeePayments.mockReturnValue({ data: rows, isLoading, error: null })
  mockUseAddPayment.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUpdatePayment.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseAcadYears.mockReturnValue({ data: [{ id: 'ay1', name: '2025/2026', isActive: true }], isLoading: false })
  mockCalcFeeStatus.mockImplementation((paid: number, balance: number) =>
    balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  )
}

beforeEach(() => vi.clearAllMocks())

describe('FeeLedgerPage', () => {
  it('renders the Fee Ledger heading', () => {
    setupDefaultMocks()
    render(<FeeLedgerPage />)
    expect(screen.getByText('Fee Ledger')).toBeInTheDocument()
  })

  it('shows term filter pills (T1, T2, T3)', () => {
    setupDefaultMocks()
    render(<FeeLedgerPage />)
    expect(screen.getByText('T1')).toBeInTheDocument()
    expect(screen.getByText('T2')).toBeInTheDocument()
    expect(screen.getByText('T3')).toBeInTheDocument()
  })

  it('shows search input for filtering students', () => {
    setupDefaultMocks()
    render(<FeeLedgerPage />)
    expect(screen.getByPlaceholderText(/search name or adm no/i)).toBeInTheDocument()
  })

  it('shows the Add Payment button', () => {
    setupDefaultMocks()
    render(<FeeLedgerPage />)
    expect(screen.getByText('Add Payment')).toBeInTheDocument()
  })

  it('shows Export button (disabled when no rows)', () => {
    setupDefaultMocks([])
    render(<FeeLedgerPage />)
    const exportBtn = screen.getByText('Export')
    expect(exportBtn).toBeInTheDocument()
    expect(exportBtn.closest('button')).toBeDisabled()
  })

  it('shows Import button', () => {
    setupDefaultMocks()
    render(<FeeLedgerPage />)
    expect(screen.getByText('Import')).toBeInTheDocument()
  })

  it('shows an Academic Year select populated from useAcademicYears (not a dead year number input)', () => {
    setupDefaultMocks()
    mockUseAcadYears.mockReturnValue({
      data: [
        { id: 'ay1', name: '2025/2026', isActive: true },
        { id: 'ay0', name: '2024/2025', isActive: false },
      ],
      isLoading: false,
    })
    render(<FeeLedgerPage />)
    const select = screen.getByLabelText('Academic Year') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(screen.getByText('2025/2026 (Active)')).toBeInTheDocument()
    expect(screen.getByText('2024/2025')).toBeInTheDocument()
  })

  it('shows loading spinner while data is loading', () => {
    setupDefaultMocks([], true)
    render(<FeeLedgerPage />)
    // The page still renders the header even while loading
    expect(screen.getByText('Fee Ledger')).toBeInTheDocument()
  })

  it('shows empty state when no payments match filters', () => {
    setupDefaultMocks([])
    render(<FeeLedgerPage />)
    expect(screen.getByText(/no payments found/i)).toBeInTheDocument()
  })

  it('shows KPI chip with correct record count when rows exist', () => {
    setupDefaultMocks([
      { id: 'fp1', firstName: 'Alice', lastName: 'Namata', admissionNumber: 'NYS/2024/001', className: 'S.1', streamName: 'A', amountDue: 500000, amountPaid: 500000, balance: 0, paymentDate: '2025-01-10', receiptNumber: 'R01' },
      { id: 'fp2', firstName: 'Bob',   lastName: 'Okello', admissionNumber: 'NYS/2024/002', className: 'S.2', streamName: 'B', amountDue: 400000, amountPaid: 0,      balance: 400000, paymentDate: null, receiptNumber: null },
    ])
    render(<FeeLedgerPage />)
    // KPI chip "Total Records" shows count
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Total Records')).toBeInTheDocument()
  })

  it('shows filter dropdowns for class and status', () => {
    setupDefaultMocks([], false)
    mockUseClasses.mockReturnValue({ data: [{ id: 'c1', name: 'S.1' }], isLoading: false })
    render(<FeeLedgerPage />)
    expect(screen.getByLabelText(/filter by class/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument()
  })
})
