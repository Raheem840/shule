// DosCurriculumPage — new "Covered By" column resolves topic.coveredBy
// (an auth_user_id) through a teacherNameByAuthId map built from useStaff().
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
  useMarkTopicCovered:  vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses:  vi.fn(),
  useSubjects: vi.fn(),
}))

vi.mock('../../hooks/useStaff', () => ({
  useStaff: vi.fn(),
}))

import { useDosCurriculumPlan, useMarkTopicCovered } from '../../hooks/useDos'
import { useClasses, useSubjects } from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import { DosCurriculumPage } from '../../pages/dos/DosCurriculumPage'

const mockPlan     = useDosCurriculumPlan as ReturnType<typeof vi.fn>
const mockMark     = useMarkTopicCovered  as ReturnType<typeof vi.fn>
const mockClasses  = useClasses  as ReturnType<typeof vi.fn>
const mockSubjects = useSubjects as ReturnType<typeof vi.fn>
const mockStaff    = useStaff    as ReturnType<typeof vi.fn>

const CLASSES  = [{ id: 'cls-1', name: 'S.1' }]
const SUBJECTS = [{ id: 'sub-1', name: 'Math' }]

function baseTopic(over: Partial<any> = {}) {
  return {
    id: 't-1', schoolId: 's1', subjectId: 'sub-1', classId: 'cls-1',
    topicName: 'Algebra', ncdcCode: null, term: '1', year: 2026,
    plannedDate: null, coveredAt: '2026-02-01T00:00:00Z', coveredBy: 'auth-1',
    teacherId: null, sequenceOrder: 1, ...over,
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
  mockMark.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
})

describe('DosCurriculumPage — Covered By column', () => {
  it('resolves coveredBy auth_user_id to the matching staff member\'s full name', async () => {
    mockStaff.mockReturnValue({
      data: [{ id: 'staff-1', authUserId: 'auth-1', firstName: 'Jane', lastName: 'Doe' }],
    })
    mockPlan.mockReturnValue({ data: [baseTopic()], isLoading: false, isError: false })

    render(<DosCurriculumPage />)
    await selectClassAndSubject()

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
  })

  it('shows "—" when coveredBy does not match any staff member, without crashing', async () => {
    mockStaff.mockReturnValue({
      data: [{ id: 'staff-1', authUserId: 'auth-other', firstName: 'John', lastName: 'Mugisha' }],
    })
    mockPlan.mockReturnValue({ data: [baseTopic({ coveredBy: 'auth-unknown' })], isLoading: false, isError: false })

    render(<DosCurriculumPage />)
    await selectClassAndSubject()

    await waitFor(() => {
      expect(screen.getByText('Algebra')).toBeInTheDocument()
    })
    expect(screen.queryByText('John Mugisha')).not.toBeInTheDocument()
    // The Covered By cell for this row should render the placeholder dash
    const row = screen.getByText('Algebra').closest('tr')!
    expect(row.textContent).toContain('—')
  })
})
