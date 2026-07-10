import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'
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
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      like:        vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({ data: { short_name: 'NYS' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert:      vi.fn().mockResolvedValue({ data: null, error: null }),
      update:      vi.fn().mockReturnThis(),
      then:        (resolve: any) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
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

// ── ImportWizard: stub to keep tests simple & isolated ─────────
vi.mock('../../components/shared/ImportWizard', () => ({
  ImportWizard: ({ context }: { context: string }) => (
    <div data-testid="import-wizard">ImportWizard:{context}</div>
  ),
}))

// ── Template download: no-op ───────────────────────────────────
vi.mock('../../lib/importTemplates', () => ({
  generateImportTemplate: vi.fn(),
}))

// ── Validators: pass-through ───────────────────────────────────
vi.mock('../../lib/validators', () => ({
  validateStudentRow: vi.fn().mockReturnValue(null),
  validateStaffRow:   vi.fn().mockReturnValue(null),
  capitalizeName:     (s: string) => s,
  normalizeEmail:     (s: string) => s,
  normalizePhone:     (s: string) => ({ normalized: s, warning: null }),
}))

import { generateImportTemplate } from '../../lib/importTemplates'
import { ImportDataPage } from '../../pages/secretary/ImportDataPage'

const mockGenerateTemplate = generateImportTemplate as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('ImportDataPage', () => {
  it('renders the Import Data heading', () => {
    render(<ImportDataPage />)
    expect(screen.getByRole('heading', { name: /import data/i })).toBeInTheDocument()
  })

  it('renders the page subtitle', () => {
    render(<ImportDataPage />)
    expect(screen.getByText(/batch import students or staff/i)).toBeInTheDocument()
  })

  it('renders Import Students mode toggle button', () => {
    render(<ImportDataPage />)
    expect(screen.getByRole('button', { name: /import students/i })).toBeInTheDocument()
  })

  it('renders Import Staff mode toggle button', () => {
    render(<ImportDataPage />)
    expect(screen.getByRole('button', { name: /import staff/i })).toBeInTheDocument()
  })

  it('defaults to students mode — ImportWizard shows students context', () => {
    render(<ImportDataPage />)
    expect(screen.getByTestId('import-wizard')).toHaveTextContent('ImportWizard:students')
  })

  it('shows enrollment year picker in students mode', () => {
    render(<ImportDataPage />)
    expect(screen.getByText(/enrollment year/i)).toBeInTheDocument()
  })

  it('switches to staff mode when Import Staff button is clicked', async () => {
    const user = userEvent.setup()
    render(<ImportDataPage />)
    await user.click(screen.getByRole('button', { name: /import staff/i }))
    expect(screen.getByTestId('import-wizard')).toHaveTextContent('ImportWizard:staff')
  })

  it('hides enrollment year picker in staff mode', async () => {
    const user = userEvent.setup()
    render(<ImportDataPage />)
    await user.click(screen.getByRole('button', { name: /import staff/i }))
    expect(screen.queryByText(/enrollment year/i)).not.toBeInTheDocument()
  })

  it('shows template download bar with step 1 instruction', () => {
    render(<ImportDataPage />)
    expect(screen.getByText(/step 1/i)).toBeInTheDocument()
    expect(screen.getByText(/download the student template/i)).toBeInTheDocument()
  })

  it('template download bar changes label in staff mode', async () => {
    const user = userEvent.setup()
    render(<ImportDataPage />)
    await user.click(screen.getByRole('button', { name: /import staff/i }))
    expect(screen.getByText(/download the staff template/i)).toBeInTheDocument()
  })

  it('calls generateImportTemplate with "students" when Download button clicked in students mode', async () => {
    const user = userEvent.setup()
    render(<ImportDataPage />)
    await user.click(screen.getByRole('button', { name: /download template/i }))
    expect(mockGenerateTemplate).toHaveBeenCalledWith('students')
  })

  it('calls generateImportTemplate with "staff" when Download button clicked in staff mode', async () => {
    const user = userEvent.setup()
    render(<ImportDataPage />)
    await user.click(screen.getByRole('button', { name: /import staff/i }))
    await user.click(screen.getByRole('button', { name: /download template/i }))
    expect(mockGenerateTemplate).toHaveBeenCalledWith('staff')
  })

  it('shows admission number format hint in students mode', () => {
    render(<ImportDataPage />)
    // Admission numbers are a fixed "STU/{year}/{seq}" format regardless of
    // school short_name (see generate_admission_number() in the DB) —
    // multiple elements contain it, so use getAllByText.
    expect(screen.getAllByText(/stu\//i).length).toBeGreaterThan(0)
  })
})
