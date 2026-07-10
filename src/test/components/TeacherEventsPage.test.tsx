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
    user: { id: 'u1', role: 'teacher', schoolId: 's1', name: 'T', email: 't@k.ug', staffId: 'st-teacher-1' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useClasses', () => ({
  useMyAssignedClasses:  vi.fn().mockReturnValue([]),
  useMyAssignedSubjects: vi.fn().mockReturnValue([]),
  useStreams:             vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

vi.mock('../../hooks/useTeacherEvents', () => ({
  useAllSchoolEvents: vi.fn(),
  useCreateEvent:     vi.fn(),
  useUpdateEvent:     vi.fn(),
  useDeleteEvent:     vi.fn(),
}))

// Mock EventTimeline so this test focuses on the page shell, not the timeline internals
vi.mock('../../components/shared/EventTimeline', () => ({
  EventTimeline: ({ events, isLoading, emptyTitle, emptyBody }: any) => {
    if (isLoading) return <div data-testid="timeline-loading">Loading events…</div>
    if (events.length === 0) return (
      <div data-testid="timeline-empty">
        <div>{emptyTitle}</div>
        <div>{emptyBody}</div>
      </div>
    )
    return (
      <div data-testid="timeline-list">
        {events.map((e: any) => (
          <div key={e.id} data-testid="event-card">
            <span>{e.title}</span>
            {e.createdByName && <span data-testid="creator-name">{e.createdByName}</span>}
          </div>
        ))}
      </div>
    )
  },
  typeColor:           () => '#0d9488',
  ALL_EVENT_TYPES:     [{ value: 'exam', label: 'Exam', color: '#0d9488' }],
  TEACHER_EVENT_TYPES: [{ value: 'exam', label: 'Exam', color: '#0d9488' }],
  daysUntil:           (date: string) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)),
  localToday:          () => new Date().toISOString().slice(0, 10),
}))

import { useAllSchoolEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '../../hooks/useTeacherEvents'
import { useMyAssignedClasses } from '../../hooks/useClasses'
import { TeacherEventsPage } from '../../pages/teacher/TeacherEventsPage'

const mockAllEvents  = useAllSchoolEvents as ReturnType<typeof vi.fn>
const mockCreate     = useCreateEvent      as ReturnType<typeof vi.fn>
const mockUpdate     = useUpdateEvent      as ReturnType<typeof vi.fn>
const mockDelete     = useDeleteEvent      as ReturnType<typeof vi.fn>
const mockMyClasses  = useMyAssignedClasses as ReturnType<typeof vi.fn>

// A future date so it appears in "upcoming" filter
const FUTURE_DATE = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

const SAMPLE_EVENTS = [
  {
    id: 'ev1',
    title: 'End of Term Exam',
    eventType: 'exam',
    eventDate: FUTURE_DATE,
    classId: 'c1',
    streamId: null,
    subjectId: 'sub1',
    createdBy: 'st-teacher-1',
    createdByName: 'Alice Teacher',
    totalMarks: 100,
    passMark: 50,
    description: null,
    term: '1',
    year: 2026,
    journaled: false,
    visibleToParents: false,
  },
]

function setupMocks(opts: { events?: any[]; isLoading?: boolean } = {}) {
  mockAllEvents.mockReturnValue({ data: opts.events ?? [], isLoading: opts.isLoading ?? false })
  mockCreate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockUpdate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  mockDelete.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
}

beforeEach(() => vi.clearAllMocks())

describe('TeacherEventsPage', () => {
  it('renders the "My Events" header for a teacher user', () => {
    setupMocks()
    render(<TeacherEventsPage />)
    expect(screen.getByText('My Events')).toBeInTheDocument()
  })

  it('renders "Create Event" button', () => {
    setupMocks()
    render(<TeacherEventsPage />)
    expect(screen.getByRole('button', { name: /create event/i })).toBeInTheDocument()
  })

  it('shows KPI cards when events are loaded', () => {
    setupMocks({ events: SAMPLE_EVENTS })
    render(<TeacherEventsPage />)
    // KPI labels appear together with the time-filter buttons — use getAllBy for duplicates
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('This Week')).toBeInTheDocument()
    // "Past" appears in both KPI card and time-filter button
    expect(screen.getAllByText('Past').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Need Journaling')).toBeInTheDocument()
  })

  it('shows empty state when there are no upcoming events', () => {
    setupMocks({ events: [] })
    render(<TeacherEventsPage />)
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument()
    expect(screen.getByText(/no upcoming events/i)).toBeInTheDocument()
  })

  it('renders event title when events exist', () => {
    setupMocks({ events: SAMPLE_EVENTS })
    render(<TeacherEventsPage />)
    expect(screen.getByText('End of Term Exam')).toBeInTheDocument()
  })

  it('shows creator name on event card', () => {
    setupMocks({ events: SAMPLE_EVENTS })
    render(<TeacherEventsPage />)
    expect(screen.getByTestId('creator-name')).toHaveTextContent('Alice Teacher')
  })

  it('time filter buttons are visible', () => {
    setupMocks()
    render(<TeacherEventsPage />)
    expect(screen.getByRole('button', { name: /upcoming/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /all events/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /past/i })).toBeInTheDocument()
  })

  it('clicking Create Event button opens the create modal', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<TeacherEventsPage />)

    await user.click(screen.getByRole('button', { name: /create event/i }))

    await waitFor(() => {
      // Modal's Title input placeholder is unique — confirms modal opened
      expect(screen.getByPlaceholderText(/mathematics end of term/i)).toBeInTheDocument()
      // Modal subtitle text
      expect(screen.getByText(/plan an upcoming event/i)).toBeInTheDocument()
    })
  })

  it('switching to "All Events" filter shows all events', async () => {
    // Put one event in the past so it normally wouldn't show under "upcoming"
    const PAST_EVENT = {
      ...SAMPLE_EVENTS[0],
      id: 'ev-past',
      title: 'Past Quiz',
      eventDate: '2024-01-01',
      journaled: true,
    }
    setupMocks({ events: [PAST_EVENT] })
    const user = userEvent.setup()
    render(<TeacherEventsPage />)

    // Under "upcoming" filter, past event is hidden
    expect(screen.queryByText('Past Quiz')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /all events/i }))
    await waitFor(() => {
      expect(screen.getByText('Past Quiz')).toBeInTheDocument()
    })
  })

  it('shows loading state while events are fetching', () => {
    // isLoading = true means KPI cards are hidden, but loading timeline shows
    setupMocks({ isLoading: true })
    render(<TeacherEventsPage />)
    expect(screen.getByTestId('timeline-loading')).toBeInTheDocument()
  })
})

