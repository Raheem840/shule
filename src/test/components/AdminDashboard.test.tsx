import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Virtualizer mock: jsdom has no layout, so the virtualizer returns no items
// by default — override so user rows appear in tests.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => ({
    getTotalSize:    () => count * 64,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i, start: i * 64, size: 64, key: i, lane: 0,
      })),
  })),
}))

// ── Supabase stub ──────────────────────────────────────────────────────────────
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
      is:          vi.fn().mockReturnThis(),
      not:         vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      then:        (resolve: any) =>
        Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
    }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
  },
}))

// ── Auth ───────────────────────────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'it_admin', schoolId: 's1', name: 'IT Admin', email: 'admin@nys.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── All hooks from useAdmin ────────────────────────────────────────────────────
vi.mock('../../hooks/useAdmin', () => ({
  useSystemKpis:        vi.fn(),
  useStorageBuckets:    vi.fn(),
  useUserManagement:    vi.fn(),
  useDeactivateUser:    vi.fn(),
  useSchoolSettings:    vi.fn(),
  useSaveSchoolSettings:vi.fn(),
  useSaveApiConfig:     vi.fn(),
  useApiConfigStatus:   vi.fn(),
  useAcademicYears:     vi.fn(),
  useToggleSurvey:      vi.fn(),
}))

vi.mock('../../hooks/useStaffAuth', () => ({
  useResetStaffPassword: vi.fn(),
}))

// ── Toast ──────────────────────────────────────────────────────────────────────
vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import {
  useSystemKpis, useStorageBuckets, useUserManagement,
  useDeactivateUser,
  useSchoolSettings, useSaveSchoolSettings, useSaveApiConfig,
  useApiConfigStatus, useAcademicYears, useToggleSurvey,
} from '../../hooks/useAdmin'
import { useResetStaffPassword } from '../../hooks/useStaffAuth'
import { AdminDashboard } from '../../pages/admin/AdminDashboard'

const mockUseSystemKpis        = useSystemKpis        as ReturnType<typeof vi.fn>
const mockUseStorageBuckets    = useStorageBuckets    as ReturnType<typeof vi.fn>
const mockUseUserManagement    = useUserManagement    as ReturnType<typeof vi.fn>
const mockUseResetPassword     = useResetStaffPassword as ReturnType<typeof vi.fn>
const mockUseDeactivateUser    = useDeactivateUser    as ReturnType<typeof vi.fn>
const mockUseSchoolSettings    = useSchoolSettings    as ReturnType<typeof vi.fn>
const mockUseSaveSchoolSettings= useSaveSchoolSettings as ReturnType<typeof vi.fn>
const mockUseSaveApiConfig     = useSaveApiConfig     as ReturnType<typeof vi.fn>
const mockUseApiConfigStatus   = useApiConfigStatus   as ReturnType<typeof vi.fn>
const mockUseAcademicYears     = useAcademicYears     as ReturnType<typeof vi.fn>
const mockUseToggleSurvey      = useToggleSurvey      as ReturnType<typeof vi.fn>

const MUTATION_STUB = { mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }

const SAMPLE_KPI = {
  totalUsers:      24,
  activeToday:      3,
  storageUsedMb:   12,
  syncQueuePending: 0,
  syncQueueFailed:  0,
}

const SAMPLE_BUCKETS = [
  { name: 'staff-photos',    fileCount: 8,  sizeMb: 4.2 },
  { name: 'student-photos',  fileCount: 120, sizeMb: 60.1 },
  { name: 'documents',       fileCount: 15, sizeMb: 8.7 },
]

const SAMPLE_USERS = [
  { staffId: 'sf1', authUserId: 'au1', name: 'Alice Nakato', role: 'teacher',    isActive: true,  lastLogin: '2026-06-01T10:00:00Z' },
  { staffId: 'sf2', authUserId: 'au2', name: 'Bob Ssemanda', role: 'bursar',     isActive: false, lastLogin: null },
]

const SAMPLE_SCHOOL = {
  schoolName:   'Nile Youth School',
  shortName:    'NYS',
  motto:        'Excellence Above All',
  primaryColor: '#0d9488',
}

