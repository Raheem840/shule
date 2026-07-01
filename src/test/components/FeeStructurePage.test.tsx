import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

// ── Hook mocks ─────────────────────────────────────────────────
vi.mock('../../hooks/useFeeStructure', () => ({
  useFeeStructure:    vi.fn(),
  useAcademicYears:   vi.fn(),
  useAddFeeType:      vi.fn(),
  useUpdateFeeAmount: vi.fn(),
  useUpdateFeeItem:   vi.fn(),
  useToggleFeeActive: vi.fn(),
  useDeleteFeeType:   vi.fn(),
  useAutoChargeFees:  vi.fn(),
  useUnchargedCounts: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
}))

vi.mock('../../hooks/useFeePayments', () => ({
  ugx: (n: number) => `UGX ${n.toLocaleString()}`,
}))

// ── Toast stub ─────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
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
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      insert:  vi.fn().mockResolvedValue({ data: null, error: null }),
      update:  vi.fn().mockReturnThis(),
      then:    (res: any) => Promise.resolve({ data: [], error: null }).then(res),
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

import {
  useFeeStructure, useAcademicYears, useAddFeeType,
  useUpdateFeeAmount, useUpdateFeeItem, useToggleFeeActive,
  useDeleteFeeType, useAutoChargeFees, useUnchargedCounts,
} from '../../hooks/useFeeStructure'
import { useClasses } from '../../hooks/useClasses'
import { FeeStructurePage } from '../../pages/bursar/FeeStructurePage'

const mockUseFeeStructure  = useFeeStructure  as ReturnType<typeof vi.fn>
const mockUseAcadYears     = useAcademicYears as ReturnType<typeof vi.fn>
const mockUseAddFeeType    = useAddFeeType    as ReturnType<typeof vi.fn>
const mockUpdateFeeAmount  = useUpdateFeeAmount as ReturnType<typeof vi.fn>
const mockUpdateFeeItem    = useUpdateFeeItem as ReturnType<typeof vi.fn>
const mockToggleFeeActive  = useToggleFeeActive as ReturnType<typeof vi.fn>
const mockDeleteFeeType    = useDeleteFeeType as ReturnType<typeof vi.fn>
const mockAutoChargeFees   = useAutoChargeFees as ReturnType<typeof vi.fn>
const mockUnchargedCounts  = useUnchargedCounts as ReturnType<typeof vi.fn>
const mockUseClasses       = useClasses as ReturnType<typeof vi.fn>

const FEE_ITEMS = [
  {
    id: 'fi1', name: 'School Fees S.1', amount: 750_000,
    appliesTo: 'all', term: 1, academicYearId: 'ay1',
    classId: null, isCompulsory: true, isActive: true,
  },
  {
    id: 'fi2', name: 'Boarding Fees', amount: 600_000,
    appliesTo: 'boarders', term: 1, academicYearId: 'ay1',
    classId: null, isCompulsory: true, isActive: true,
  },
]

const ACTIVE_YEAR = { id: 'ay1', name: '2025/2026', isActive: true, startDate: '2025-01-01' }

function setupMocks(fees: any[] = [], isLoading = false) {
  mockUseFeeStructure.mockReturnValue({ data: fees, isLoading })
  mockUseAcadYears.mockReturnValue({ data: [ACTIVE_YEAR], isLoading: false })
  mockUseClasses.mockReturnValue({ data: [], isLoading: false })
  mockUseAddFeeType.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue('fi3'), isPending: false })
  mockUpdateFeeAmount.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUpdateFeeItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockToggleFeeActive.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockDeleteFeeType.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockAutoChargeFees.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ charged: 0 }), isPending: false })
  mockUnchargedCounts.mockReturnValue({ data: {}, isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('FeeStructurePage', () => {
  it('renders the Fee Structure heading', () => {
    setupMocks()
    render(<FeeStructurePage />)
    expect(screen.getByText('Fee Structure')).toBeInTheDocument()
  })

  it('shows "Add Fee Item" button', () => {
    setupMocks()
    render(<FeeStructurePage />)
    expect(screen.getByText('Add Fee Item')).toBeInTheDocument()
  })

  it('shows "Import CSV" button', () => {
    setupMocks()
    render(<FeeStructurePage />)
    expect(screen.getByText('Import CSV')).toBeInTheDocument()
  })

  it('shows the active academic year in the subheading', () => {
    setupMocks()
    render(<FeeStructurePage />)
    expect(screen.getByText(/2025\/2026/)).toBeInTheDocument()
  })

  it('shows loading skeleton when data is loading', () => {
    setupMocks([], true)
    render(<FeeStructurePage />)
    // Skeletons render — Add Fee button still visible in hero
    expect(screen.getByText('Add Fee Item')).toBeInTheDocument()
    // Empty state should NOT show while loading
    expect(screen.queryByText(/no fee items yet/i)).not.toBeInTheDocument()
  })

  it('shows empty state when no fee items exist', () => {
    setupMocks([])
    render(<FeeStructurePage />)
    expect(screen.getByText(/no fee items yet/i)).toBeInTheDocument()
    expect(screen.getByText(/add fee items to define what students are charged/i)).toBeInTheDocument()
  })

  it('shows "+ Add First Fee" button in empty state', () => {
    setupMocks([])
    render(<FeeStructurePage />)
    expect(screen.getByText('+ Add First Fee')).toBeInTheDocument()
  })

  it('renders fee card names when fee items exist', () => {
    setupMocks(FEE_ITEMS)
    render(<FeeStructurePage />)
    expect(screen.getByText('School Fees S.1')).toBeInTheDocument()
    expect(screen.getByText('Boarding Fees')).toBeInTheDocument()
  })

  it('shows COMPULSORY badges on compulsory fees', () => {
    setupMocks(FEE_ITEMS)
    render(<FeeStructurePage />)
    const compBadges = screen.getAllByText('COMPULSORY')
    expect(compBadges.length).toBeGreaterThan(0)
  })

  it('shows KPI chip "Active Fees" with correct count', () => {
    setupMocks(FEE_ITEMS)
    render(<FeeStructurePage />)
    expect(screen.getByText('Active Fees')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('shows Term 1 section heading when fee items exist', () => {
    setupMocks(FEE_ITEMS)
    render(<FeeStructurePage />)
    // Both items are Term 1 — "Term 1" section label should appear
    expect(screen.getAllByText(/term\s*1/i).length).toBeGreaterThan(0)
  })

  it('shows filter dropdowns for Term and Class', () => {
    setupMocks()
    render(<FeeStructurePage />)
    expect(screen.getByText('All Terms')).toBeInTheDocument()
    expect(screen.getByText('All Classes')).toBeInTheDocument()
  })

  it('does NOT show uncharged-students banner when all students are billed', () => {
    setupMocks(FEE_ITEMS)
    render(<FeeStructurePage />)
    // totalUncharged = 0 → banner hidden
    expect(screen.queryByText(/not yet billed/i)).not.toBeInTheDocument()
  })

  it('shows uncharged-students banner when some students are unbilled', () => {
    setupMocks(FEE_ITEMS)
    mockUnchargedCounts.mockReturnValue({ data: { fi1: 5, fi2: 3 }, isLoading: false })
    render(<FeeStructurePage />)
    expect(screen.getByText(/8 students not yet billed/i)).toBeInTheDocument()
    expect(screen.getByText('Bill All Now')).toBeInTheDocument()
  })
})
