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
      order:    vi.fn().mockReturnThis(),
      limit:    vi.fn().mockReturnThis(),
      insert:   vi.fn().mockReturnThis(),
      update:   vi.fn().mockReturnThis(),
      single:   vi.fn().mockImplementation(() =>
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
describe('useUnreadCount', () => {
  it('returns the count from Supabase head query', async () => {
    // Mock count query
    const mockCount = vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ count: 3, error: null }).then(resolve),
    }))
    mockFrom.mockImplementation(mockCount)

    const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // count is 3
    expect(result.current.data).toBe(3)
  })
})
