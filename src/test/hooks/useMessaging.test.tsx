import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// ── Supabase mock ──────────────────────────────────────────────
const { mockFrom, setTableData, clearAll } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setTableData = (t: string, r: any) => { tableData[t] = r }
  const clearAll     = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:   vi.fn().mockReturnThis(),
      eq:       vi.fn().mockReturnThis(),
      neq:      vi.fn().mockReturnThis(),
      not:      vi.fn().mockReturnThis(),
      or:       vi.fn().mockReturnThis(),
      is:       vi.fn().mockReturnThis(),
      in:       vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      order:    vi.fn().mockReturnThis(),
      limit:    vi.fn().mockReturnThis(),
      insert:   vi.fn().mockReturnThis(),
      update:   vi.fn().mockReturnThis(),
      single:   vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
      maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })
      ),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setTableData, clearAll }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from:          mockFrom,
    channel:       vi.fn().mockReturnValue({
      on:        vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn().mockResolvedValue(undefined),
    functions:     { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}))

vi.mock('../../lib/db', () => ({
  db:        { sync_queue: { add: vi.fn().mockResolvedValue(1), where: vi.fn().mockReturnThis(), anyOf: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) } },
  queueSync: vi.fn().mockResolvedValue(undefined),
}))

// ── Auth mock — default: teacher role ────────────────────────
let mockRole = 'teacher'
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: mockRole, schoolId: 'school-1', name: 'T', email: 't@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useMessages,
  useSendMessage,
  useMarkRead,
  useAnnouncements,
  usePostAnnouncement,
  useUnreadCount,
  useParentMessagesUnreadCount,
  useParentConversations,
  useSearchStudentsForMessaging,
} from '../../hooks/useMessaging'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearAll()
  mockRole = 'teacher'
})

