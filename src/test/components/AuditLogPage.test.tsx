import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub ──────────────────────────────────────────────────────────
// AuditLogPage.tsx has an inline `useMessageLog` that calls supabase directly.
// We provide a chainable stub so react-query's queryFn resolves cleanly when that
// component *does* render (default tab is 'activity' so the message tab is hidden,
// but the hook is still instantiated inside MessageLogTab — which only mounts when
// the user clicks the tab).
const { chainStub } = vi.hoisted(() => {
  const chainStub = {
    select:  vi.fn(),
    eq:      vi.fn(),
    not:     vi.fn(),
    order:   vi.fn(),
    limit:   vi.fn(),
    gte:     vi.fn(),
    lte:     vi.fn(),
  }
  // Each method returns the same chainStub so we can chain arbitrarily
  Object.keys(chainStub).forEach(k => {
    (chainStub as any)[k].mockReturnValue(chainStub)
  })
  // Terminal call: resolves with empty data
  chainStub.limit.mockResolvedValue({ data: [], error: null })
  chainStub.lte.mockResolvedValue({ data: [], error: null })
  return { chainStub }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: vi.fn().mockReturnValue(chainStub),
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

// ── Hook mocks ─────────────────────────────────────────────────────────────
vi.mock('../../hooks/usePrincipal', () => ({
  useAuditLog: vi.fn(),
}))

import { useAuditLog } from '../../hooks/usePrincipal'
import { AuditLogPage } from '../../pages/principal/AuditLogPage'

const mockAuditLog = useAuditLog as ReturnType<typeof vi.fn>

const AUDIT_ENTRIES = [
  {
    id: 'a1',
    action: 'INSERT',
    tableName: 'students',
    entityName: 'Grace Apio',
    userRole: 'secretary',
    createdAt: '2026-06-30T08:00:00Z',
    oldData: null,
    newData: { first_name: 'Grace', last_name: 'Apio' },
  },
  {
    id: 'a2',
    action: 'UPDATE',
    tableName: 'fee_payments',
    entityName: null,
    userRole: 'bursar',
    createdAt: '2026-06-29T10:30:00Z',
    oldData: { amount_paid: 100000 },
    newData: { amount_paid: 200000 },
  },
]

function setupMocks(entries: any[] = [], loading = false) {
  mockAuditLog.mockReturnValue({ data: entries, isLoading: loading })
}

beforeEach(() => vi.clearAllMocks())

describe('AuditLogPage', () => {
  it('renders "Activity Log" heading', () => {
    setupMocks()
    render(<AuditLogPage />)
    expect(screen.getByRole('heading', { name: 'Activity Log' })).toBeInTheDocument()
  })

  it('renders the Activity Log tab button', () => {
    setupMocks()
    render(<AuditLogPage />)
    expect(screen.getAllByText(/activity log/i).length).toBeGreaterThan(0)
  })

  it('renders the Message Log tab button', () => {
    setupMocks()
    render(<AuditLogPage />)
    expect(screen.getAllByText(/message log/i).length).toBeGreaterThan(0)
  })

  it('renders action filter pills (All activity, Added, Changed, Removed)', () => {
    setupMocks()
    render(<AuditLogPage />)
    expect(screen.getByText('All activity')).toBeInTheDocument()
    expect(screen.getByText('Added')).toBeInTheDocument()
    expect(screen.getByText('Changed')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
  })

  it('renders date "From" and "To" filter inputs', () => {
    setupMocks()
    render(<AuditLogPage />)
    const dateInputs = screen.getAllByDisplayValue('')
    // At least 2 date inputs should be present
    expect(dateInputs.length).toBeGreaterThanOrEqual(2)
  })

  it('shows "No activity found" empty state when entries is empty', () => {
    setupMocks([])
    render(<AuditLogPage />)
    expect(screen.getByText(/no activity found/i)).toBeInTheDocument()
  })

  it('shows "Try adjusting the filters" hint when empty', () => {
    setupMocks([])
    render(<AuditLogPage />)
    expect(screen.getByText(/try adjusting the filters/i)).toBeInTheDocument()
  })

  it('renders audit entries when data is present', () => {
    setupMocks(AUDIT_ENTRIES)
    render(<AuditLogPage />)
    // Secretary enrolled a student — narrative visible
    expect(screen.getByText(/secretary enrolled a new student — Grace Apio/i)).toBeInTheDocument()
  })

  it('shows the entry count footer when entries present', () => {
    setupMocks(AUDIT_ENTRIES)
    render(<AuditLogPage />)
    expect(screen.getByText(/2 entries/i)).toBeInTheDocument()
  })

  it('shows action badge labels for each entry', () => {
    setupMocks(AUDIT_ENTRIES)
    render(<AuditLogPage />)
    // INSERT → "Added" badge; UPDATE → "Changed" badge
    const addedBadges   = screen.getAllByText('Added')
    const changedBadges = screen.getAllByText('Changed')
    expect(addedBadges.length).toBeGreaterThan(0)
    expect(changedBadges.length).toBeGreaterThan(0)
  })

  it('shows Export Excel and CSV buttons', () => {
    setupMocks(AUDIT_ENTRIES)
    render(<AuditLogPage />)
    expect(screen.getByText(/export excel/i)).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
  })

  it('clicking "Changed" filter pill calls useAuditLog with action=UPDATE', async () => {
    setupMocks([])
    const user = userEvent.setup()
    render(<AuditLogPage />)

    await user.click(screen.getByText('Changed'))

    // useAuditLog should be called with the action filter
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE' })
    )
  })

  it('switching to Message Log tab renders date filters', async () => {
    setupMocks([])
    const user = userEvent.setup()
    render(<AuditLogPage />)

    // Find the Message Log tab button inside the pill tabs
    const msgTabBtn = screen.getAllByText(/message log/i).find(
      el => el.tagName.toLowerCase() === 'button'
    )!
    await user.click(msgTabBtn)

    await waitFor(() => {
      expect(screen.getByText(/from date/i)).toBeInTheDocument()
    })
  })
})
