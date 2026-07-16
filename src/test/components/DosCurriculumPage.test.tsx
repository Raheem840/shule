// DosCurriculumPage — "Covered By" column renders topic.coveredByName, which
// useDosCurriculumPlan resolves server-side (scoped staff lookup by
// auth_user_id), not fetched client-side from the full staff roster.
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
    user: { id: 'u1', role: 'dos', schoolId: 's1', name: 'DoS', email: 'dos@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useDos', () => ({
  useDosCurriculumPlan: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses:  vi.fn(),
  useSubjects: vi.fn(),
}))

import { useDosCurriculumPlan } from '../../hooks/useDos'
import { useClasses, useSubjects } from '../../hooks/useClasses'
import { DosCurriculumPage } from '../../pages/dos/DosCurriculumPage'

const mockPlan     = useDosCurriculumPlan as ReturnType<typeof vi.fn>
const mockClasses  = useClasses  as ReturnType<typeof vi.fn>
const mockSubjects = useSubjects as ReturnType<typeof vi.fn>

const CLASSES  = [{ id: 'cls-1', name: 'S.1' }]
const SUBJECTS = [{ id: 'sub-1', name: 'Math' }]

function baseTopic(over: Partial<any> = {}) {
  return {
    id: 't-1', schoolId: 's1', subjectId: 'sub-1', classId: 'cls-1',
    topicName: 'Algebra', ncdcCode: null, term: '1', year: 2026,
    plannedDate: null, coveredAt: '2026-02-01T00:00:00Z', coveredBy: 'auth-1',
    coveredByName: null, teacherId: null, sequenceOrder: 1, ...over,
  }
}

async function selectClassAndSubject() {
  const user = userEvent.setup()
  const selects = screen.getAllByRole('combobox')
  // Filters row order: Class, Subject, Term, Year
  await user.selectOptions(selects[0], 'cls-1')
  await user.selectOptions(selects[1], 'sub-1')
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClasses.mockReturnValue({ data: CLASSES })
  mockSubjects.mockReturnValue({ data: SUBJECTS })
})

describe('DosCurriculumPage — read-only for DoS', () => {
  it('never renders a Mark Covered action, even for an uncovered topic', async () => {
    mockPlan.mockReturnValue({ data: [baseTopic({ coveredAt: null, coveredBy: null })], isLoading: false, isError: false })

    render(<DosCurriculumPage />)
    await selectClassAndSubject()

    await waitFor(() => {
      expect(screen.getByText('Algebra')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /mark covered/i })).not.toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})

describe('DosCurriculumPage — Covered By column', () => {
  it('renders the resolved coveredByName from the hook', async () => {
    mockPlan.mockReturnValue({ data: [baseTopic({ coveredByName: 'Jane Doe' })], isLoading: false, isError: false })

    render(<DosCurriculumPage />)
    await selectClassAndSubject()

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
  })

  it('shows "—" when coveredByName is null, without crashing', async () => {
    mockPlan.mockReturnValue({ data: [baseTopic({ coveredBy: 'auth-unknown', coveredByName: null })], isLoading: false, isError: false })

    render(<DosCurriculumPage />)
    await selectClassAndSubject()

    await waitFor(() => {
      expect(screen.getByText('Algebra')).toBeInTheDocument()
    })
    // The Covered By cell for this row should render the placeholder dash
    const row = screen.getByText('Algebra').closest('tr')!
    expect(row.textContent).toContain('—')
  })
})