describe('TeacherEventsPage — visibility scoping', () => {
  const OTHER_TEACHER_UNASSIGNED_CLASS_EVENT = {
    ...SAMPLE_EVENTS[0],
    id: 'ev-other',
    title: 'Other Teacher Quiz',
    classId: 'c-not-mine',
    createdBy: 'st-other-teacher',
    createdByName: 'Bob Other',
  }
  const GENERAL_EVENT = {
    ...SAMPLE_EVENTS[0],
    id: 'ev-general',
    title: 'School Assembly',
    classId: null,
    createdBy: 'st-principal',
    createdByName: 'The Principal',
  }
  const MY_ASSIGNED_CLASS_EVENT = {
    ...SAMPLE_EVENTS[0],
    id: 'ev-assigned',
    title: 'DOS Test For My Class',
    classId: 'c-mine',
    createdBy: 'st-dos',
    createdByName: 'The DOS',
  }

  it('hides another teacher\'s event on a class I am not assigned to', () => {
    setupMocks({ events: [OTHER_TEACHER_UNASSIGNED_CLASS_EVENT] })
    render(<TeacherEventsPage />)
    expect(screen.queryByText('Other Teacher Quiz')).not.toBeInTheDocument()
  })

  it('shows a general event (no class attached) regardless of who created it', () => {
    setupMocks({ events: [GENERAL_EVENT] })
    render(<TeacherEventsPage />)
    expect(screen.getByText('School Assembly')).toBeInTheDocument()
  })

  it('shows my own event even on a class I am not assigned to', () => {
    setupMocks({ events: [{ ...OTHER_TEACHER_UNASSIGNED_CLASS_EVENT, id: 'ev-mine-elsewhere', title: 'My Own Event Elsewhere', createdBy: 'st-teacher-1' }] })
    render(<TeacherEventsPage />)
    expect(screen.getByText('My Own Event Elsewhere')).toBeInTheDocument()
  })

  it('shows another staff member\'s event on a class I AM assigned to', () => {
    mockMyClasses.mockReturnValue([{ id: 'c-mine', name: 'S.1' }])
    setupMocks({ events: [MY_ASSIGNED_CLASS_EVENT] })
    render(<TeacherEventsPage />)
    expect(screen.getByText('DOS Test For My Class')).toBeInTheDocument()
    mockMyClasses.mockReturnValue([])
  })
})
