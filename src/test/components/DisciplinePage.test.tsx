import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Supabase stub ──────────────────────────────────────────────────────────────
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

// ── AuthContext stub ───────────────────────────────────────────────────────────
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'deputy', schoolId: 's1', name: 'Deputy', email: 'dep@k.ug', staffId: 'stf1' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

// ── Hook mocks ─────────────────────────────────────────────────────────────────
vi.mock('../../hooks/useDeputy', () => ({
  useDisciplineRecords:      vi.fn(),
  useAddDisciplineRecord:    vi.fn(),
  useUpdateDisciplineRecord: vi.fn(),
  useDeleteDisciplineRecord: vi.fn(),
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
}))

// Mobile mode — avoids @tanstack/react-virtual rendering the virtualised table
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(true),
}))

import {
  useDisciplineRecords, useAddDisciplineRecord,
  useUpdateDisciplineRecord, useDeleteDisciplineRecord,
} from '../../hooks/useDeputy'
import { useStudents } from '../../hooks/useStudents'
import { useClasses }  from '../../hooks/useClasses'
import { DisciplinePage } from '../../pages/deputy/DisciplinePage'

const mockRecords = useDisciplineRecords      as ReturnType<typeof vi.fn>
const mockAdd     = useAddDisciplineRecord    as ReturnType<typeof vi.fn>
const mockUpdate  = useUpdateDisciplineRecord as ReturnType<typeof vi.fn>
const mockDelete  = useDeleteDisciplineRecord as ReturnType<typeof vi.fn>
const mockStudents = useStudents              as ReturnType<typeof vi.fn>
const mockClasses  = useClasses               as ReturnType<typeof vi.fn>

const RECORDS = [
  {
    id: 'dr1',
    studentId: 'stu1',
    studentName: 'Alice Nakato',
    classId: 'c1',
    className: 'S.2',
    incidentDate: '2026-06-01',
    nature: 'lateness' as const,
    resolution: 'Parent notified and warned',
    notes: null,
  },
  {
    id: 'dr2',
    studentId: 'stu2',
    studentName: 'Brian Ssempa',
    classId: 'c1',
    className: 'S.2',
    incidentDate: '2026-06-05',
    nature: 'misconduct' as const,
    resolution: 'Detention issued',
    notes: 'Repeat offender',
  },
]

function setupMocks(opts: { records?: any[]; isLoading?: boolean } = {}) {
  mockRecords.mockReturnValue({ data: opts.records ?? [], isLoading: opts.isLoading ?? false })
  mockAdd.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockUpdate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockDelete.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockStudents.mockReturnValue({ data: [], isLoading: false })
  mockClasses.mockReturnValue({ data: [], isLoading: false })
}

beforeEach(() => vi.clearAllMocks())

describe('DisciplinePage', () => {
  it('renders the Discipline Records heading', () => {
    setupMocks()
    render(<DisciplinePage />)
    expect(screen.getByRole('heading', { name: /discipline records/i })).toBeInTheDocument()
  })

  it('renders the "Add Record" button', () => {
    setupMocks()
    render(<DisciplinePage />)
    expect(screen.getByRole('button', { name: /add record/i })).toBeInTheDocument()
  })

  it('shows loading skeletons while records load', () => {
    setupMocks({ isLoading: true })
    render(<DisciplinePage />)
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "No discipline records yet" when list is empty', () => {
    setupMocks({ records: [] })
    render(<DisciplinePage />)
    expect(screen.getByText(/no discipline records yet/i)).toBeInTheDocument()
  })

  it('shows "Add First Record" button in empty state', () => {
    setupMocks({ records: [] })
    render(<DisciplinePage />)
    expect(screen.getByRole('button', { name: /add first record/i })).toBeInTheDocument()
  })

  it('renders discipline records — student name and resolution visible', () => {
    setupMocks({ records: RECORDS })
    render(<DisciplinePage />)
    expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
    expect(screen.getByText('Brian Ssempa')).toBeInTheDocument()
    expect(screen.getByText('Parent notified and warned')).toBeInTheDocument()
    expect(screen.getByText('Detention issued')).toBeInTheDocument()
  })

  it('renders nature badges for each record', () => {
    setupMocks({ records: RECORDS })
    render(<DisciplinePage />)
    expect(screen.getAllByText('Lateness').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Misconduct').length).toBeGreaterThan(0)
  })

  it('shows correct record count in the header', () => {
    setupMocks({ records: RECORDS })
    render(<DisciplinePage />)
    // "2 records · 2 total"
    expect(screen.getByText(/2 records/i)).toBeInTheDocument()
  })

  it('renders nature filter pills (All Types, Lateness, etc.)', () => {
    setupMocks()
    render(<DisciplinePage />)
    expect(screen.getByRole('button', { name: /all types/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lateness/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /misconduct/i })).toBeInTheDocument()
  })

  it('clicking "Add Record" opens the Add Discipline Record modal', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<DisciplinePage />)

    await user.click(screen.getByRole('button', { name: /add record/i }))

    await waitFor(() => {
      expect(screen.getByText('Add Discipline Record')).toBeInTheDocument()
    })
  })

  it('clicking Edit on a record opens the edit modal', async () => {
    setupMocks({ records: RECORDS })
    const user = userEvent.setup()
    render(<DisciplinePage />)

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Record')).toBeInTheDocument()
    })
  })

  it('clicking Delete on a record opens the delete confirmation modal', async () => {
    setupMocks({ records: RECORDS })
    const user = userEvent.setup()
    render(<DisciplinePage />)

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => {
      expect(screen.getByText(/delete record\?/i)).toBeInTheDocument()
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
    })
  })

  it('search filters records by student name', async () => {
    setupMocks({ records: RECORDS })
    const user = userEvent.setup()
    render(<DisciplinePage />)

    const searchBox = screen.getByPlaceholderText(/search student or resolution/i)
    await user.type(searchBox, 'Alice')

    await waitFor(() => {
      expect(screen.getByText('Alice Nakato')).toBeInTheDocument()
      expect(screen.queryByText('Brian Ssempa')).not.toBeInTheDocument()
    })
  })

  it('shows "No matching records" when search yields no results', async () => {
    setupMocks({ records: RECORDS })
    const user = userEvent.setup()
    render(<DisciplinePage />)

    await user.type(screen.getByPlaceholderText(/search student or resolution/i), 'zzznomatch')

    await waitFor(() => {
      expect(screen.getByText(/no matching records/i)).toBeInTheDocument()
    })
  })

  it('does NOT render any fee or finance data', () => {
    setupMocks({ records: RECORDS })
    render(<DisciplinePage />)
    expect(screen.queryByText(/ugx/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fee/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument()
  })
})
