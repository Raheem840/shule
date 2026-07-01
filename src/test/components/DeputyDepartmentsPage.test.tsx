import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub — also satisfies inline useStaffCountByDept query ────────────
const { mockChainDept } = vi.hoisted(() => ({
  mockChainDept: {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: vi.fn().mockReturnValue(mockChainDept),
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
vi.mock('../../hooks/useClasses', () => ({
  useDepartments:       vi.fn(),
  useCreateDepartment:  vi.fn(),
  useUpdateDepartment:  vi.fn(),
  useArchiveDepartment: vi.fn(),
}))

vi.mock('../../hooks/useStaff', () => ({
  useStaff: vi.fn(),
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

import {
  useDepartments, useCreateDepartment, useUpdateDepartment, useArchiveDepartment,
} from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import { DeputyDepartmentsPage } from '../../pages/deputy/DeputyDepartmentsPage'

const mockDepts       = useDepartments       as ReturnType<typeof vi.fn>
const mockCreate      = useCreateDepartment  as ReturnType<typeof vi.fn>
const mockUpdate      = useUpdateDepartment  as ReturnType<typeof vi.fn>
const mockArchive     = useArchiveDepartment as ReturnType<typeof vi.fn>
const mockStaff       = useStaff             as ReturnType<typeof vi.fn>

const DEPARTMENTS = [
  { id: 'd1', name: 'Science Department',     accentColor: '#0d9488', headTeacherId: 'stf1', archived: false, schoolId: 's1' },
  { id: 'd2', name: 'Mathematics Department', accentColor: '#8b5cf6', headTeacherId: null,   archived: false, schoolId: 's1' },
]

const STAFF_LIST = [
  { id: 'stf1', firstName: 'Alice', lastName: 'Namukasa', role: 'teacher' },
  { id: 'stf2', firstName: 'Bob',   lastName: 'Kato',     role: 'teacher' },
]

function setupMocks(opts: { depts?: any[]; isLoading?: boolean; staff?: any[] } = {}) {
  mockDepts.mockReturnValue({ data: opts.depts ?? [], isLoading: opts.isLoading ?? false })
  mockCreate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockUpdate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockArchive.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockStaff.mockReturnValue({ data: opts.staff ?? [], isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('DeputyDepartmentsPage', () => {
  it('renders the Departments heading', () => {
    setupMocks()
    render(<DeputyDepartmentsPage />)
    expect(screen.getByText('Departments')).toBeInTheDocument()
  })

  it('renders the "New Department" button', () => {
    setupMocks()
    render(<DeputyDepartmentsPage />)
    expect(screen.getByRole('button', { name: /new department/i })).toBeInTheDocument()
  })

  it('renders hero stats (Active Departments, Staff Assigned, Archived)', () => {
    setupMocks({ depts: DEPARTMENTS })
    render(<DeputyDepartmentsPage />)
    expect(screen.getByText('Active Departments')).toBeInTheDocument()
    expect(screen.getByText('Staff Assigned')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('shows loading skeletons while data loads', () => {
    setupMocks({ isLoading: true })
    render(<DeputyDepartmentsPage />)
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "No departments yet" empty state', () => {
    setupMocks({ depts: [] })
    render(<DeputyDepartmentsPage />)
    expect(screen.getByText(/no departments yet/i)).toBeInTheDocument()
  })

  it('shows "Create First Department" button in empty state', () => {
    setupMocks({ depts: [] })
    render(<DeputyDepartmentsPage />)
    expect(screen.getByRole('button', { name: /create first department/i })).toBeInTheDocument()
  })

  it('renders department cards when departments exist', () => {
    setupMocks({ depts: DEPARTMENTS })
    render(<DeputyDepartmentsPage />)
    expect(screen.getByText('Science Department')).toBeInTheDocument()
    expect(screen.getByText('Mathematics Department')).toBeInTheDocument()
  })

  it('renders Edit and Archive buttons for each department', () => {
    setupMocks({ depts: DEPARTMENTS })
    render(<DeputyDepartmentsPage />)
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    expect(editButtons.length).toBe(DEPARTMENTS.length)
    const archiveButtons = screen.getAllByRole('button', { name: /^archive$/i })
    expect(archiveButtons.length).toBe(DEPARTMENTS.length)
  })

  it('shows head-of-department name when headTeacherId is set', () => {
    setupMocks({ depts: DEPARTMENTS, staff: STAFF_LIST })
    render(<DeputyDepartmentsPage />)
    expect(screen.getByText(/hod:.*alice namukasa/i)).toBeInTheDocument()
  })

  it('"New Department" button opens the create modal', async () => {
    setupMocks({ depts: DEPARTMENTS })
    const user = userEvent.setup()
    render(<DeputyDepartmentsPage />)

    await user.click(screen.getByRole('button', { name: /new department/i }))

    await waitFor(() => {
      expect(screen.getAllByText('New Department').length).toBeGreaterThan(1)
      expect(screen.getByPlaceholderText(/e\.g\. science department/i)).toBeInTheDocument()
    })
  })

  it('clicking Edit on a department opens the edit modal', async () => {
    setupMocks({ depts: DEPARTMENTS })
    const user = userEvent.setup()
    render(<DeputyDepartmentsPage />)

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])

    await waitFor(() => {
      expect(screen.getByText(/edit — science department/i)).toBeInTheDocument()
    })
  })

  it('does NOT render any fee or salary data', () => {
    setupMocks({ depts: DEPARTMENTS })
    render(<DeputyDepartmentsPage />)
    expect(screen.queryByText(/ugx/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fee/i)).not.toBeInTheDocument()
  })
})
