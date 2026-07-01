import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

// ── Hook mocks ─────────────────────────────────────────────────
vi.mock('../../hooks/useSmsReminders', () => ({
  useSmsReminderLog: vi.fn(),
  useRetryReminder:  vi.fn(),
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
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      in:     vi.fn().mockReturnThis(),
      update: vi.fn().mockResolvedValue({ error: null }),
      then:   (res: any) => Promise.resolve({ data: [], error: null }).then(res),
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

import { useSmsReminderLog, useRetryReminder } from '../../hooks/useSmsReminders'
import { DeliveryLogPage } from '../../pages/bursar/DeliveryLogPage'

const mockUseLog    = useSmsReminderLog as ReturnType<typeof vi.fn>
const mockUseRetry  = useRetryReminder  as ReturnType<typeof vi.fn>

const LOG_ROWS = [
  {
    id: 'r1', firstName: 'Alice', lastName: 'Namata',
    guardianPhone: '0701234567', channel: 'sms',
    message: 'Dear Alice\'s parent, please pay school fees.',
    status: 'sent', sentAt: '2025-06-01T09:00:00Z',
    createdAt: '2025-06-01T08:55:00Z', studentId: 's1',
  },
  {
    id: 'r2', firstName: 'Bob', lastName: 'Okello',
    guardianPhone: '0707654321', channel: 'whatsapp',
    message: 'Dear Bob\'s parent, balance is UGX 200,000.',
    status: 'delivered', sentAt: '2025-06-02T10:00:00Z',
    createdAt: '2025-06-02T09:55:00Z', studentId: 's2',
  },
  {
    id: 'r3', firstName: 'Carol', lastName: 'Atim',
    guardianPhone: '0712345678', channel: 'sms',
    message: 'Reminder: fee balance outstanding.',
    status: 'failed', sentAt: null,
    createdAt: '2025-06-03T07:00:00Z', studentId: 's3',
  },
]

function setupMocks(rows: any[] = [], isLoading = false, isError = false) {
  mockUseLog.mockReturnValue({ data: rows, isLoading, isError })
  mockUseRetry.mockReturnValue({ mutate: vi.fn(), isPending: false })
}

beforeEach(() => vi.clearAllMocks())

describe('DeliveryLogPage', () => {
  it('renders Delivery Log heading', () => {
    setupMocks()
    render(<DeliveryLogPage />)
    expect(screen.getByText('Delivery Log')).toBeInTheDocument()
  })

  it('shows subtitle text', () => {
    setupMocks()
    render(<DeliveryLogPage />)
    expect(screen.getByText(/sms and whatsapp message delivery status/i)).toBeInTheDocument()
  })

  it('shows loading spinner while data loads', () => {
    setupMocks([], true)
    render(<DeliveryLogPage />)
    // Page renders but table is hidden — loading spinner shows
    expect(screen.queryByText(/no messages match/i)).not.toBeInTheDocument()
  })

  it('shows error message on fetch failure', () => {
    setupMocks([], false, true)
    render(<DeliveryLogPage />)
    expect(screen.getByText(/failed to load delivery log/i)).toBeInTheDocument()
  })

  it('shows empty state when no records', () => {
    setupMocks([])
    render(<DeliveryLogPage />)
    expect(screen.getByText(/no messages match the current filters/i)).toBeInTheDocument()
  })

  it('renders student names for log rows', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    expect(screen.getByText('Alice Namata')).toBeInTheDocument()
    expect(screen.getByText('Bob Okello')).toBeInTheDocument()
    expect(screen.getByText('Carol Atim')).toBeInTheDocument()
  })

  it('shows "Sent" badge for sent rows', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    expect(screen.getAllByText('Sent').length).toBeGreaterThan(0)
  })

  it('shows "Delivered" badge for delivered rows', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0)
  })

  it('shows "Failed" badge for failed rows', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0)
  })

  it('shows Retry button for failed rows', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows "Retry All Failed" button when failed rows exist', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    // allFailedIds.length > 0 → button renders
    expect(screen.getByText(/retry all failed/i)).toBeInTheDocument()
  })

  it('does NOT show "Retry All Failed" when no failures', () => {
    setupMocks([LOG_ROWS[0]]) // only a 'sent' row — no failed
    render(<DeliveryLogPage />)
    expect(screen.queryByText(/retry all failed/i)).not.toBeInTheDocument()
  })

  it('shows summary chips (Total, Delivered, Failed, Pending)', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    expect(screen.getAllByText(/total/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/delivered/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0)
  })

  it('shows correct total count in summary chip', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    // "Total — 3" chip
    expect(screen.getByText('Total — 3')).toBeInTheDocument()
  })

  it('channel badge shows SMS for sms rows and WhatsApp for wa rows', () => {
    setupMocks(LOG_ROWS)
    render(<DeliveryLogPage />)
    expect(screen.getAllByText('SMS').length).toBeGreaterThan(0)
    expect(screen.getAllByText('WhatsApp').length).toBeGreaterThan(0)
  })

  it('renders filter bar (search, channel, status, date)', () => {
    setupMocks()
    render(<DeliveryLogPage />)
    expect(screen.getByPlaceholderText(/search name, phone, message/i)).toBeInTheDocument()
    expect(screen.getByText('All Channels')).toBeInTheDocument()
    expect(screen.getByText('All Statuses')).toBeInTheDocument()
  })
})
