import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// Virtualizer: always render all items regardless of container height
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 90, size: 90, key: i })),
    getTotalSize: () => count * 90,
  }),
}))

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
    user: { id: 'u1', role: 'teacher', schoolId: 's1', name: 'T', email: 't@k.ug', staffId: 'st1' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useClasses', () => ({
  useMyAssignedClasses: vi.fn(),
  useStreams:           vi.fn(),
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn(),
}))

vi.mock('../../hooks/useTeacherRemarks', () => ({
  useTeacherRemarks: vi.fn(),
  useSaveRemarks:    vi.fn(),
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

// Render TermPicker as a plain select so tests can interact with it
vi.mock('../../components/ui/TermPicker', () => ({
  TermPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="term-picker" value={value} onChange={e => onChange(e.target.value)}>
      {['1', '2', '3'].map(t => <option key={t} value={t}>Term {t}</option>)}
    </select>
  ),
}))

import { useMyAssignedClasses, useStreams } from '../../hooks/useClasses'
import { useStudents }                       from '../../hooks/useStudents'
import { useTeacherRemarks, useSaveRemarks } from '../../hooks/useTeacherRemarks'
import { TeacherRemarksPage }                from '../../pages/teacher/TeacherRemarksPage'

const mockMyClasses     = useMyAssignedClasses as ReturnType<typeof vi.fn>
const mockStreams        = useStreams            as ReturnType<typeof vi.fn>
const mockStudents      = useStudents           as ReturnType<typeof vi.fn>
const mockRemarks       = useTeacherRemarks     as ReturnType<typeof vi.fn>
const mockSaveRemarks   = useSaveRemarks        as ReturnType<typeof vi.fn>

const CLASSES = [{ id: 'c1', name: 'S.1' }]
const STUDENTS = [
  { id: 's1', firstName: 'Alice', lastName: 'Apio',   admissionNumber: 'SCH/2024/001', streamId: null },
  { id: 's2', firstName: 'Bob',   lastName: 'Okello', admissionNumber: 'SCH/2024/002', streamId: null },
]

function setupMocks(opts: {
  students?: any[]
  studentsLoading?: boolean
  mutateAsyncFn?: ReturnType<typeof vi.fn>
} = {}) {
  const mutateAsyncFn = opts.mutateAsyncFn ?? vi.fn().mockResolvedValue(undefined)
  mockMyClasses.mockReturnValue(CLASSES)
  mockStreams.mockReturnValue({ data: [], isLoading: false })
  mockStudents.mockReturnValue({ data: opts.students ?? [], isLoading: opts.studentsLoading ?? false })
  mockRemarks.mockReturnValue({ data: new Map(), isLoading: false })
  mockSaveRemarks.mockReturnValue({ mutateAsync: mutateAsyncFn, isPending: false, isError: false })
  return { mutateAsyncFn }
}

beforeEach(() => vi.clearAllMocks())

describe('TeacherRemarksPage', () => {
  it('renders the page header', () => {
    setupMocks()
    render(<TeacherRemarksPage />)
    expect(screen.getByText('Teacher Remarks')).toBeInTheDocument()
  })

  it('shows "Select a term and class" prompt when no class is selected', () => {
    setupMocks()
    render(<TeacherRemarksPage />)
    expect(screen.getByText(/select a term and class to get started/i)).toBeInTheDocument()
  })

  it('renders Save All Remarks button', () => {
    setupMocks()
    render(<TeacherRemarksPage />)
    expect(screen.getByRole('button', { name: /save all remarks/i })).toBeInTheDocument()
  })

  it('Save All Remarks button is disabled when no class is selected', () => {
    setupMocks()
    render(<TeacherRemarksPage />)
    expect(screen.getByRole('button', { name: /save all remarks/i })).toBeDisabled()
  })

  it('renders class selector dropdown', () => {
    setupMocks()
    render(<TeacherRemarksPage />)
    expect(screen.getByText('Select class')).toBeInTheDocument()
    expect(screen.getByText('S.1')).toBeInTheDocument()
  })

  it('hides prompt and shows student list after selecting a class', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<TeacherRemarksPage />)

    const classSelect = screen.getByDisplayValue('Select class')
    await user.selectOptions(classSelect, 'c1')

    await waitFor(() => {
      expect(screen.queryByText(/select a term and class to get started/i)).not.toBeInTheDocument()
      expect(screen.getByText('Alice Apio')).toBeInTheDocument()
      expect(screen.getByText('Bob Okello')).toBeInTheDocument()
    })
  })

  it('shows textarea for each student remark', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<TeacherRemarksPage />)

    await user.selectOptions(screen.getByDisplayValue('Select class'), 'c1')

    await waitFor(() => {
      const textareas = screen.getAllByRole('textbox')
      // At least one textarea per student
      expect(textareas.length).toBeGreaterThanOrEqual(STUDENTS.length)
    })
  })

  it('Save All Remarks button is enabled after class is selected with students', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<TeacherRemarksPage />)

    await user.selectOptions(screen.getByDisplayValue('Select class'), 'c1')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save all remarks/i })).not.toBeDisabled()
    })
  })

  it('Save All Remarks calls mutateAsync', async () => {
    const mutateAsyncFn = vi.fn().mockResolvedValue(undefined)
    setupMocks({ students: STUDENTS, mutateAsyncFn })
    const user = userEvent.setup()
    render(<TeacherRemarksPage />)

    await user.selectOptions(screen.getByDisplayValue('Select class'), 'c1')
    await waitFor(() => expect(screen.getByRole('button', { name: /save all remarks/i })).not.toBeDisabled())

    await user.click(screen.getByRole('button', { name: /save all remarks/i }))
    expect(mutateAsyncFn).toHaveBeenCalledOnce()
    expect(mutateAsyncFn).toHaveBeenCalledWith(
      expect.objectContaining({ classId: 'c1', term: '1' })
    )
  })

  it('continues showing the "get started" prompt when class has no students', async () => {
    // The page defines ready = !!classId && students.length > 0
    // So with classId set but 0 students, ready stays false and the prompt remains
    setupMocks({ students: [] })
    const user = userEvent.setup()
    render(<TeacherRemarksPage />)

    await user.selectOptions(screen.getByDisplayValue('Select class'), 'c1')
    // Nothing new appears — the prompt is still visible
    await waitFor(() => {
      expect(screen.getByText(/select a term and class to get started/i)).toBeInTheDocument()
    })
  })

  it('shows progress stats (With Remarks / Missing) once students are loaded', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<TeacherRemarksPage />)

    await user.selectOptions(screen.getByDisplayValue('Select class'), 'c1')
    await waitFor(() => {
      expect(screen.getByText(/with remarks/i)).toBeInTheDocument()
      expect(screen.getByText(/missing/i)).toBeInTheDocument()
    })
  })

  it('shows pre-saved remarks from DB in the textarea', async () => {
    const savedRemarks = new Map([['s1', { remarks: 'Great student' }]])
    mockRemarks.mockReturnValue({ data: savedRemarks, isLoading: false })
    setupMocks({ students: STUDENTS })
    // Override remarks mock after setupMocks
    mockRemarks.mockReturnValue({ data: savedRemarks, isLoading: false })

    const user = userEvent.setup()
    render(<TeacherRemarksPage />)

    await user.selectOptions(screen.getByDisplayValue('Select class'), 'c1')
    await waitFor(() => {
      expect(screen.getByDisplayValue('Great student')).toBeInTheDocument()
    })
  })
})
