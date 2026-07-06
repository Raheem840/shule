import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'dos', schoolId: 's1', name: 'DoS', email: 'dos@k.ug', staffId: 'st-dos' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses:      vi.fn(),
  useStreams:       vi.fn(),
  useCreateClass:  vi.fn(),
  useSubjects:     vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
}))

vi.mock('../../hooks/useDos', () => ({
  useAssignClassTeacher: vi.fn(),
}))

vi.mock('../../hooks/useStaff', () => ({
  useStaff: vi.fn(),
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

import { useClasses, useStreams, useCreateClass } from '../../hooks/useClasses'
import { useStudents }                              from '../../hooks/useStudents'
import { useAssignClassTeacher }                   from '../../hooks/useDos'
import { useStaff }                                from '../../hooks/useStaff'
import { DosClassesPage }                          from '../../pages/dos/DosClassesPage'

const mockClasses  = useClasses              as ReturnType<typeof vi.fn>
const mockStreams   = useStreams               as ReturnType<typeof vi.fn>
const mockCreate   = useCreateClass           as ReturnType<typeof vi.fn>
const mockStudents = useStudents              as ReturnType<typeof vi.fn>
const mockAssign   = useAssignClassTeacher    as ReturnType<typeof vi.fn>
const mockStaff    = useStaff                 as ReturnType<typeof vi.fn>

const CLASSES = [
  { id: 'c1', name: 'S.1', level: '1', academicYearId: 'ay1', schoolId: 's1', createdAt: '' },
  { id: 'c2', name: 'S.2', level: '2', academicYearId: 'ay1', schoolId: 's1', createdAt: '' },
]
const STREAMS = [
  { id: 'st1', name: 'West', classId: 'c1', classTeacherId: null, schoolId: 's1', createdAt: '' },
]
const STAFF = [
  { id: 'stf1', firstName: 'Jane', lastName: 'Doe', role: 'teacher', isActive: true },
]

function setupMocks(opts: {
  classes?: any[]
  isLoading?: boolean
  streams?: any[]
  students?: any[]
  staff?: any[]
} = {}) {
  mockClasses.mockReturnValue({ data: opts.classes ?? [], isLoading: opts.isLoading ?? false })
  mockStreams.mockReturnValue({ data: opts.streams ?? [], isLoading: false })
  mockStudents.mockReturnValue({ data: opts.students ?? [], isLoading: false })
  mockStaff.mockReturnValue({ data: opts.staff ?? [], isLoading: false })
  mockAssign.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockCreate.mockReturnValue({ mutate: vi.fn(), isPending: false })
}

beforeEach(() => vi.clearAllMocks())

describe('DosClassesPage', () => {
  it('renders the Classes & Streams heading', () => {
    setupMocks()
    render(<DosClassesPage />)
    expect(screen.getByText(/classes.*streams/i)).toBeInTheDocument()
  })

  it('renders "Add Class" button', () => {
    setupMocks()
    render(<DosClassesPage />)
    expect(screen.getByRole('button', { name: /add class/i })).toBeInTheDocument()
  })

  it('shows loading skeletons when data is loading', () => {
    setupMocks({ isLoading: true })
    render(<DosClassesPage />)
    // Skeletons are rendered as divs with shule-skeleton class
    const skeletons = document.querySelectorAll('.shule-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when there are no classes', () => {
    setupMocks({ classes: [] })
    render(<DosClassesPage />)
    expect(screen.getByText(/no classes yet/i)).toBeInTheDocument()
  })

  it('shows "Add First Class" button in the empty state', () => {
    setupMocks({ classes: [] })
    render(<DosClassesPage />)
    expect(screen.getByRole('button', { name: /add first class/i })).toBeInTheDocument()
  })

  it('renders class cards when classes exist', () => {
    setupMocks({ classes: CLASSES })
    render(<DosClassesPage />)
    // Both class names appear (possibly more than once — card + panel header)
    expect(screen.getAllByText('S.1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('S.2').length).toBeGreaterThanOrEqual(1)
  })

  it('shows class count in the hero band', () => {
    setupMocks({ classes: CLASSES })
    render(<DosClassesPage />)
    // Hero band stat shows the count
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('auto-selects the first class and shows its StreamsPanel', async () => {
    setupMocks({ classes: CLASSES, streams: STREAMS })
    render(<DosClassesPage />)

    // The first class (S.1) is auto-selected; StreamsPanel shows class name
    await waitFor(() => {
      // StreamsPanel header shows class name
      const panels = screen.getAllByText('S.1')
      expect(panels.length).toBeGreaterThan(1) // card + panel header
    })
  })

  it('StreamsPanel shows "No streams yet" when class has no streams', async () => {
    setupMocks({ classes: CLASSES, streams: [] })
    render(<DosClassesPage />)

    await waitFor(() => {
      expect(screen.getByText(/no streams yet/i)).toBeInTheDocument()
    })
  })

  it('StreamsPanel shows stream name when streams exist', async () => {
    setupMocks({ classes: CLASSES, streams: STREAMS })
    render(<DosClassesPage />)

    await waitFor(() => {
      expect(screen.getByText('West')).toBeInTheDocument()
    })
  })

  it('stream row shows Assign button when no teacher is assigned', async () => {
    setupMocks({ classes: CLASSES, streams: STREAMS })
    render(<DosClassesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^assign$/i })).toBeInTheDocument()
    })
  })

  it('"Add Class" button opens the Add New Class modal', async () => {
    setupMocks({ classes: CLASSES })
    const user = userEvent.setup()
    render(<DosClassesPage />)

    // Click first "Add Class" button (in the hero band)
    await user.click(screen.getAllByRole('button', { name: /add class/i })[0])

    await waitFor(() => {
      expect(screen.getByText('Add New Class')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/e\.g\. s\.1/i)).toBeInTheDocument()
    })
  })

  it('clicking a stream Assign button opens the Assign Teacher modal', async () => {
    setupMocks({ classes: CLASSES, streams: STREAMS, staff: STAFF })
    const user = userEvent.setup()
    render(<DosClassesPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: /^assign$/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^assign$/i }))

    await waitFor(() => {
      expect(screen.getByText('Assign Class Teacher')).toBeInTheDocument()
      // Teacher list includes the mocked teacher
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
  })

  // A deactivated/suspended teacher was previously still selectable and
  // assignable as class teacher — the dropdown gave no indication they were
  // inactive. Now excluded, matching useDosTeacherPerformance's convention.
  it('excludes an inactive teacher from the Assign Teacher dropdown', async () => {
    setupMocks({
      classes: CLASSES, streams: STREAMS,
      staff: [
        { id: 'stf1', firstName: 'Jane', lastName: 'Doe', role: 'teacher', isActive: true },
        { id: 'stf2', firstName: 'Bob', lastName: 'Kato', role: 'teacher', isActive: false },
      ],
    })
    const user = userEvent.setup()
    render(<DosClassesPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: /^assign$/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^assign$/i }))

    await waitFor(() => expect(screen.getByText('Assign Class Teacher')).toBeInTheDocument())
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('Bob Kato')).not.toBeInTheDocument()
  })
})
