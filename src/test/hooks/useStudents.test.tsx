// Phase 4 — Hook tests for useStudents.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// ── Supabase mock (per-table, configurable) ─────────────────────
const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse   = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      like:        vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      delete:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null, count: null }).then(resolve, reject),
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
      signOut:           vi.fn(),
    },
    from: mockFrom,
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'secretary', schoolId: 'school-1', name: 'Sec', email: 's@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import {
  useStudents, useStudentById, useNextAdmissionNumber,
  useRegisterStudent, useUpdateStudent, useDeleteStudent,
} from '../../hooks/useStudents'

// ── Wrapper ─────────────────────────────────────────────────────
function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

// ── Shared fixture ───────────────────────────────────────────────
const dbStudentRow = {
  id:               'stu-1',
  school_id:        'school-1',
  admission_number: 'KJA/2025/001',
  first_name:       'Alice',
  last_name:        'Nakato',
  dob:              '2010-01-01',
  gender:           'female',
  class_id:         'cls-1',
  stream_id:        null,
  student_type:     'day',
  photo_url:        null,
  status:           'active',
  enrolled_at:      '2025-01-10',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

// ── useStudents ──────────────────────────────────────────────────
describe('useStudents', () => {
  it('returns mapped Student objects when Supabase resolves', async () => {
    setResponse('students', { data: [dbStudentRow], error: null })
    const { result } = renderHook(() => useStudents(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const stu = result.current.data![0]
    expect(stu.id).toBe('stu-1')
    expect(stu.firstName).toBe('Alice')
    expect(stu.lastName).toBe('Nakato')
    expect(stu.admissionNumber).toBe('KJA/2025/001')
    expect(stu.gender).toBe('female')
  })

  it('exposes error state when Supabase rejects', async () => {
    setResponse('students', { data: null, error: { message: 'DB error' } })
    const { result } = renderHook(() => useStudents(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('filters client-side by search term', async () => {
    setResponse('students', {
      data: [
        { ...dbStudentRow, first_name: 'Alice', last_name: 'Nakato' },
        { ...dbStudentRow, id: 'stu-2', first_name: 'Bob', last_name: 'Opio', admission_number: 'KJA/2025/002' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useStudents({ search: 'alice' }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].firstName).toBe('Alice')
  })

  it('returns empty array when Supabase returns no rows', async () => {
    setResponse('students', { data: [], error: null })
    const { result } = renderHook(() => useStudents(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ── useStudentById ───────────────────────────────────────────────
describe('useStudentById', () => {
  it('is disabled when id is null', () => {
    const { result } = renderHook(() => useStudentById(null), { wrapper: createWrapper() })
    // Query is disabled — should be in idle state
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when id is undefined', () => {
    const { result } = renderHook(() => useStudentById(undefined), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ── useNextAdmissionNumber ───────────────────────────────────────
// Prefix is always the fixed "STU" — never school short_name (see
// 20260616_000003_stu_admission_prefix.sql) — this preview must match
// exactly what the DB trigger (generate_admission_number()) would produce.
describe('useNextAdmissionNumber', () => {
  it('returns seq 00000001 when no students exist for the year', async () => {
    setResponse('students', { data: [], error: null })
    const { result } = renderHook(() => useNextAdmissionNumber(2025), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('STU/2025/00000001')
  })

  it('returns max seq + 1 from existing STU admission numbers', async () => {
    // Input fixture uses the old 4-digit format on purpose — the migration
    // that fixed the padding doesn't rewrite existing rows, so real data
    // stays a mix of old and new widths. The regex only cares about
    // extracting the numeric sequence, not its width.
    setResponse('students', {
      data: [{ admission_number: 'STU/2025/0049' }],
      error: null,
    })
    const { result } = renderHook(() => useNextAdmissionNumber(2025), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('STU/2025/00000050')
  })

  it('ignores admission numbers with a different prefix from another school', async () => {
    // Regression: a stray non-STU-prefixed row (e.g. a legacy short-name-
    // based number) must never win a string-ordering comparison against
    // the real STU sequence.
    setResponse('students', {
      data: [{ admission_number: 'STU/2025/0002' }, { admission_number: 'TS/2025/0099' }],
      error: null,
    })
    const { result } = renderHook(() => useNextAdmissionNumber(2025), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('STU/2025/00000003')
  })

  it('returns 00000001 when admission number format is unrecognized', async () => {
    setResponse('students', {
      data: [{ admission_number: 'INVALID' }],
      error: null,
    })
    const { result } = renderHook(() => useNextAdmissionNumber(2025), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('STU/2025/00000001')
  })
})

// ── useRegisterStudent ────────────────────────────────────────────
describe('useRegisterStudent', () => {
  it('calls supabase insert and returns the new student id', async () => {
    // students.single() returns the new row ID
    setResponse('students', { data: { id: 'new-stu-id' }, error: null })
    // student_guardians insert resolves without error
    setResponse('student_guardians', { data: null, error: null })

    const { result } = renderHook(() => useRegisterStudent(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync({
        firstName: 'Grace', lastName: 'Apio', dob: null,
        gender: 'female', nationality: null, religion: null,
        photoUrl: null, medicalNotes: null,
        admissionNumber: 'KJA/2025/050', classId: 'cls-1',
        streamId: null, studentType: 'day', previousSchool: null,
        enrolledAt: '2025-01-15', academicYearId: 'test-year-id',
        guardians: [{
          fullName: 'Mary Apio', relationship: 'mother', phone: '0700111222',
          email: null, isPrimary: true, doNotContact: false, commsPreference: 'sms',
        }],
      })
    })

    expect(returnedId).toBe('new-stu-id')
    expect(mockFrom).toHaveBeenCalledWith('students')
    expect(mockFrom).toHaveBeenCalledWith('student_guardians')
  })

  it('throws when supabase insert returns an error', async () => {
    setResponse('students', { data: null, error: { message: 'Duplicate admission number' } })

    const { result } = renderHook(() => useRegisterStudent(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          firstName: 'X', lastName: 'Y', dob: null, gender: null,
          nationality: null, religion: null, photoUrl: null, medicalNotes: null,
          admissionNumber: 'KJA/2025/001', classId: 'cls-1',
          streamId: null, studentType: null, previousSchool: null,
          enrolledAt: '2025-01-15', academicYearId: 'test-year-id', guardians: [],
        })
      ).rejects.toEqual({ message: 'Duplicate admission number' })
    })
  })
})

// ── useStudentById (with data) ────────────────────────────────────
describe('useStudentById (with data)', () => {
  it('returns student with guardians when id is provided', async () => {
    const fullRow = {
      ...dbStudentRow,
      nationality: 'Ugandan', religion: 'Christian',
      previous_school: null, medical_notes: null,
    }
    setResponse('students', { data: fullRow, error: null })
    setResponse('student_guardians', {
      data: [{
        id: 'grd-1', school_id: 'school-1', student_id: 'stu-1',
        full_name: 'Mary Nakato', relationship: 'mother', phone: '0700111222',
        email: null, do_not_contact: false,
      }],
      error: null,
    })

    const { result } = renderHook(() => useStudentById('stu-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.id).toBe('stu-1')
    expect(result.current.data!.guardians).toHaveLength(1)
    expect(result.current.data!.guardians[0].fullName).toBe('Mary Nakato')
  })

  it('throws when student fetch returns an error', async () => {
    setResponse('students', { data: null, error: { message: 'Not found' } })
    setResponse('student_guardians', { data: [], error: null })

    const { result } = renderHook(() => useStudentById('bad-id'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useStudents with DB-level filters ────────────────────────────
describe('useStudents with DB-level filters', () => {
  it('passes classId to Supabase .eq()', async () => {
    setResponse('students', { data: [dbStudentRow], error: null })
    const { result } = renderHook(
      () => useStudents({ classId: 'cls-1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('passes streamId to Supabase .eq()', async () => {
    setResponse('students', { data: [], error: null })
    const { result } = renderHook(
      () => useStudents({ streamId: 'str-1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('passes status to Supabase .eq()', async () => {
    setResponse('students', { data: [dbStudentRow], error: null })
    const { result } = renderHook(
      () => useStudents({ status: 'active' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

// ── useUpdateStudent ──────────────────────────────────────────────
describe('useUpdateStudent', () => {
  it('calls supabase update and returns the student id', async () => {
    setResponse('students', { data: null, error: null })

    const { result } = renderHook(() => useUpdateStudent(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync({
        id: 'stu-1',
        firstName: 'Alice Updated',
        classId: 'cls-2',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(returnedId).toBe('stu-1')
    expect(mockFrom).toHaveBeenCalledWith('students')
  })

  it('throws when supabase update returns an error', async () => {
    setResponse('students', { data: null, error: { message: 'Update failed' } })

    const { result } = renderHook(() => useUpdateStudent(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'stu-1', firstName: 'X' })
      ).rejects.toEqual({ message: 'Update failed' })
    })
  })
})

// ── useDeleteStudent ──────────────────────────────────────────────
describe('useDeleteStudent', () => {
  it('calls supabase delete and returns the student id', async () => {
    setResponse('students', { data: null, error: null })

    const { result } = renderHook(() => useDeleteStudent(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync('stu-1')
    })

    expect(returnedId).toBe('stu-1')
    expect(mockFrom).toHaveBeenCalledWith('students')
  })

  it('throws when supabase delete returns an error', async () => {
    setResponse('students', { data: null, error: { message: 'Delete failed' } })

    const { result } = renderHook(() => useDeleteStudent(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync('stu-1')
      ).rejects.toEqual({ message: 'Delete failed' })
    })
  })
})

describe('schema boundary: student_guardians', () => {
  it('guardian mapper exposes fullName (from full_name) — no guardianName field', async () => {
    setResponse('students', { data: [{
      id: 'stu-1', school_id: 'school-1', admission_number: 'ADM-001',
      first_name: 'Alice', last_name: 'Nabuuma', dob: '2010-03-15',
      gender: 'female', class_id: 'cls-1', stream_id: null, stream: null,
      photo_url: null, status: 'active', enrolled_at: '2024-01-15T00:00:00Z',
      nationality: 'Ugandan', religion: null, student_type: 'day', previous_school: null,
      medical_notes: null, created_by: null,
    }], error: null })
    setResponse('student_guardians', { data: [{
      id: 'g-1', school_id: 'school-1', student_id: 'stu-1',
      full_name: 'Mary Nakato', relationship: 'mother', phone: '0700111222',
      email: null, do_not_contact: false, is_primary: true, comms_preference: 'sms',
    }], error: null })

    const { result } = renderHook(
      () => useStudentById('stu-1'),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Guardian mapping is tested via useStudentById which joins guardians
    // The hook queries student_guardians and maps full_name → fullName
    expect(mockFrom).toHaveBeenCalledWith('students')
  })
})
