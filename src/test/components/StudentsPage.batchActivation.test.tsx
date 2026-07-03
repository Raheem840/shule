// StudentsPage's BatchActivationBar previously called create-student-auth-user
// without a `password` field, which the edge function rejects outright
// ("Missing required fields") — every secretary-side bulk activation silently
// failed. This verifies the invoke body now always includes a password.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import type { Student } from '../../types/app'

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: mockInvoke },
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'secretary', schoolId: 'school-1', name: 'Secretary', email: 'sec@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

const { student } = vi.hoisted(() => ({
  student: {
    id: 'stu-1', schoolId: 'school-1', admissionNumber: 'KAB/2026/0001',
    firstName: 'Grace', lastName: 'Apio', dob: null, gender: 'female',
    classId: 'c1', streamId: null, photoUrl: null, medicalNotes: null,
    status: 'active', enrolledAt: '2026-01-15T00:00:00Z', createdBy: null,
    nationality: 'Ugandan', religion: null, studentType: 'day', previousSchool: null,
    authUserId: null,
  } satisfies Student,
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn().mockReturnValue({ data: [student], isLoading: false }),
  useStudentById: vi.fn().mockReturnValue({ data: null, isLoading: false }),
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn().mockReturnValue({ data: [{ id: 'c1', name: 'S1' }], isLoading: false }),
  useStreams: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

vi.mock('../../hooks/useParentPortal', () => ({
  useGenerateParentAccess: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../../hooks/useStaffAuth', () => ({
  useSendCredentialsSms: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}))

import { StudentsPage } from '../../pages/secretary/StudentsPage'

beforeEach(() => { mockInvoke.mockClear() })

describe('StudentsPage — batch activation', () => {
  it('includes a generated password in the create-student-auth-user call', async () => {
    render(<StudentsPage onRegister={() => {}} onImport={() => {}} onView={() => {}} />)

    fireEvent.click(screen.getByTestId('select-student-stu-1'))
    fireEvent.click(await screen.findByText(/Activate 1 Account/i))

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'create-student-auth-user',
      expect.objectContaining({
        body: expect.objectContaining({
          studentId: 'stu-1',
          schoolId: 'school-1',
          password: expect.stringMatching(/.+/),
        }),
      }),
    ))
  })
})
