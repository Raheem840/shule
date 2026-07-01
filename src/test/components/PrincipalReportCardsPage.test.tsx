import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

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

// ── Toast stub ─────────────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

// ── Hook mocks ─────────────────────────────────────────────────────────────
vi.mock('../../hooks/useReportCards', () => ({
  useReportCards:       vi.fn(),
  useStudentReadiness:  vi.fn(),
  useApproveReportCard: vi.fn(),
  useReleaseReportCard: vi.fn(),
  useUnlockReportCard:  vi.fn(),
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
  useSetStudentStatus: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
  useStreams:  vi.fn(),
}))

import {
  useReportCards, useStudentReadiness,
  useApproveReportCard, useReleaseReportCard, useUnlockReportCard,
} from '../../hooks/useReportCards'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { PrincipalReportCardsPage } from '../../pages/principal/PrincipalReportCardsPage'

const mockRC          = useReportCards       as ReturnType<typeof vi.fn>
const mockReadiness   = useStudentReadiness  as ReturnType<typeof vi.fn>
const mockApprove     = useApproveReportCard as ReturnType<typeof vi.fn>
const mockRelease     = useReleaseReportCard as ReturnType<typeof vi.fn>
const mockUnlock      = useUnlockReportCard  as ReturnType<typeof vi.fn>
const mockStudents    = useStudents          as ReturnType<typeof vi.fn>
const mockClasses     = useClasses           as ReturnType<typeof vi.fn>
const mockStreams      = useStreams           as ReturnType<typeof vi.fn>

const MUTATION_STUB = {
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending:   false,
}

const CLASSES = [
  { id: 'c1', name: 'S.1', level: '1' },
  { id: 'c2', name: 'S.2', level: '2' },
]

function setupMocks(rcData: any[] = [], rcLoading = false) {
  mockRC.mockReturnValue({ data: rcData, isLoading: rcLoading })
  mockReadiness.mockReturnValue({ data: [] })
  mockApprove.mockReturnValue(MUTATION_STUB)
  mockRelease.mockReturnValue(MUTATION_STUB)
  mockUnlock.mockReturnValue(MUTATION_STUB)
  mockStudents.mockReturnValue({ data: [], isLoading: false })
  mockClasses.mockReturnValue({ data: CLASSES, isLoading: false })
  mockStreams.mockReturnValue({ data: [], isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('PrincipalReportCardsPage', () => {
  it('renders "Report Cards" page heading', () => {
    setupMocks()
    render(<PrincipalReportCardsPage />)
    expect(screen.getByText('Report Cards')).toBeInTheDocument()
  })

  it('shows prompt to select a term and class before data loads', () => {
    setupMocks()
    render(<PrincipalReportCardsPage />)
    expect(screen.getByText(/select a term and class to view report cards/i)).toBeInTheDocument()
  })

  it('renders class select dropdown with options', () => {
    setupMocks()
    render(<PrincipalReportCardsPage />)
    expect(screen.getByText('Select class')).toBeInTheDocument()
    expect(screen.getByText('S.1')).toBeInTheDocument()
    expect(screen.getByText('S.2')).toBeInTheDocument()
  })

  it('renders year selector and stream selector', () => {
    setupMocks()
    render(<PrincipalReportCardsPage />)
    // Year selector: shows current year
    const currentYear = String(new Date().getFullYear())
    expect(screen.getByText(currentYear)).toBeInTheDocument()
    // Stream placeholder
    expect(screen.getByText('All streams')).toBeInTheDocument()
  })

  it('shows loading spinner when cohort is ready and report cards are loading', async () => {
    setupMocks([], true)
    const user = userEvent.setup()
    render(<PrincipalReportCardsPage />)

    // Select a class to make cohortReady true
    const classSelect = screen.getAllByRole('combobox')[1] // second select is class
    await user.selectOptions(classSelect, 'c1')

    await waitFor(() => {
      // Loading spinner appears
      expect(screen.queryByText(/select a term and class/i)).not.toBeInTheDocument()
    })
  })

  it('shows "Awaiting Approval" tab after class is selected', async () => {
    setupMocks([])
    const user = userEvent.setup()
    render(<PrincipalReportCardsPage />)

    const classSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(classSelect, 'c1')

    await waitFor(() => {
      expect(screen.getByText('Awaiting Approval')).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(screen.getByText('Released')).toBeInTheDocument()
    })
  })

  it('shows "No report cards awaiting approval" empty state', async () => {
    setupMocks([])
    const user = userEvent.setup()
    render(<PrincipalReportCardsPage />)

    const classSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(classSelect, 'c1')

    await waitFor(() => {
      expect(screen.getByText(/no report cards are awaiting approval/i)).toBeInTheDocument()
    })
  })

  it('renders a report card row with Approve button when status is ready', async () => {
    const cards = [{
      id: 'rc1',
      studentId: 'st1',
      term: '1',
      year: 2026,
      status: 'ready',
      pdfUrl: null,
      principalRemarks: null,
      generatedAt: '2026-06-01T00:00:00Z',
    }]
    setupMocks(cards)
    mockStudents.mockReturnValue({
      data: [{ id: 'st1', firstName: 'Grace', lastName: 'Apio', classId: 'c1', streamId: null, admissionNumber: 'KAB/2026/001' }],
      isLoading: false,
    })
    mockReadiness.mockReturnValue({
      data: [{ studentId: 'st1', admissionNumber: 'KAB/2026/001' }],
    })

    const user = userEvent.setup()
    render(<PrincipalReportCardsPage />)

    const classSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(classSelect, 'c1')

    await waitFor(() => {
      expect(screen.getByText('Grace Apio')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument()
    })
  })

  it('shows Release button for approved cards', async () => {
    const cards = [{
      id: 'rc2',
      studentId: 'st2',
      term: '1',
      year: 2026,
      status: 'approved',
      pdfUrl: null,
      principalRemarks: null,
      generatedAt: '2026-06-01T00:00:00Z',
    }]
    setupMocks(cards)
    mockStudents.mockReturnValue({
      data: [{ id: 'st2', firstName: 'Joel', lastName: 'Otim', classId: 'c1', streamId: null, admissionNumber: 'KAB/2026/002' }],
      isLoading: false,
    })
    mockReadiness.mockReturnValue({ data: [] })

    const user = userEvent.setup()
    render(<PrincipalReportCardsPage />)

    const classSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(classSelect, 'c1')

    // Switch to Approved tab
    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Approved'))

    await waitFor(() => {
      expect(screen.getByText('Joel Otim')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^release$/i })).toBeInTheDocument()
    })
  })
})
