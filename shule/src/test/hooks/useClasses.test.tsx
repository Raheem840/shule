import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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
      is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
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

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'teacher-1', role: 'teacher', schoolId: 'school-1', name: 'T', email: 't@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useClasses, useStreams, useDepartments, useSubjects } from '../../hooks/useClasses'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

// ── useClasses ─────────────────────────────────────────────────
describe('useClasses', () => {
  it('returns mapped class objects', async () => {
    setResponse('classes', { data: [
      { id: 'cls-1', school_id: 'school-1', name: 'Senior 1', level: 'S1', academic_year_id: 'ay-1' },
    ], error: null })
    const { result } = renderHook(() => useClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('Senior 1')
    expect(result.current.data![0].level).toBe('S1')
    expect(result.current.data![0].academicYearId).toBe('ay-1')
  })

  it('returns empty array when no classes', async () => {
    setResponse('classes', { data: [], error: null })
    const { result } = renderHook(() => useClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('exposes error on failure', async () => {
    setResponse('classes', { data: null, error: { message: 'RLS denied' } })
    const { result } = renderHook(() => useClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useStreams ─────────────────────────────────────────────────
describe('useStreams', () => {
  it('returns mapped stream objects', async () => {
    setResponse('streams', { data: [
      { id: 'str-1', school_id: 'school-1', class_id: 'cls-1', name: 'West', class_teacher_id: 't-1' },
    ], error: null })
    const { result } = renderHook(() => useStreams(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].classId).toBe('cls-1')
    expect(result.current.data![0].classTeacherId).toBe('t-1')
  })

  it('returns empty array when no streams', async () => {
    setResponse('streams', { data: [], error: null })
    const { result } = renderHook(() => useStreams('cls-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ── useDepartments ─────────────────────────────────────────────
describe('useDepartments', () => {
  it('returns mapped department objects', async () => {
    setResponse('departments', { data: [
      { id: 'dep-1', school_id: 'school-1', name: 'Sciences', head_teacher_id: 'ht-1', accent_color: '#0d9488', archived: false },
    ], error: null })
    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].name).toBe('Sciences')
    expect(result.current.data![0].headTeacherId).toBe('ht-1')
    expect(result.current.data![0].archived).toBe(false)
  })

  it('defaults archived to false when null', async () => {
    setResponse('departments', { data: [
      { id: 'dep-2', school_id: 'school-1', name: 'Arts', head_teacher_id: null, accent_color: null, archived: null },
    ], error: null })
    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].archived).toBe(false)
    expect(result.current.data![0].headTeacherId).toBeNull()
  })
})

// ── useSubjects ─────────────────────────────────────────────────
describe('useSubjects', () => {
  it('maps department_id and is_active from DB', async () => {
    setResponse('subjects', { data: [
      { id: 'sub-1', name: 'Mathematics', curriculum_code: 'MTH', level: 'S1', department_id: 'dep-1', is_active: true },
    ], error: null })
    const { result } = renderHook(() => useSubjects(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].departmentId).toBe('dep-1')
    expect(result.current.data![0].isActive).toBe(true)
  })

  it('defaults isActive to true when null', async () => {
    setResponse('subjects', { data: [
      { id: 'sub-2', name: 'Art', curriculum_code: null, level: null, department_id: null, is_active: null },
    ], error: null })
    const { result } = renderHook(() => useSubjects(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].isActive).toBe(true)
    expect(result.current.data![0].departmentId).toBeNull()
  })
})
