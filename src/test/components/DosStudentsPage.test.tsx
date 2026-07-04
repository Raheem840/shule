// DosStudentsPage — two internal (non-exported) behaviours covered here:
// 1. useExamAgg() filters exam_results to only PUBLISHED exam_journal rows
//    before computing the Class × Subject Avg Score heatmap.
// 2. unassignedCount (active students with classId === null) renders an
//    "Unassigned" bar + a warning note in the Enrolment by Class widget.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (t: string, r: any) => { tableData[t] = r }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  function makeBuilder(table: string) {
    const b: any = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then: (res: any, rej?: any) => Promise.resolve(tableData[table] ?? { data: [], error: null }).then(res, rej),
    }
    return b
  }
  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
    from: mockFrom,
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

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses:  vi.fn(),
  useStreams:  vi.fn(),
  useSubjects: vi.fn(),
}))

import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { DosStudentsPage } from '../../pages/dos/DosStudentsPage'

const mockStudents = useStudents as ReturnType<typeof vi.fn>
const mockClasses  = useClasses  as ReturnType<typeof vi.fn>
const mockStreams  = useStreams  as ReturnType<typeof vi.fn>
const mockSubjects = useSubjects as ReturnType<typeof vi.fn>

const CLASSES  = [{ id: 'cls-1', name: 'S.1', level: '1', schoolId: 's1', academicYearId: 'ay1' }]
const SUBJECTS = [{ id: 'sub-1', name: 'Math', schoolId: 's1', departmentId: null, curriculumCode: null, level: null, isActive: true }]

function makeStudent(over: Partial<any> = {}) {
  return {
    id: 'stu-1', firstName: 'Grace', lastName: 'Apio', admissionNumber: 'KAB/2026/001',
    classId: 'cls-1', streamId: null, gender: 'female', studentType: 'day',
    enrolledAt: '2026-01-10', ...over,
  }
}

function setupBaseMocks(students: any[]) {
  mockStudents.mockReturnValue({ data: students, isLoading: false })
  mockClasses.mockReturnValue({ data: CLASSES })
  mockStreams.mockReturnValue({ data: [] })
  mockSubjects.mockReturnValue({ data: SUBJECTS })
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
  setResponse('attendance', { data: [], error: null })
})

describe('DosStudentsPage — view student navigation', () => {
  it('navigates to the shared academics-only profile route when a student card is clicked', async () => {
    setupBaseMocks([makeStudent({ id: 'stu-1', firstName: 'Grace', lastName: 'Apio' })])
    setResponse('exam_journal', { data: [], error: null })
    setResponse('exam_results', { data: [], error: null })

    render(<DosStudentsPage />)

    await waitFor(() => expect(screen.getByText('Grace Apio')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Grace Apio').closest('div[style*="cursor: pointer"]')!)

    expect(mockNavigate).toHaveBeenCalledWith('/dos/students/stu-1')
  })
})

describe('DosStudentsPage — exam aggregate only counts published journals', () => {
  it('heatmap cell shows the published score (80%), not an average with the draft (20%) score', async () => {
    setupBaseMocks([makeStudent({ id: 'stu-1' }), makeStudent({ id: 'stu-2' })])

    // Only j-pub is published
    setResponse('exam_journal', { data: [{ id: 'j-pub' }], error: null })
    setResponse('exam_results', {
      data: [
        { student_id: 'stu-1', score: 80, exam_journal_id: 'j-pub',   exam_journal: { class_id: 'cls-1', subject_id: 'sub-1' } },
        { student_id: 'stu-2', score: 20, exam_journal_id: 'j-draft', exam_journal: { class_id: 'cls-1', subject_id: 'sub-1' } },
      ],
      error: null,
    })

    render(<DosStudentsPage />)

    // Scope to the heatmap row (identified by the subject name "Math",
    // which only appears in the heatmap, not in the student cards).
    await waitFor(() => {
      expect(screen.getByText('Math')).toBeInTheDocument()
    })
    const heatmapRow = screen.getByText('Math').closest('tr')!
    expect(heatmapRow.textContent).toContain('80%')
    // Neither the draft-only score nor the naive average of both should appear
    expect(heatmapRow.textContent).not.toContain('20%')
    expect(heatmapRow.textContent).not.toContain('50%')
  })
})

describe('DosStudentsPage — unassignedCount warning', () => {
  it('shows "no class assigned" warning and an Unassigned bar when some students have no classId', async () => {
    setupBaseMocks([
      makeStudent({ id: 'stu-1', classId: 'cls-1' }),
      makeStudent({ id: 'stu-2', classId: null }),
    ])
    setResponse('exam_journal', { data: [], error: null })
    setResponse('exam_results', { data: [], error: null })

    render(<DosStudentsPage />)

    await waitFor(() => {
      expect(screen.getByText(/no class assigned/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('does not show the warning when all active students have a classId', async () => {
    setupBaseMocks([
      makeStudent({ id: 'stu-1', classId: 'cls-1' }),
      makeStudent({ id: 'stu-2', classId: 'cls-1' }),
    ])
    setResponse('exam_journal', { data: [], error: null })
    setResponse('exam_results', { data: [], error: null })

    render(<DosStudentsPage />)

    // Wait for the page to settle past the loading state
    await waitFor(() => {
      expect(screen.getByText('Enrolment by Class')).toBeInTheDocument()
    })
    expect(screen.queryByText(/no class assigned/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument()
  })
})
