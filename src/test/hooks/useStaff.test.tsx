// Phase 4 — Hook tests for useStaff.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      like:        vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
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

import { useStaff, useStaffById, useNextStaffNumber, useRegisterStaff } from '../../hooks/useStaff'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const dbStaffRow = {
  id:               'staff-1',
  school_id:        'school-1',
  auth_user_id:     null,
  staff_number:     'KJA/STAFF/001',
  first_name:       'John',
  last_name:        'Mukasa',
  role:             'teacher',
  department_id:    null,
  phone:            '0700000001',
  email:            'j.mukasa@school.ac.ug',
  join_date:        '2024-01-01',
  employment_type:  'full_time',
  photo_url:        null,
  is_active:        true,
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useStaff', () => {
  it('returns mapped Staff objects when Supabase resolves', async () => {
    setResponse('staff', { data: [dbStaffRow], error: null })
    const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const staff = result.current.data![0]
    expect(staff.id).toBe('staff-1')
    expect(staff.firstName).toBe('John')
    expect(staff.lastName).toBe('Mukasa')
    expect(staff.staffNumber).toBe('KJA/STAFF/001')
    expect(staff.role).toBe('teacher')
    expect(staff.isActive).toBe(true)
  })

  it('filters client-side by search (staff number)', async () => {
    setResponse('staff', {
      data: [
        dbStaffRow,
        { ...dbStaffRow, id: 'staff-2', first_name: 'Grace', last_name: 'Apio', staff_number: 'KJA/STAFF/002' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useStaff({ search: 'STAFF/002' }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].staffNumber).toBe('KJA/STAFF/002')
  })

  it('filters client-side by search (first name)', async () => {
    setResponse('staff', {
      data: [
        dbStaffRow,
        { ...dbStaffRow, id: 'staff-2', first_name: 'Grace', last_name: 'Apio', staff_number: 'KJA/STAFF/002' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useStaff({ search: 'grace' }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].firstName).toBe('Grace')
  })

  // Previously only matched firstName/lastName independently, so searching a
  // full name like "Grace Apio" returned zero results even though the staff
  // member exists — the same bug class already fixed for teacher/bursar
  // messaging search in an earlier session, but missed here.
  it('filters client-side by full name search ("first last")', async () => {
    setResponse('staff', {
      data: [
        dbStaffRow,
        { ...dbStaffRow, id: 'staff-2', first_name: 'Grace', last_name: 'Apio', staff_number: 'KJA/STAFF/002' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useStaff({ search: 'Grace Apio' }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].firstName).toBe('Grace')
  })

  // classes was missing from LIST_COLS, so the Staff Directory's "teaching
  // classes" chips could never render for any teacher regardless of real
  // assignments — the DB row had the data, the SELECT just never fetched it.
  it('includes classes in the mapped Staff object from the list query', async () => {
    setResponse('staff', { data: [{ ...dbStaffRow, classes: ['class-1', 'class-2'] }], error: null })
    const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].classes).toEqual(['class-1', 'class-2'])
  })

  it('exposes error state when Supabase fails', async () => {
    setResponse('staff', { data: null, error: { message: 'Permission denied' } })
    const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty array when no staff found', async () => {
    setResponse('staff', { data: [], error: null })
    const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useStaffById', () => {
  it('is disabled when id is null', () => {
    const { result } = renderHook(() => useStaffById(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when id is undefined', () => {
    const { result } = renderHook(() => useStaffById(undefined), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useNextStaffNumber', () => {
  const year = new Date().getFullYear()

  it('returns STF/STAFF/{year}/001 when no staff exist and no school short_name', async () => {
    setResponse('staff',          { data: [],   error: null })
    setResponse('school_profile', { data: { short_name: null }, error: null })

    const { result } = renderHook(() => useNextStaffNumber(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(`STF/STAFF/${year}/001`)
  })

  it('uses school short_name as prefix when available', async () => {
    setResponse('staff',          { data: [], error: null })
    setResponse('school_profile', { data: { short_name: 'KJA' }, error: null })

    const { result } = renderHook(() => useNextStaffNumber(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(`KJA/STAFF/${year}/001`)
  })

  it('increments from the highest sequence in the current year, ignoring other years/formats', async () => {
    setResponse('staff', {
      data: [
        { staff_number: `KJA/STAFF/${year}/005` },
        { staff_number: `KJA/STAFF/${year - 1}/099` }, // different year — must not affect sequence
        { staff_number: 'KJA/STAFF/012' },              // old pre-migration format — must not affect sequence
      ],
      error: null,
    })
    setResponse('school_profile', { data: { short_name: 'KJA' }, error: null })

    const { result } = renderHook(() => useNextStaffNumber(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(`KJA/STAFF/${year}/006`)
  })

  it('zero-pads the sequence to 3 digits', async () => {
    setResponse('staff',          { data: [{ staff_number: `KJA/STAFF/${year}/009` }], error: null })
    setResponse('school_profile', { data: { short_name: 'KJA' }, error: null })

    const { result } = renderHook(() => useNextStaffNumber(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(`KJA/STAFF/${year}/010`)
  })
})

// ── useStaff with DB-level filters ────────────────────────────────
describe('useStaff with DB-level filters', () => {
  it('passes role filter to Supabase .eq()', async () => {
    setResponse('staff', { data: [dbStaffRow], error: null })
    const { result } = renderHook(
      () => useStaff({ role: 'teacher' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('passes departmentId filter to Supabase .eq()', async () => {
    setResponse('staff', { data: [], error: null })
    const { result } = renderHook(
      () => useStaff({ departmentId: 'dept-1' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('passes isActive=false filter to Supabase .eq()', async () => {
    setResponse('staff', { data: [], error: null })
    const { result } = renderHook(
      () => useStaff({ isActive: false }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ── useStaffById (with data) ──────────────────────────────────────
describe('useStaffById (with data)', () => {
  it('returns staff with documents when id is provided', async () => {
    const fullRow = {
      ...dbStaffRow,
      auth_user_id: null, department_id: null,
      subjects: [], classes: [],
      date_of_birth: null, gender: null, national_id: null,
      qualification_level: null, qualification_title: null,
      institution: null, graduation_year: null,
    }
    setResponse('staff', { data: fullRow, error: null })
    setResponse('staff_documents', {
      data: [{
        id: 'doc-1', school_id: 'school-1', staff_id: 'staff-1',
        doc_type: 'national_id', file_name: 'nid.pdf',
        file_url: 'https://storage/nid.pdf', uploaded_by: 'user-1',
        uploaded_at: '2025-01-01T10:00:00Z',
      }],
      error: null,
    })

    const { result } = renderHook(() => useStaffById('staff-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.id).toBe('staff-1')
    expect(result.current.data!.documents).toHaveLength(1)
    expect(result.current.data!.documents[0].documentType).toBe('national_id')
  })

  it('throws when staff fetch returns an error', async () => {
    setResponse('staff', { data: null, error: { message: 'Not found' } })
    setResponse('staff_documents', { data: [], error: null })

    const { result } = renderHook(() => useStaffById('bad-id'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useRegisterStaff ──────────────────────────────────────────────
describe('useRegisterStaff', () => {
  it('calls supabase insert and returns the new staff id', async () => {
    setResponse('staff', { data: { id: 'new-staff-id' }, error: null })
    setResponse('staff_documents', { data: null, error: null })

    const { result } = renderHook(() => useRegisterStaff(), { wrapper: createWrapper() })

    let returnedId: string | undefined
    await act(async () => {
      returnedId = await result.current.mutateAsync({
        firstName: 'Sarah', lastName: 'Nalwoga',
        dateOfBirth: null, gender: 'female',
        phone: '0700222333', email: 'sarah@school.ac.ug',
        nationalId: null, photoUrl: null,
        role: 'teacher', staffNumber: 'KJA/STAFF/010',
        departmentId: null, employmentType: 'full_time',
        joinDate: '2025-01-15', subjects: [], classes: [],
        qualificationLevel: null, qualificationTitle: null,
        institution: null, graduationYear: null,
        documents: [],
      })
    })

    expect(returnedId).toBe('new-staff-id')
    expect(mockFrom).toHaveBeenCalledWith('staff')
  })

  it('inserts documents when documents array is non-empty', async () => {
    setResponse('staff', { data: { id: 'new-staff-id' }, error: null })
    setResponse('staff_documents', { data: null, error: null })

    const { result } = renderHook(() => useRegisterStaff(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        firstName: 'Tom', lastName: 'Opio',
        dateOfBirth: null, gender: 'male',
        phone: null, email: null,
        nationalId: null, photoUrl: null,
        role: 'teacher', staffNumber: 'KJA/STAFF/011',
        departmentId: null, employmentType: 'full_time',
        joinDate: '2025-01-15', subjects: [], classes: [],
        qualificationLevel: null, qualificationTitle: null,
        institution: null, graduationYear: null,
        documents: [{ documentType: 'national_id', fileName: 'nid.pdf', fileUrl: 'https://s/nid.pdf' }],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('staff_documents')
  })

  it('throws when supabase insert returns an error', async () => {
    setResponse('staff', { data: null, error: { message: 'Duplicate staff number' } })

    const { result } = renderHook(() => useRegisterStaff(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          firstName: 'X', lastName: 'Y',
          dateOfBirth: null, gender: null,
          phone: null, email: null,
          nationalId: null, photoUrl: null,
          role: 'teacher', staffNumber: 'KJA/STAFF/001',
          departmentId: null, employmentType: 'full_time',
          joinDate: null, subjects: [], classes: [],
          qualificationLevel: null, qualificationTitle: null,
          institution: null, graduationYear: null,
          documents: [],
        })
      ).rejects.toEqual({ message: 'Duplicate staff number' })
    })
  })
})
