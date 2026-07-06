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

import { useClasses, useStreams, useDepartments, useSubjects, useMyAssignedClasses, useMyAssignedSubjects } from '../../hooks/useClasses'

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

  // description was previously missing from this query entirely, so the
  // edit modal always showed a blank textarea for a department that already
  // had a saved description, and saving silently wiped it out.
  it('includes description in the mapped Department object', async () => {
    setResponse('departments', { data: [
      { id: 'dep-3', school_id: 'school-1', name: 'Sciences', description: 'Chemistry, Biology, Physics', head_teacher_id: null, accent_color: null, archived: false },
    ], error: null })
    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].description).toBe('Chemistry, Biology, Physics')
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

// ── useMyAssignedClasses ──────────────────────────────────────────
describe('useMyAssignedClasses', () => {
  it('returns only classes in staff.classes[], not every class in the school', async () => {
    setResponse('classes', { data: [
      { id: 'c1', school_id: 'school-1', name: 'S1', level: 1, academic_year_id: 'ay1' },
      { id: 'c2', school_id: 'school-1', name: 'S2', level: 2, academic_year_id: 'ay1' },
    ], error: null })
    setResponse('staff', { data: { classes: ['c1'] }, error: null })

    const { result } = renderHook(() => useMyAssignedClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.length).toBe(1))
    expect(result.current[0].id).toBe('c1')
  })

  it('returns an empty array (not every class) when the teacher has no assigned classes', async () => {
    setResponse('classes', { data: [
      { id: 'c1', school_id: 'school-1', name: 'S1', level: 1, academic_year_id: 'ay1' },
    ], error: null })
    setResponse('staff', { data: { classes: [] }, error: null })

    const { result } = renderHook(() => useMyAssignedClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(Array.isArray(result.current)).toBe(true))
    expect(result.current).toEqual([])
  })

  it('returns an empty array when staff.classes is null', async () => {
    setResponse('classes', { data: [
      { id: 'c1', school_id: 'school-1', name: 'S1', level: 1, academic_year_id: 'ay1' },
    ], error: null })
    setResponse('staff', { data: { classes: null }, error: null })

    const { result } = renderHook(() => useMyAssignedClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(Array.isArray(result.current)).toBe(true))
    expect(result.current).toEqual([])
  })

  it('includes classes where the teacher is streams.class_teacher_id, even with an empty staff.classes[]', async () => {
    // A homeroom class_teacher's assignment can live purely in streams.class_teacher_id
    // (not staff.classes[]) — this must not be treated as "unassigned".
    setResponse('classes', { data: [
      { id: 'c1', school_id: 'school-1', name: 'S1', level: 1, academic_year_id: 'ay1' },
      { id: 'c2', school_id: 'school-1', name: 'S2', level: 2, academic_year_id: 'ay1' },
    ], error: null })
    setResponse('staff', { data: { id: 'staff-1', classes: [] }, error: null })
    setResponse('streams', { data: [{ class_id: 'c2' }], error: null })

    const { result } = renderHook(() => useMyAssignedClasses(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.length).toBe(1))
    expect(result.current[0].id).toBe('c2')
  })
})

// ── useMyAssignedSubjects ─────────────────────────────────────────
describe('useMyAssignedSubjects', () => {
  it('returns only subjects in staff.subjects[], not every subject in the school', async () => {
    setResponse('subjects', { data: [
      { id: 's1', name: 'Math',    curriculum_code: null, level: null, department_id: null, is_active: true },
      { id: 's2', name: 'English', curriculum_code: null, level: null, department_id: null, is_active: true },
    ], error: null })
    setResponse('staff', { data: { subjects: ['s1'] }, error: null })

    const { result } = renderHook(() => useMyAssignedSubjects(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.length).toBe(1))
    expect(result.current[0].id).toBe('s1')
  })

  it('returns an empty array (not every subject) when the teacher has no assigned subjects', async () => {
    setResponse('subjects', { data: [
      { id: 's1', name: 'Math', curriculum_code: null, level: null, department_id: null, is_active: true },
    ], error: null })
    setResponse('staff', { data: { subjects: [] }, error: null })

    const { result } = renderHook(() => useMyAssignedSubjects(), { wrapper: createWrapper() })
    await waitFor(() => expect(Array.isArray(result.current)).toBe(true))
    expect(result.current).toEqual([])
  })
})