const SAMPLE_ACADEMIC_YEARS = [
  { id: 'ay1', name: '2025/2026', is_active: true,  survey_active: false },
  { id: 'ay2', name: '2024/2025', is_active: false, survey_active: false },
]

function setupMocks(overrides: Record<string, any> = {}) {
  mockUseSystemKpis.mockReturnValue({
    data: overrides.kpis ?? SAMPLE_KPI, isLoading: overrides.kpisLoading ?? false,
  })
  mockUseStorageBuckets.mockReturnValue({
    data: overrides.buckets ?? SAMPLE_BUCKETS, isLoading: overrides.bucketsLoading ?? false,
  })
  mockUseUserManagement.mockReturnValue({
    data: overrides.users ?? SAMPLE_USERS, isLoading: overrides.usersLoading ?? false,
  })
  mockUseResetPassword.mockReturnValue({ ...MUTATION_STUB, isPending: false })
  mockUseDeactivateUser.mockReturnValue({ ...MUTATION_STUB })
  mockUseSchoolSettings.mockReturnValue({
    data: overrides.school ?? SAMPLE_SCHOOL, isLoading: overrides.schoolLoading ?? false,
  })
  mockUseSaveSchoolSettings.mockReturnValue({ ...MUTATION_STUB, isPending: false })
  mockUseSaveApiConfig.mockReturnValue({ ...MUTATION_STUB, isPending: false })
  mockUseApiConfigStatus.mockReturnValue({ data: { atEnabled: false, waEnabled: false }, isLoading: false })
  mockUseAcademicYears.mockReturnValue({ data: overrides.years ?? SAMPLE_ACADEMIC_YEARS, isLoading: false })
  mockUseToggleSurvey.mockReturnValue({ ...MUTATION_STUB })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMocks()
})

