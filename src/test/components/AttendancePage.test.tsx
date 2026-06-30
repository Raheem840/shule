import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// Virtualizer: always render all items regardless of container height
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 60, size: 60, key: i })),
    getTotalSize: () => count * 60,
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

vi.mock('../../hooks/useAttendance', () => ({
  useAttendance:          vi.fn(),
  useClassTermAttendance: vi.fn(),
  useSaveAttendance:      vi.fn(),
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('../../components/shared/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}))

import { useMyAssignedClasses, useStreams }              from '../../hooks/useClasses'
import { useStudents }                                    from '../../hooks/useStudents'
import { useAttendance, useClassTermAttendance, useSaveAttendance } from '../../hooks/useAttendance'
import { AttendancePage }                                from '../../pages/teacher/AttendancePage'

const mockMyClasses      = useMyAssignedClasses  as ReturnType<typeof vi.fn>
const mockStreams         = useStreams             as ReturnType<typeof vi.fn>
const mockStudents       = useStudents            as ReturnType<typeof vi.fn>
const mockAttendance     = useAttendance          as ReturnType<typeof vi.fn>
const mockTermAttendance = useClassTermAttendance as ReturnType<typeof vi.fn>
const mockSaveAttendance = useSaveAttendance      as ReturnType<typeof vi.fn>

const CLASSES = [{ id: 'c1', name: 'S.1' }]
const STUDENTS = [
  { id: 's1', firstName: 'Alice', lastName: 'Apio',   admissionNumber: 'SCH/2024/001', photoUrl: null, streamId: null },
  { id: 's2', firstName: 'Bob',   lastName: 'Okello', admissionNumber: 'SCH/2024/002', photoUrl: null, streamId: null },
]

function setupMocks(opts: {
  students?: any[]
  studentsLoading?: boolean
  mutateFn?: ReturnType<typeof vi.fn>
} = {}) {
  const mutateFn = opts.mutateFn ?? vi.fn()
  mockMyClasses.mockReturnValue(CLASSES)
  mockStreams.mockReturnValue({ data: [], isLoading: false })
  mockStudents.mockReturnValue({ data: opts.students ?? [], isLoading: opts.studentsLoading ?? false })
  mockAttendance.mockReturnValue({ data: null })
  mockTermAttendance.mockReturnValue({ data: [] })
  mockSaveAttendance.mockReturnValue({ mutate: mutateFn, isPending: false })
  return { mutateFn }
}

beforeEach(() => vi.clearAllMocks())

describe('AttendancePage', () => {
  it('renders the page header', () => {
    setupMocks()
    render(<AttendancePage />)
    expect(screen.getByText('Attendance')).toBeInTheDocument()
  })

  it('shows "Select a class" prompt when no class is selected', () => {
    setupMocks()
    render(<AttendancePage />)
    expect(screen.getByText(/select a class to take attendance/i)).toBeInTheDocument()
  })

  it('renders class selector dropdown with options', () => {
    setupMocks()
    render(<AttendancePage />)
    const select = screen.getByDisplayValue('All classes')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('S.1')).toBeInTheDocument()
  })

  it('renders date picker input', () => {
    setupMocks()
    render(<AttendancePage />)
    // The date input is a type="date" input — no aria label, find by type
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument()
  })

  it('hides "Select a class" prompt and shows Save button after selecting a class', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<AttendancePage />)

    await user.selectOptions(screen.getByDisplayValue('All classes'), 'c1')

    await waitFor(() => {
      expect(screen.queryByText(/select a class to take attendance/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save attendance/i })).toBeInTheDocument()
    })
  })

  it('renders student names in attendance list after class selection', async () => {
    setupMocks({ students: STUDENTS })
    const user = userEvent.setup()
    render(<AttendancePage />)

    await user.selectOptions(screen.getByDisplayValue('All classes'), 'c1')

    await waitFor(() => {
      // Each student name appears at least once (once in Avatar, once in the row text)
      expect(screen.getAllByText('Alice Apio').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Bob Okello').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('Save Attendance button calls the mutate function', async () => {
    const mutateFn = vi.fn()
    setupMocks({ students: STUDENTS, mutateFn })
    const user = userEvent.setup()
    render(<AttendancePage />)

    await user.selectOptions(screen.getByDisplayValue('All classes'), 'c1')
    await waitFor(() => expect(screen.getByRole('button', { name: /save attendance/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /save attendance/i }))
    expect(mutateFn).toHaveBeenCalledOnce()
    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({ classId: 'c1' }),
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
  })

  it('shows Edit Attendance button after successful save (read-only state)', async () => {
    // Mutate calls onSuccess immediately so the page enters read-only
    const mutateFn = vi.fn((_data: any, callbacks: any) => { callbacks?.onSuccess?.() })
    setupMocks({ students: STUDENTS, mutateFn })
    const user = userEvent.setup()
    render(<AttendancePage />)

    await user.selectOptions(screen.getByDisplayValue('All classes'), 'c1')
    await waitFor(() => expect(screen.getByRole('button', { name: /save attendance/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /save attendance/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit attendance/i })).toBeInTheDocument()
    })
  })

  it('Save Attendance button disappears and Edit button appears after save', async () => {
    const mutateFn = vi.fn((_data: any, callbacks: any) => { callbacks?.onSuccess?.() })
    setupMocks({ students: STUDENTS, mutateFn })
    const user = userEvent.setup()
    render(<AttendancePage />)

    await user.selectOptions(screen.getByDisplayValue('All classes'), 'c1')
    await waitFor(() => expect(screen.getByRole('button', { name: /save attendance/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /save attendance/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save attendance/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit attendance/i })).toBeInTheDocument()
    })
  })

  it('clicking Edit Attendance re-enables the form (save button reappears)', async () => {
    const mutateFn = vi.fn((_data: any, callbacks: any) => { callbacks?.onSuccess?.() })
    setupMocks({ students: STUDENTS, mutateFn })
    const user = userEvent.setup()
    render(<AttendancePage />)

    await user.selectOptions(screen.getByDisplayValue('All classes'), 'c1')
    await waitFor(() => expect(screen.getByRole('button', { name: /save attendance/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /save attendance/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /edit attendance/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit attendance/i }))
    await waitFor(() => {
      // After editing, the save/saved button reappears and edit button is hidden
      expect(screen.queryByRole('button', { name: /edit attendance/i })).not.toBeInTheDocument()
      // The save button shows "Saved" (saved=true from the previous save, isReadOnly=false)
      expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument()
    })
  })

  it('shows "No students found" when class has no students', async () => {
    setupMocks({ students: [] })
    const user = userEvent.setup()
    render(<AttendancePage />)

    await user.selectOptions(screen.getByDisplayValue('All classes'), 'c1')
    await waitFor(() => {
      expect(screen.getByText(/no students found/i)).toBeInTheDocument()
    })
  })
})
