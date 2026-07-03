import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'

// ── ExcelJS stub ───────────────────────────────────────────────
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

// ── Avatar stub (avoids signed-URL logic in tests) ────────────
vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <span data-testid="staff-avatar">{name}</span>,
}))

// ── ROLE_LABEL stub ───────────────────────────────────────────
vi.mock('../../config/roleNav', () => ({
  ROLE_LABEL: {
    teacher: 'Teacher', principal: 'Principal', bursar: 'Bursar',
    dos: 'DoS', secretary: 'Secretary', class_teacher: 'Class Teacher',
    deputy: 'Deputy Principal', student: 'Student', parent: 'Parent',
  },
}))

// ── Toast stub ─────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
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

// ── Supabase chainable stub ───────────────────────────────────
// SalaryPage uses inline hooks backed by useQuery/supabase directly.
// We control the response via mockOrderFn set in beforeEach.
const mockOrderFn = vi.hoisted(() => vi.fn())

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
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      order:  mockOrderFn,
    }),
  },
}))

import { SalaryPage } from '../../pages/bursar/SalaryPage'

const STAFF_DATA = [
  { id: 'st1', first_name: 'Grace', last_name: 'Apio',   role: 'teacher',    employment_type: 'full_time', join_date: '2020-01-10', photo_url: null, salary_band: 'Band A' },
  { id: 'st2', first_name: 'John',  last_name: 'Ochieng', role: 'principal', employment_type: 'contract',  join_date: '2019-05-01', photo_url: null, salary_band: 'Band S' },
]

beforeEach(() => {
  vi.clearAllMocks()
  // Default: return staff data
  mockOrderFn.mockResolvedValue({ data: STAFF_DATA, error: null })
})

describe('SalaryPage', () => {
  it('renders the Salary Records heading', async () => {
    render(<SalaryPage />)
    await waitFor(() => expect(screen.getByText('Salary Records')).toBeInTheDocument())
  })

  it('shows Export Excel button', async () => {
    render(<SalaryPage />)
    await waitFor(() => expect(screen.getByText('Export Excel')).toBeInTheDocument())
  })

  it('shows staff name rows after data loads', async () => {
    render(<SalaryPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Grace Apio').length).toBeGreaterThan(0)
      expect(screen.getAllByText('John Ochieng').length).toBeGreaterThan(0)
    })
  })

  it('shows role badges for staff members', async () => {
    render(<SalaryPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Teacher').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Principal').length).toBeGreaterThan(0)
    })
  })

  it('shows employment type badges, formatting snake_case as Title Case', async () => {
    render(<SalaryPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Full Time').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Contract').length).toBeGreaterThan(0)
    })
  })

  it('shows filter dropdowns for role and employment type', async () => {
    render(<SalaryPage />)
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows empty state when no staff match filters', async () => {
    mockOrderFn.mockResolvedValue({ data: [], error: null })
    render(<SalaryPage />)
    await waitFor(() =>
      expect(screen.getByText(/no staff found/i)).toBeInTheDocument()
    )
  })

  it('shows staff count text', async () => {
    render(<SalaryPage />)
    await waitFor(() =>
      expect(screen.getByText(/2 staff member/i)).toBeInTheDocument()
    )
  })
})
