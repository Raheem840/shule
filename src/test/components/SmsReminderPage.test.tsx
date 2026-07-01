import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'

// ── Virtualiser stub ───────────────────────────────────────────
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize:    () => 0,
    getVirtualItems: () => [],
  }),
}))

// ── Hook mocks ─────────────────────────────────────────────────
vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
  useStreams:  vi.fn(),
}))

vi.mock('../../hooks/useSmsReminders', () => ({
  useSmsStudents:    vi.fn(),
  useSmsReminderLog: vi.fn(),
  useSendReminders:  vi.fn(),
  useRetryReminder:  vi.fn(),
}))

vi.mock('../../hooks/useFeePayments', () => ({
  ugx: (n: number) => `UGX ${n.toLocaleString()}`,
}))

vi.mock('../../hooks/useAdmin', () => ({
  useSchoolSettings: vi.fn(),
}))

// ── Supabase stub ──────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from:      vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (r: any) => Promise.resolve({ data: [], error: null }).then(r) }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
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

import { useClasses, useStreams }                                  from '../../hooks/useClasses'
import { useSmsStudents, useSmsReminderLog, useSendReminders, useRetryReminder } from '../../hooks/useSmsReminders'
import { useSchoolSettings }                                       from '../../hooks/useAdmin'
import { SmsReminderPage }                                         from '../../pages/bursar/SmsReminderPage'

const mockUseClasses      = useClasses      as ReturnType<typeof vi.fn>
const mockUseStreams       = useStreams       as ReturnType<typeof vi.fn>
const mockUseSmsStudents  = useSmsStudents  as ReturnType<typeof vi.fn>
const mockUseSmsLog       = useSmsReminderLog as ReturnType<typeof vi.fn>
const mockUseSendReminders= useSendReminders as ReturnType<typeof vi.fn>
const mockUseRetryReminder= useRetryReminder as ReturnType<typeof vi.fn>
const mockUseSchoolSettings = useSchoolSettings as ReturnType<typeof vi.fn>

const STUDENTS = [
  {
    studentId: 'sid1', firstName: 'Alice', lastName: 'Namata',
    className: 'S.1', guardianName: 'Mary Namata', guardianPhone: '0701234567',
    balance: 300_000, status: 'unpaid' as const,
  },
  {
    studentId: 'sid2', firstName: 'Bob', lastName: 'Okello',
    className: 'S.2', guardianName: 'Peter Okello', guardianPhone: '0707654321',
    balance: 100_000, status: 'partial' as const,
  },
]

function setupMocks(students: any[] = [], isLoading = false, isError = false) {
  mockUseClasses.mockReturnValue({ data: [], isLoading: false })
  mockUseStreams.mockReturnValue({ data: [], isLoading: false })
  mockUseSmsStudents.mockReturnValue({ data: students, isLoading, isError, error: isError ? new Error('Network error') : null })
  mockUseSmsLog.mockReturnValue({ data: [], isLoading: false })
  mockUseSendReminders.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isSuccess: false, isError: false, error: null })
  mockUseRetryReminder.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseSchoolSettings.mockReturnValue({ data: { schoolName: 'Test High School', shortName: 'THS' } })
}

beforeEach(() => vi.clearAllMocks())

describe('SmsReminderPage', () => {
  it('renders SMS Reminders heading', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getByText('SMS Reminders')).toBeInTheDocument()
  })

  it('shows subtitle text', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getByText(/send fee reminders to parents via sms or whatsapp/i)).toBeInTheDocument()
  })

  it('shows loading spinner while students load', () => {
    setupMocks([], true)
    render(<SmsReminderPage />)
    // spinner present — table is not shown
    expect(screen.queryByText('No students match the filters.')).not.toBeInTheDocument()
  })

  it('shows error message when student load fails', () => {
    setupMocks([], false, true)
    render(<SmsReminderPage />)
    expect(screen.getByText(/network error/i)).toBeInTheDocument()
  })

  it('shows empty state when no students match', () => {
    setupMocks([])
    render(<SmsReminderPage />)
    expect(screen.getByText(/no students match the filters/i)).toBeInTheDocument()
  })

  it('renders student rows when data exists', () => {
    setupMocks(STUDENTS)
    render(<SmsReminderPage />)
    expect(screen.getByText('Alice Namata')).toBeInTheDocument()
    expect(screen.getByText('Bob Okello')).toBeInTheDocument()
  })

  it('shows guardian phone numbers', () => {
    setupMocks(STUDENTS)
    render(<SmsReminderPage />)
    expect(screen.getByText('0701234567')).toBeInTheDocument()
    expect(screen.getByText('0707654321')).toBeInTheDocument()
  })

  it('renders fee status badges for each student', () => {
    setupMocks(STUDENTS)
    render(<SmsReminderPage />)
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
    expect(screen.getByText('Partial')).toBeInTheDocument()
  })

  it('renders message composer panel', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getByText('Compose Message')).toBeInTheDocument()
    expect(screen.getByLabelText(/message text/i)).toBeInTheDocument()
  })

  it('shows SMS / WhatsApp channel toggle buttons', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getByText('SMS')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
  })

  it('shows term filter pills (T1, T2, T3)', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getByText('T1')).toBeInTheDocument()
    expect(screen.getByText('T2')).toBeInTheDocument()
    expect(screen.getByText('T3')).toBeInTheDocument()
  })

  it('shows Send button (disabled with 0 selected)', () => {
    setupMocks(STUDENTS)
    render(<SmsReminderPage />)
    const sendBtn = screen.getByRole('button', { name: /send to 0/i })
    expect(sendBtn).toBeDisabled()
  })

  it('shows Delivery Log section heading', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getByText('Delivery Log')).toBeInTheDocument()
  })

  it('shows "No reminders sent yet" when log is empty', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getByText(/no reminders sent yet/i)).toBeInTheDocument()
  })

  it('shows template variable chips (Student Name, Balance, etc.)', () => {
    setupMocks()
    render(<SmsReminderPage />)
    expect(screen.getAllByText('Student Name').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Balance').length).toBeGreaterThan(0)
    expect(screen.getAllByText('School Name').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Term').length).toBeGreaterThan(0)
  })
})