describe('AdminDashboard', () => {
  // ── Page structure ────────────────────────────────────────────────────────
  it('renders the "IT Administration" heading', () => {
    render(<AdminDashboard />)
    expect(screen.getByText(/IT Administration/i)).toBeInTheDocument()
  })

  it('renders the "Admin Only" badge', () => {
    render(<AdminDashboard />)
    expect(screen.getByText(/admin only/i)).toBeInTheDocument()
  })

  it('renders three tab buttons', () => {
    render(<AdminDashboard />)
    expect(screen.getByRole('tab', { name: /system kpis/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /user management/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /school settings/i })).toBeInTheDocument()
  })

  // ── System KPIs tab (default) ─────────────────────────────────────────────
  it('shows KPI card labels on the System KPIs tab', () => {
    render(<AdminDashboard />)
    expect(screen.getByText(/total users/i)).toBeInTheDocument()
    expect(screen.getByText(/active today/i)).toBeInTheDocument()
    expect(screen.getByText(/browser storage/i)).toBeInTheDocument()
    expect(screen.getByText(/sync pending/i)).toBeInTheDocument()
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
  })

  it('shows KPI values from mocked data', () => {
    render(<AdminDashboard />)
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('12 MB')).toBeInTheDocument()
  })

  it('shows "Loading system data…" while KPIs are loading', () => {
    setupMocks({ kpisLoading: true, kpis: null })
    render(<AdminDashboard />)
    expect(screen.getByText(/loading system data/i)).toBeInTheDocument()
  })

  it('renders the Storage Buckets table with bucket names', () => {
    render(<AdminDashboard />)
    expect(screen.getByText('Storage Buckets')).toBeInTheDocument()
    expect(screen.getByText('staff-photos')).toBeInTheDocument()
    expect(screen.getByText('student-photos')).toBeInTheDocument()
    expect(screen.getByText('documents')).toBeInTheDocument()
  })

  it('shows "No storage buckets found" when buckets list is empty', () => {
    setupMocks({ buckets: [] })
    render(<AdminDashboard />)
    expect(screen.getByText(/no storage buckets found/i)).toBeInTheDocument()
  })

  // ── User Management tab ───────────────────────────────────────────────────
  it('switches to User Management tab and shows user names', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)

    await user.click(screen.getByRole('tab', { name: /user management/i }))

    await waitFor(() => {
      expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
      expect(screen.getByText('Bob Ssemanda')).toBeInTheDocument()
    })
  })

  it('shows Active/Inactive status in user management list', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /user management/i }))
    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
    })
  })

  it('shows user count KPI strip in user management', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /user management/i }))
    await waitFor(() => {
      expect(screen.getByText(/total staff/i)).toBeInTheDocument()
    })
  })

  it('shows search input in user management tab', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /user management/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search staff/i)).toBeInTheDocument()
    })
  })

  it('filters users by search query', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /user management/i }))
    await waitFor(() => screen.getByPlaceholderText(/search staff/i))

    await user.type(screen.getByPlaceholderText(/search staff/i), 'alice')
    expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
    expect(screen.queryByText('Bob Ssemanda')).not.toBeInTheDocument()
  })

  it('shows "Loading users…" while user list is loading', async () => {
    setupMocks({ usersLoading: true, users: [] })
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /user management/i }))
    await waitFor(() => {
      expect(screen.getByText(/loading users/i)).toBeInTheDocument()
    })
  })

  it('clicking Deactivate opens a confirm modal, and confirming passes authUserId so the Supabase Auth-level ban actually fires', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)
    mockUseDeactivateUser.mockReturnValue({ ...MUTATION_STUB, mutateAsync: mutate })
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /user management/i }))
    await waitFor(() => screen.getByText('Alice Nakato'))

    const deactivateButtons = screen.getAllByText('Deactivate')
    await user.click(deactivateButtons[0])

    // Confirming is now behind a modal — clicking the row action alone must
    // NOT fire the mutation immediately (a double-click/race guard fix).
    expect(mutate).not.toHaveBeenCalled()

    const confirmHeading = await screen.findByText(/Deactivate Alice Nakato\?/i)
    const modal = confirmHeading.closest('.sui-modal-dialog') as HTMLElement
    await user.click(within(modal).getByRole('button', { name: 'Deactivate' }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: 'sf1', isActive: false, authUserId: 'au1' })
    )
  })

  it('does not render a Delete button or delete confirmation modal in User Management', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /user management/i }))
    await waitFor(() => screen.getByText('Alice Nakato'))

    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/delete user account/i)).not.toBeInTheDocument()
  })

  // ── School Settings tab ───────────────────────────────────────────────────
  it('switches to School Settings tab and shows School Profile heading', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /school settings/i }))
    await waitFor(() => {
      expect(screen.getByText('School Profile')).toBeInTheDocument()
    })
  })

  it('shows school name pre-filled in settings form', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /school settings/i }))
    await waitFor(() => {
      const input = screen.getByDisplayValue('Nile Youth School')
      expect(input).toBeInTheDocument()
    })
  })

  it('shows motto field pre-filled', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /school settings/i }))
    await waitFor(() => {
      expect(screen.getByDisplayValue('Excellence Above All')).toBeInTheDocument()
    })
  })

  it('shows Save Profile button in settings', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /school settings/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument()
    })
  })

  it('renders Academic Years table with year data', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /school settings/i }))
    await waitFor(() => {
      expect(screen.getByText('2025/2026')).toBeInTheDocument()
      expect(screen.getByText('2024/2025')).toBeInTheDocument()
      expect(screen.getByText('Current')).toBeInTheDocument()
    })
  })

  it('shows Communication APIs section', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /school settings/i }))
    await waitFor(() => {
      expect(screen.getByText(/communication apis/i)).toBeInTheDocument()
      expect(screen.getByText(/africa's talking/i)).toBeInTheDocument()
    })
  })

  it('shows "Loading settings…" while settings data is loading', async () => {
    setupMocks({ schoolLoading: true, school: null })
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(screen.getByRole('tab', { name: /school settings/i }))
    await waitFor(() => {
      expect(screen.getByText(/loading settings/i)).toBeInTheDocument()
    })
  })
})
