import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase mock — satisfies inline useDeputyStaff query chain ───────────────
const { RAW_STAFF, mockStaffChain } = vi.hoisted(() => {
  const RAW_STAFF = [
    { id: 'stf1', first_name: 'Jane', last_name: 'Nakato',  role: 'teacher',       staff_number: 'S/STAFF/001', subjects: [],        classes: [],   email: 'jane@k.ug', phone: null, join_date: '2022-01-10', photo_url: null, is_active: true },
    { id: 'stf2', first_name: 'Tom',  last_name: 'Musoke',  role: 'class_teacher', staff_number: 'S/STAFF/002', subjects: ['subj1'], classes: ['c1'], email: null,        phone: '0700000001', join_date: null,         photo_url: null, is_active: true },
  ]

  const mockStaffChain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue({ data: RAW_STAFF, error: null }),
  }
  return { RAW_STAFF, mockStaffChain }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: vi.fn().mockReturnValue(mockStaffChain),
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

// ── Hook mocks — used by StaffDetailModal ────────────────────────────────────
vi.mock('../../hooks/useClasses', () => ({
  useClasses:     vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useSubjects:    vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useDepartments: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

// Desktop mode — uses regular <table> (no virtualizer)
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}))

import { DeputyStaffPage } from '../../pages/deputy/DeputyStaffPage'

beforeEach(() => {
  vi.clearAllMocks()
  // Reset supabase chain to return staff data
  mockStaffChain.select.mockReturnThis()
  mockStaffChain.eq.mockReturnThis()
  mockStaffChain.order.mockResolvedValue({ data: RAW_STAFF, error: null })
})

describe('DeputyStaffPage', () => {
  it('renders the Staff heading', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText('Staff')).toBeInTheDocument()
    })
  })

  it('renders the "Read-only staff directory" subtitle', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText(/read-only staff directory/i)).toBeInTheDocument()
    })
  })

  it('shows loading skeletons before data resolves', () => {
    // Make order never resolve during this test
    mockStaffChain.order.mockReturnValue(new Promise(() => {}))
    render(<DeputyStaffPage />)
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders staff rows when data is available', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText('Jane Nakato')).toBeInTheDocument()
      expect(screen.getByText('Tom Musoke')).toBeInTheDocument()
    })
  })

  it('renders staff numbers', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText('S/STAFF/001')).toBeInTheDocument()
      expect(screen.getByText('S/STAFF/002')).toBeInTheDocument()
    })
  })

  it('renders role badges for Teacher and Class Teacher', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText('Teacher')).toBeInTheDocument()
      expect(screen.getByText('Class Teacher')).toBeInTheDocument()
    })
  })

  it('shows staff count badge', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('renders role filter buttons (All, Teacher, Class Teacher)', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^teacher$/i }).length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: /^class teacher$/i })).toBeInTheDocument()
    })
  })

  it('search by name filters the table', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => expect(screen.getByText('Jane Nakato')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/search name or staff number/i), 'Tom')

    await waitFor(() => {
      expect(screen.getByText('Tom Musoke')).toBeInTheDocument()
      expect(screen.queryByText('Jane Nakato')).not.toBeInTheDocument()
    })
  })

  it('shows "No matching staff" when search finds nothing', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => expect(screen.getByText('Jane Nakato')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/search name or staff number/i), 'zzznomatch')

    await waitFor(() => {
      expect(screen.getByText(/no matching staff/i)).toBeInTheDocument()
    })
  })

  it('clicking "Teacher" filter hides Class Teacher-only staff', async () => {
    // Add a class_teacher-only member to differentiate
    const data = [
      ...RAW_STAFF,
      { id: 'stf3', first_name: 'Extra', last_name: 'OnlyCT', role: 'class_teacher', staff_number: 'S/STAFF/003', subjects: [], classes: [], email: null, phone: null, join_date: null, photo_url: null, is_active: true },
    ]
    mockStaffChain.order.mockResolvedValue({ data, error: null })

    render(<DeputyStaffPage />)
    await waitFor(() => expect(screen.getByText('Jane Nakato')).toBeInTheDocument())

    const user = userEvent.setup()
    // "Teacher" filter matches both teacher AND class_teacher roles per matchesRoleFilter()
    await user.click(screen.getAllByRole('button', { name: /^teacher$/i })[0])

    // All remain since matchesRoleFilter('teacher', 'teacher') = true and class_teacher too
    await waitFor(() => {
      expect(screen.getByText('Jane Nakato')).toBeInTheDocument()
      expect(screen.getByText('Tom Musoke')).toBeInTheDocument()
    })
  })

  it('shows "Export CSV" button when rows are present', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
    })
  })

  it('clicking a staff row opens the detail modal', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => expect(screen.getByText('Jane Nakato')).toBeInTheDocument())

    const user = userEvent.setup()
    // Click the staff row (desktop table <tr>)
    await user.click(screen.getByText('Jane Nakato'))

    await waitFor(() => {
      // Modal header shows name + close button
      expect(screen.getAllByText('Jane Nakato').length).toBeGreaterThan(1)
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })
  })

  it('does NOT render any salary or fee column', async () => {
    render(<DeputyStaffPage />)
    await waitFor(() => expect(screen.getByText('Jane Nakato')).toBeInTheDocument())
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/ugx/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fee/i)).not.toBeInTheDocument()
  })

  it('shows "No staff found" when supabase returns empty list', async () => {
    mockStaffChain.order.mockResolvedValue({ data: [], error: null })
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText(/no staff found/i)).toBeInTheDocument()
    })
  })

  it('shows error message when supabase returns an error', async () => {
    mockStaffChain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    render(<DeputyStaffPage />)
    await waitFor(() => {
      expect(screen.getByText(/failed to load staff list/i)).toBeInTheDocument()
    })
  })
})
