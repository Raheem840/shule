import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (t: string, r: any) => { tableData[t] = r }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  function makeBuilder(table: string) {
    const b: any = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(), upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
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
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: mockFrom,
  },
}))

const authState: { role: string } = { role: 'teacher' }
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'teacher-auth-1', role: authState.role, schoolId: 'school-1', name: 'T', email: 't@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useTeacherEvents, useCreateEvent, useStudentSchoolEvents } from '../../hooks/useTeacherEvents'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses(); authState.role = 'teacher' })

describe('useTeacherEvents', () => {
  it('returns empty array when staff row not found', async () => {
    setResponse('staff', { data: null, error: null })
    const { result } = renderHook(() => useTeacherEvents(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('maps school_events row fields correctly', async () => {
    setResponse('staff', { data: { id: 'staff-1' }, error: null })
    setResponse('school_events', { data: [{
      id: 'ev-1', school_id: 'school-1',
      title: 'Mid-Term Exam', event_date: '2025-03-10', event_type: 'exam',
      description: null, subject_id: 'sub-1', class_id: 'cls-1', stream_id: null,
      total_marks: 80, pass_mark: 40, journaled: false, journal_id: null,
      created_by: 'staff-1', term: '1', year: 2025, created_at: '2025-01-01T00:00:00Z',
    }], error: null })
    const { result } = renderHook(() => useTeacherEvents(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const ev = result.current.data![0]
    expect(ev.title).toBe('Mid-Term Exam')
    expect(ev.eventDate).toBe('2025-03-10')
    expect(ev.journaled).toBe(false)
  })

  it('returns empty array when table does not exist (42P01)', async () => {
    setResponse('staff', { data: { id: 'staff-1' }, error: null })
    setResponse('school_events', { data: null, error: { code: '42P01', message: 'not found' } })
    const { result } = renderHook(() => useTeacherEvents(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useCreateEvent', () => {
  it('inserts into school_events with correct fields', async () => {
    setResponse('staff', { data: { id: 'staff-1' }, error: null })
    setResponse('school_events', { data: null, error: null })
    const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Biology Exam', eventType: 'exam',
        subjectId: 'sub-1', classId: 'cls-1', streamId: null,
        eventDate: '2025-03-20', totalMarks: 80, passMark: 40,
        description: null, term: '1', year: 2025,
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('school_events')
  })

  it('throws when staff record not found', async () => {
    setResponse('staff', { data: null, error: null })
    const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: 'X', eventType: 'exam', subjectId: null, classId: null, streamId: null,
          eventDate: '2025-03-20', totalMarks: null, passMark: null,
          description: null, term: null, year: null,
        }),
      ).rejects.toThrow('Staff record not found')
    })
  })

  it('throws friendly error when school_events table not yet created', async () => {
    setResponse('staff', { data: { id: 'staff-1' }, error: null })
    setResponse('school_events', { data: null, error: { code: '42P01', message: 'not found' } })
    const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: 'X', eventType: 'exam', subjectId: null, classId: null, streamId: null,
          eventDate: '2025-03-20', totalMarks: null, passMark: null,
          description: null, term: null, year: null,
        }),
      ).rejects.toThrow('Events table not yet created')
    })
  })

  it('notifies every active student (not just DoS/Principal) for a general (no-class) event created by the principal', async () => {
    authState.role = 'principal'
    setResponse('staff', { data: { id: 'staff-principal' }, error: null })
    setResponse('school_events', { data: null, error: null })
    setResponse('students', { data: [
      { auth_user_id: 'stu-auth-1' }, { auth_user_id: 'stu-auth-2' },
    ], error: null })
    setResponse('staff', { data: { id: 'staff-principal' }, error: null }) // re-set: also read for DoS/Principal lookup

    const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        title: 'School Assembly', eventType: 'general', subjectId: null, classId: null, streamId: null,
        eventDate: '2025-03-20', totalMarks: null, passMark: null,
        description: null, term: null, year: null,
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // students table must have been queried (school-wide broadcast) when classId is null and role is principal
    expect(mockFrom).toHaveBeenCalledWith('students')
  })

  it('does NOT broadcast to every student for a general (no-class) event created by a regular teacher', async () => {
    authState.role = 'teacher'
    setResponse('staff', { data: { id: 'staff-1' }, error: null })
    setResponse('school_events', { data: null, error: null })

    const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        title: 'Random note', eventType: 'general', subjectId: null, classId: null, streamId: null,
        eventDate: '2025-03-20', totalMarks: null, passMark: null,
        description: null, term: null, year: null,
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // A regular teacher leaving classId blank must not trigger a school-wide student broadcast.
    const studentsCalls = mockFrom.mock.calls.filter(c => c[0] === 'students')
    expect(studentsCalls.length).toBe(0)
  })
})

describe('useStudentSchoolEvents', () => {
  it('is enabled only for the student role', () => {
    authState.role = 'teacher'
    const { result } = renderHook(() => useStudentSchoolEvents('cls-1'), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('queries visible_to_parents=true and scopes to general (no-class) events plus the student\'s own class', async () => {
    authState.role = 'student'
    setResponse('school_events', {
      data: [{
        id: 'ev-1', school_id: 'school-1', title: 'Sports Day', event_date: '2025-04-01',
        event_type: 'sport', description: null, subject_id: null, class_id: null, stream_id: null,
        total_marks: null, pass_mark: null, journaled: false, journal_id: null, created_by: null,
        term: null, year: null, created_at: '2025-01-01T00:00:00Z', visible_to_parents: true,
        subjects: null, classes: null, streams: null, creator: null,
      }],
      error: null,
    })

    const { result } = renderHook(() => useStudentSchoolEvents('cls-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].visibleToParents).toBe(true)

    const callIdx = mockFrom.mock.calls.findIndex(c => c[0] === 'school_events')
    const builder = mockFrom.mock.results[callIdx].value
    expect(builder.eq).toHaveBeenCalledWith('visible_to_parents', true)
    expect(builder.or).toHaveBeenCalledWith('class_id.is.null,class_id.eq.cls-1')
  })

  it('falls back to only general events (class_id null) when the student has no class yet', async () => {
    authState.role = 'student'
    setResponse('school_events', { data: [], error: null })

    const { result } = renderHook(() => useStudentSchoolEvents(null), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const callIdx = mockFrom.mock.calls.findIndex(c => c[0] === 'school_events')
    const builder = mockFrom.mock.results[callIdx].value
    expect(builder.is).toHaveBeenCalledWith('class_id', null)
  })
})
