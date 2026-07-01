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
    user: { id: 'principal-u1', role: 'principal', schoolId: 's1', name: 'P', email: 'p@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Toast stub ─────────────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

// ── Avatar stub ─────────────────────────────────────────────────────────────
vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}))

// ── Hook mocks ─────────────────────────────────────────────────────────────
vi.mock('../../hooks/useStaff', () => ({
  useStaff:         vi.fn(),
  useSetStaffActive: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useDepartments: vi.fn(),
  useClasses:     vi.fn(),
}))

import { useStaff, useSetStaffActive } from '../../hooks/useStaff'
import { useDepartments, useClasses } from '../../hooks/useClasses'
import { PrincipalStaffPage } from '../../pages/principal/PrincipalStaffPage'

const mockStaff      = useStaff         as ReturnType<typeof vi.fn>
const mockSetActive  = useSetStaffActive as ReturnType<typeof vi.fn>
const mockDepts      = useDepartments   as ReturnType<typeof vi.fn>
const mockClasses    = useClasses       as ReturnType<typeof vi.fn>

const STAFF_LIST = [
  {
    id: 'st1', authUserId: 'auth-st1',
    firstName: 'Alice', lastName: 'Namugga',
    role: 'teacher', staffNumber: 'KAB/STAFF/001',
    isActive: true, departmentId: 'd1',
    phone: '+256700000001', email: 'alice@k.ug',
    photoUrl: null, classes: ['c1'],
    employmentType: 'permanent', joinDate: '2024-01-15',
  },
  {
    id: 'st2', authUserId: 'auth-st2',
    firstName: 'Ben', lastName: 'Ochola',
    role: 'bursar', staffNumber: 'KAB/STAFF/002',
    isActive: false, departmentId: null,
    phone: null, email: 'ben@k.ug',
    photoUrl: null, classes: [],
    employmentType: 'contract', joinDate: null,
  },
  {
    id: 'st3', authUserId: 'auth-st3',
    firstName: 'Carol', lastName: 'Akello',
    role: 'class_teacher', staffNumber: 'KAB/STAFF/003',
    isActive: true, departmentId: 'd1',
    phone: null, email: null,
    photoUrl: null, classes: ['c1', 'c2'],
    employmentType: 'permanent', joinDate: '2023-08-01',
  },
]

const DEPTS   = [{ id: 'd1', name: 'Sciences' }]
const CLASSES = [{ id: 'c1', name: 'S.1' }, { id: 'c2', name: 'S.2' }]

function setupMocks(staffData: any[] = [], loading = false) {
  mockStaff.mockReturnValue({ data: staffData, isLoading: loading })
  mockSetActive.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockDepts.mockReturnValue({ data: DEPTS, isLoading: false })
  mockClasses.mockReturnValue({ data: CLASSES, isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('PrincipalStaffPage', () => {
  it('renders "Staff Directory" page heading', () => {
    setupMocks()
    render(<PrincipalStaffPage />)
    expect(screen.getByText('Staff Directory')).toBeInTheDocument()
  })

  it('renders search input placeholder', () => {
    setupMocks()
    render(<PrincipalStaffPage />)
    expect(screen.getByPlaceholderText(/search by name, role, or staff number/i)).toBeInTheDocument()
  })

  it('renders role filter pills', () => {
    setupMocks()
    render(<PrincipalStaffPage />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    expect(screen.getByText('Bursar')).toBeInTheDocument()
    expect(screen.getByText('Deputy')).toBeInTheDocument()
  })

  it('shows "No staff found" when list is empty and not loading', () => {
    setupMocks([])
    render(<PrincipalStaffPage />)
    expect(screen.getByText(/no staff found/i)).toBeInTheDocument()
  })

  it('shows "No staff have been registered yet" hint when empty with no filters', () => {
    setupMocks([])
    render(<PrincipalStaffPage />)
    expect(screen.getByText(/no staff have been registered yet/i)).toBeInTheDocument()
  })

  it('renders staff cards when data is present', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    expect(screen.getByText('Alice Namugga')).toBeInTheDocument()
    expect(screen.getByText('Ben Ochola')).toBeInTheDocument()
    expect(screen.getByText('Carol Akello')).toBeInTheDocument()
  })

  it('shows role badge labels on staff cards', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    expect(screen.getAllByText('Teacher').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bursar').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Class Teacher').length).toBeGreaterThan(0)
  })

  it('shows staff numbers on cards', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    expect(screen.getByText('KAB/STAFF/001')).toBeInTheDocument()
    expect(screen.getByText('KAB/STAFF/002')).toBeInTheDocument()
  })

  it('shows Active/Inactive status indicators', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    const activeLabels   = screen.getAllByText('Active')
    const inactiveLabels = screen.getAllByText('Inactive')
    expect(activeLabels.length).toBeGreaterThan(0)
    expect(inactiveLabels.length).toBeGreaterThan(0)
  })

  it('renders a "View" button for each staff card', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    const viewButtons = screen.getAllByText('View')
    // STAFF_LIST has 3 members, principal's own record is filtered out by authUserId check
    // (our principal has id 'principal-u1', none of the staff have that authUserId)
    expect(viewButtons.length).toBe(3)
  })

  it('shows KPI stats row in the hero band', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    expect(screen.getByText('Total Staff')).toBeInTheDocument()
    expect(screen.getByText('Teachers')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('shows department name on staff card when available', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    // Alice and Carol are in dept d1 = Sciences
    expect(screen.getAllByText('Sciences').length).toBeGreaterThan(0)
  })

  it('shows class chips for teacher/class_teacher', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    // Alice teaches c1 (S.1), Carol teaches c1 + c2
    const s1chips = screen.getAllByText('S.1')
    expect(s1chips.length).toBeGreaterThan(0)
  })

  it('shows staff count footer text', () => {
    setupMocks(STAFF_LIST)
    render(<PrincipalStaffPage />)
    expect(screen.getByText(/3 staff members in directory/i)).toBeInTheDocument()
  })

  it('filters by role when a role pill is clicked', async () => {
    setupMocks(STAFF_LIST)
    const user = userEvent.setup()
    render(<PrincipalStaffPage />)

    // Click the "Bursar" filter pill
    await user.click(screen.getByRole('button', { name: 'Bursar' }))

    // useStaff should have been called with role: 'bursar'
    expect(mockStaff).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'bursar' })
    )
  })

  it('shows "Try a different search or filter" hint when no results with active filter', async () => {
    // Simulate filtered staff returning empty
    mockStaff.mockReturnValue({ data: [], isLoading: false })
    mockSetActive.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockDepts.mockReturnValue({ data: [], isLoading: false })
    mockClasses.mockReturnValue({ data: [], isLoading: false })

    const user = userEvent.setup()
    render(<PrincipalStaffPage />)

    const searchInput = screen.getByPlaceholderText(/search by name, role, or staff number/i)
    await user.type(searchInput, 'zzz-no-match')

    await waitFor(() => {
      expect(screen.getByText(/try a different search or filter/i)).toBeInTheDocument()
    })
  })
})