// ── useMessages ────────────────────────────────────────────────────────────
describe('useMessages', () => {
  it('is disabled when contactId is null', () => {
    const { result } = renderHook(
      () => useMessages(null),
      { wrapper: createWrapper() }
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('returns messages from thread as Message objects', async () => {
    setTableData('messages', {
      data: [
        {
          id: 'm1', school_id: 'school-1',
          from_user_id: 'user-1', to_user_id: 'contact-1',
          body: 'Hello!', attachment_url: null,
          sent_at: '2026-05-24T10:00:00Z', read_at: null,
        },
        {
          id: 'm2', school_id: 'school-1',
          from_user_id: 'contact-1', to_user_id: 'user-1',
          body: 'Hi back!', attachment_url: null,
          sent_at: '2026-05-24T10:01:00Z', read_at: '2026-05-24T10:02:00Z',
        },
      ],
      error: null,
    })

    const { result } = renderHook(
      () => useMessages('contact-1'),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const msgs = result.current.data!
    expect(msgs).toHaveLength(2)
    expect(msgs[0].fromUserId).toBe('user-1')
    expect(msgs[0].body).toBe('Hello!')
    expect(msgs[1].readAt).toBe('2026-05-24T10:02:00Z')
  })
})

// ── useSendMessage ─────────────────────────────────────────────────────────
describe('useSendMessage', () => {
  it('calls supabase.from(messages).insert', async () => {
    setTableData('messages', { data: null, error: null })

    const { result } = renderHook(() => useSendMessage(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ toUserId: 'contact-1', body: 'Test message' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('messages')
  })

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockImplementationOnce(() => ({
      insert: vi.fn().mockReturnThis(),
      then: (resolve: any, reject?: any) =>
        Promise.resolve({ data: null, error: { message: 'DB error' } }).then(resolve, reject),
    }))

    const { result } = renderHook(() => useSendMessage(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ toUserId: 'c1', body: 'hi' })
      ).rejects.toThrow('DB error')
    })
  })
})

// ── useMarkRead ────────────────────────────────────────────────────────────
describe('useMarkRead', () => {
  it('updates read_at for messages from a given sender', async () => {
    setTableData('messages', { data: null, error: null })

    const { result } = renderHook(() => useMarkRead(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync('contact-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('messages')
  })
})

// ── usePostAnnouncement — role restriction ─────────────────────────────────
describe('usePostAnnouncement', () => {
  it('throws when teacher role tries to post announcement', async () => {
    mockRole = 'teacher'

    const { result } = renderHook(() => usePostAnnouncement(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ body: 'School picnic cancelled' })
      ).rejects.toThrow('permission')
    })
  })

  it('throws when class_teacher role tries to post announcement', async () => {
    mockRole = 'class_teacher'

    const { result } = renderHook(() => usePostAnnouncement(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ body: 'Notice to all' })
      ).rejects.toThrow('permission')
    })
  })

  it('succeeds for principal role', async () => {
    mockRole = 'principal'
    // Announcements are stored in the messages table (is_announcement = true)
    setTableData('messages', { data: null, error: null })

    const { result } = renderHook(() => usePostAnnouncement(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ body: 'Staff meeting at 3pm' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('messages')
  })

  it('succeeds for dos role', async () => {
    mockRole = 'dos'
    setTableData('messages', { data: null, error: null })

    const { result } = renderHook(() => usePostAnnouncement(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ body: 'Exam schedule update' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

// ── useAnnouncements ───────────────────────────────────────────────────────
// Announcements now live in the messages table (is_announcement = true).
// A secondary staff query resolves from_user_id → full name.
describe('useAnnouncements', () => {
  it('returns announcement objects with correct shape', async () => {
    // messages query returns the announcement row
    setTableData('messages', {
      data: [
        {
          id: 'a1', school_id: 'school-1', from_user_id: 'principal-1',
          body: 'Term ends Friday',
          attachment_url: null, sent_at: '2026-05-24T09:00:00Z',
        },
      ],
      error: null,
    })
    // staff query resolves the name
    setTableData('staff', {
      data: [{ auth_user_id: 'principal-1', first_name: 'John', last_name: 'Doe' }],
      error: null,
    })

    const { result } = renderHook(() => useAnnouncements(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const anns = result.current.data!
    expect(anns).toHaveLength(1)
    expect(anns[0].fromName).toBe('John Doe')
    expect(anns[0].body).toBe('Term ends Friday')
  })
})

// ── useUnreadCount ─────────────────────────────────────────────────────────
// Counts unread messages FROM STAFF only — a parent/student reply should NOT
// count here (it belongs to the separate "Parent Messages" inbox instead),
// so the fixture below includes one unread row from each sender kind and
// asserts only the staff one is counted.
describe('useUnreadCount', () => {
  it('counts unread messages from staff senders only', async () => {
    setTableData('messages', {
      data: [
        { from_user_id: 'staff-auth-1' },
        { from_user_id: 'staff-auth-1' },
        { from_user_id: 'parent-auth-1' },
      ],
      error: null,
    })
    setTableData('staff', {
      data: [{ auth_user_id: 'staff-auth-1' }],
      error: null,
    })

    const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(2)
  })
})

// ── useParentMessagesUnreadCount ──────────────────────────────────────────
describe('useParentMessagesUnreadCount', () => {
  it('counts unread messages from non-staff (parent/student) senders only', async () => {
    setTableData('messages', {
      data: [
        { from_user_id: 'staff-auth-1' },
        { from_user_id: 'parent-auth-1' },
        { from_user_id: 'parent-auth-1' },
      ],
      error: null,
    })
    setTableData('staff', {
      data: [{ auth_user_id: 'staff-auth-1' }],
      error: null,
    })

    const { result } = renderHook(() => useParentMessagesUnreadCount(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(2)
  })
})

// ── useParentConversations — teacher class scoping ──────────────────────────
describe('useParentConversations', () => {
  it('for a teacher, excludes a parent whose child is not in the teacher\'s class', async () => {
    mockRole = 'teacher'
    setTableData('messages', { data: [
      { id: 'm1', from_user_id: 'parent-mine',  body: 'Hi',  sent_at: '2026-06-01T10:00:00Z', read_at: null },
      { id: 'm2', from_user_id: 'parent-other', body: 'Hey', sent_at: '2026-06-01T09:00:00Z', read_at: null },
    ], error: null })
    setTableData('parent_accounts', { data: [
      { auth_user_id: 'parent-mine',  full_name: 'Jane Apio',  student_ids: ['stu-mine'] },
      { auth_user_id: 'parent-other', full_name: 'Peter Otim', student_ids: ['stu-other'] },
    ], error: null })
    setTableData('staff', { data: { id: 'staff-1', classes: ['cls-mine'] }, error: null })
    setTableData('streams', { data: [], error: null })
    setTableData('students', { data: [
      { id: 'stu-mine',  first_name: 'Grace', last_name: 'Apio', class_id: 'cls-mine' },
      { id: 'stu-other', first_name: 'Brian', last_name: 'Otim', class_id: 'cls-other' },
    ], error: null })

    const { result } = renderHook(() => useParentConversations(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const names = result.current.data!.map(c => c.parentName)
    expect(names).toContain('Jane Apio')
    expect(names).not.toContain('Peter Otim')
  })

  it('does not restrict conversations for non-teacher roles (e.g. bursar)', async () => {
    mockRole = 'bursar'
    setTableData('messages', { data: [
      { id: 'm1', from_user_id: 'parent-other', body: 'Fee question', sent_at: '2026-06-01T10:00:00Z', read_at: null },
    ], error: null })
    setTableData('parent_accounts', { data: [
      { auth_user_id: 'parent-other', full_name: 'Peter Otim', student_ids: ['stu-other'] },
    ], error: null })
    setTableData('students', { data: [
      { id: 'stu-other', first_name: 'Brian', last_name: 'Otim', class_id: 'cls-other' },
    ], error: null })

    const { result } = renderHook(() => useParentConversations(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.map(c => c.parentName)).toContain('Peter Otim')
  })
})

// ── useSearchStudentsForMessaging — full-name search + teacher scoping ───────
describe('useSearchStudentsForMessaging', () => {
  it('finds a student when searching by full name ("Grace Apio"), not just a single word', async () => {
    mockRole = 'bursar' // no class restriction, isolate the full-name-search fix
    setTableData('students', { data: [
      { id: 'stu-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'S1/001', class_id: 'cls-1' },
    ], error: null })
    setTableData('parent_accounts', { data: [
      { auth_user_id: 'parent-1', full_name: 'Jane Apio', email: 'jane@k.ug', student_ids: ['stu-1'] },
    ], error: null })

    const { result } = renderHook(() => useSearchStudentsForMessaging('Grace Apio'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].parentName).toBe('Jane Apio')
  })

  it('for a teacher, only returns students in their own assigned class', async () => {
    mockRole = 'teacher'
    setTableData('staff', { data: { id: 'staff-1', classes: ['cls-mine'] }, error: null })
    setTableData('streams', { data: [], error: null })
    setTableData('students', { data: [
      { id: 'stu-mine',  first_name: 'Grace', last_name: 'Apio', admission_number: 'S1/001', class_id: 'cls-mine' },
      { id: 'stu-other', first_name: 'Grant', last_name: 'Aine', admission_number: 'S2/001', class_id: 'cls-other' },
    ], error: null })
    setTableData('parent_accounts', { data: [
      { auth_user_id: 'parent-mine',  full_name: 'Jane Apio', email: 'jane@k.ug', student_ids: ['stu-mine'] },
      { auth_user_id: 'parent-other', full_name: 'Amy Aine',  email: 'amy@k.ug',  student_ids: ['stu-other'] },
    ], error: null })

    const { result } = renderHook(() => useSearchStudentsForMessaging('Gra'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const names = result.current.data!.map(r => r.parentName)
    expect(names).toContain('Jane Apio')
    expect(names).not.toContain('Amy Aine')
  })
})
