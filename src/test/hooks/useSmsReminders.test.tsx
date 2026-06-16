// Phase 4 — Hook tests for useSmsReminders.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, mockFunctionsInvoke, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  const mockFunctionsInvoke = vi.fn().mockResolvedValue({ data: { results: [] }, error: null })
  return { mockFrom, mockFunctionsInvoke, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from: mockFrom,
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'bursar-1', role: 'bursar', schoolId: 'school-1', name: 'B', email: 'b@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useSendReminders, useSmsReminderLog } from '../../hooks/useSmsReminders'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useSendReminders', () => {
  it('writes to send_queue and calls edge function, returns count', async () => {
    setResponse('send_queue', { data: null, error: null })

    const { result } = renderHook(() => useSendReminders(), { wrapper: createWrapper() })

    let count: number | undefined
    await act(async () => {
      count = await result.current.mutateAsync([
        { studentId: 'stu-1', guardianPhone: '0700111222', channel: 'sms', message: 'Pay fees' },
        { studentId: 'stu-2', guardianPhone: '0700333444', channel: 'sms', message: 'Pay fees' },
      ])
    })

    expect(count).toBe(2)
    expect(mockFrom).toHaveBeenCalledWith('send_queue')
    // sms_reminders is owned by the edge function — hook must NOT insert it
    expect(mockFrom).not.toHaveBeenCalledWith('sms_reminders')
  })

  it('returns 0 when empty array passed (no DB calls)', async () => {
    const { result } = renderHook(() => useSendReminders(), { wrapper: createWrapper() })

    let count: number | undefined
    await act(async () => {
      count = await result.current.mutateAsync([])
    })

    expect(count).toBe(0)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws when send_queue insert fails', async () => {
    setResponse('send_queue', { data: null, error: { message: 'Queue insert failed' } })

    const { result } = renderHook(() => useSendReminders(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync([
          { studentId: 'stu-1', guardianPhone: '0700111222', channel: 'sms', message: 'Pay fees' },
        ])
      ).rejects.toEqual({ message: 'Queue insert failed' })
    })
  })

  it('edge function error is non-fatal — mutation still succeeds', async () => {
    setResponse('send_queue', { data: null, error: null })
    // functions.invoke mock returns error
    mockFunctionsInvoke.mockResolvedValueOnce({ data: null, error: new Error('AT unreachable') })

    const { result } = renderHook(() => useSendReminders(), { wrapper: createWrapper() })

    let count: number | undefined
    await act(async () => {
      count = await result.current.mutateAsync([
        { studentId: 'stu-1', guardianPhone: '0700111222', channel: 'sms', message: 'Pay fees' },
      ])
    })

    expect(count).toBe(1)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useSmsReminderLog', () => {
  it('returns reminder rows joined with student names', async () => {
    setResponse('sms_reminders', {
      data: [{
        id: 'sms-1', school_id: 'school-1', student_id: 'stu-1',
        guardian_phone: '0700111222', channel: 'sms', message: 'Pay fees',
        status: 'delivered', sent_at: '2025-06-01T10:00:00Z', created_at: '2025-06-01T09:00:00Z',
      }],
      error: null,
    })
    setResponse('students', {
      data: [{ id: 'stu-1', first_name: 'Alice', last_name: 'Nakato' }],
      error: null,
    })

    const { result } = renderHook(() => useSmsReminderLog(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const row = result.current.data![0]
    expect(row.id).toBe('sms-1')
    expect(row.firstName).toBe('Alice')
    expect(row.lastName).toBe('Nakato')
    expect(row.status).toBe('delivered')
    expect(row.channel).toBe('sms')
  })

  it('returns empty array when no reminders exist', async () => {
    setResponse('sms_reminders', { data: [], error: null })
    setResponse('students',      { data: [], error: null })

    const { result } = renderHook(() => useSmsReminderLog(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })
})
