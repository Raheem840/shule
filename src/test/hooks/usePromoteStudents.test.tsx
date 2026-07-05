// Tests for usePromoteStudents + useSelectivePromote role gating.
// Student promotion was moved from principal/it_admin to deputy/secretary only
// (see AdminDashboard.tsx, SystemSettingsPage.tsx, AcademicYearPage.tsx removal +
// the new shared PromoteStudentsSection used on Deputy/Secretary students pages).
// This locks in that only deputy/secretary can actually invoke the mutations —
// a regression here would silently re-open promotion to the wrong roles.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const { mockFrom, currentUser } = vi.hoisted(() => {
  const currentUser: { role: string } = { role: 'deputy' }

  function makeBuilder() {
    const b: any = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      in:     vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: any, reject?: any) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    }
    return b
  }
  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, currentUser }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: currentUser.role, schoolId: 's1', name: 'Test', email: 't@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { usePromoteStudents, useSelectivePromote, useLoadPromotionCandidates } from '../../hooks/useAdmin'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.role = 'deputy'
})

describe('usePromoteStudents — role gating', () => {
  it.each(['deputy', 'secretary'])('allows %s to promote', async (role) => {
    currentUser.role = role
    const { result } = renderHook(() => usePromoteStudents(), { wrapper: createWrapper() })
    await result.current.mutateAsync(undefined)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it.each(['it_admin', 'principal', 'teacher', 'dos'])('forbids %s from promoting', async (role) => {
    currentUser.role = role
    const { result } = renderHook(() => usePromoteStudents(), { wrapper: createWrapper() })
    await expect(result.current.mutateAsync(undefined)).rejects.toThrow('Forbidden')
  })
})

describe('useSelectivePromote — role gating', () => {
  it.each(['deputy', 'secretary'])('allows %s to selectively promote', async (role) => {
    currentUser.role = role
    const { result } = renderHook(() => useSelectivePromote(), { wrapper: createWrapper() })
    const out = await result.current.mutateAsync([])
    expect(out).toEqual({ promoted: 0, completed: 0, skipped: 0, total: 0, nextYearLabel: '' })
  })

  it.each(['it_admin', 'principal', 'teacher'])('forbids %s from selectively promoting', async (role) => {
    currentUser.role = role
    const { result } = renderHook(() => useSelectivePromote(), { wrapper: createWrapper() })
    await expect(result.current.mutateAsync(['stu-1'])).rejects.toThrow('Forbidden')
  })
})

// useLoadPromotionCandidates previously had no role guard at all, so principal
// (allowed on /deputy/students and /secretary/students per ProtectedRoute)
// could walk the whole promotion wizard and only get blocked at final confirm.
describe('useLoadPromotionCandidates — role gating', () => {
  it.each(['deputy', 'secretary'])('allows %s to load promotion candidates', async (role) => {
    currentUser.role = role
    const { result } = renderHook(() => useLoadPromotionCandidates(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ term: '3', year: 2026 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it.each(['it_admin', 'principal', 'teacher', 'dos'])('forbids %s from loading promotion candidates', async (role) => {
    currentUser.role = role
    const { result } = renderHook(() => useLoadPromotionCandidates(), { wrapper: createWrapper() })
    await expect(result.current.mutateAsync({ term: '3', year: 2026 })).rejects.toThrow('Forbidden')
  })
})

// ── Real promotion-logic tests (level-based, year-rollover) ─────────────────
// The tests above only cover role-gating with empty data. These exercise the
// actual business logic: classes are year-scoped, so "promoting" must move a
// student's academic_year_id forward into the class one level up IN THE NEXT
// YEAR — not just re-point them at a same-year class with a different name.
describe('runPromotion (via usePromoteStudents/useSelectivePromote) — real logic', () => {
  const DB = {
    academicYears: [
      { id: 'year-A', label: '2026', start_date: '2026-01-01', end_date: '2026-12-15', is_active: true,
        term1_start: null, term1_end: null, term2_start: null, term2_end: null, term3_start: null, term3_end: null },
      { id: 'year-B', label: '2027', start_date: '2027-01-01', end_date: '2027-12-15', is_active: false,
        term1_start: null, term1_end: null, term2_start: null, term2_end: null, term3_start: null, term3_end: null },
    ],
    classes: [
      { id: 'clsA-1', name: 'S.1', level: '1', academic_year_id: 'year-A' },
      { id: 'clsA-2', name: 'S.2', level: '2', academic_year_id: 'year-A' },
      { id: 'clsB-1', name: 'S.1', level: '1', academic_year_id: 'year-B' },
      { id: 'clsB-2', name: 'S.2', level: '2', academic_year_id: 'year-B' },
    ],
    streams: [
      { id: 'strA-1', name: 'East', class_id: 'clsA-1' },
      { id: 'strB-2', name: 'East', class_id: 'clsB-2' },
    ],
    students: [
      { id: 'stu-1', class_id: 'clsA-1', stream_id: 'strA-1', status: 'active' },
      { id: 'stu-2', class_id: 'clsA-2', stream_id: null,     status: 'active' }, // at max level -> completes
    ],
  }

  function setupRealisticMock() {
    const updateLog: Array<{ table: string; patch: any; ids: string[] }> = []
    const insertLog: Record<string, any[]> = { classes: [], streams: [] }

    mockFrom.mockImplementation((table: string) => {
      const eqs: Record<string, any> = {}
      let inFilter: string[] | undefined

      function rows(): any[] {
        if (table === 'students') {
          let r = DB.students
          if (eqs.status) r = r.filter(s => s.status === eqs.status)
          if (inFilter) r = r.filter(s => inFilter!.includes(s.id))
          return r
        }
        if (table === 'academic_years') {
          let r = DB.academicYears
          if (eqs.is_active !== undefined) r = r.filter(y => y.is_active === eqs.is_active)
          return r
        }
        if (table === 'classes') {
          let r = [...DB.classes, ...insertLog.classes]
          if (eqs.academic_year_id) r = r.filter(c => c.academic_year_id === eqs.academic_year_id)
          return r
        }
        if (table === 'streams') {
          let r = [...DB.streams, ...insertLog.streams]
          if (inFilter) r = r.filter(s => inFilter!.includes(s.class_id))
          return r
        }
        return []
      }

      const b: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => { eqs[col] = val; return b }),
        in: vi.fn().mockImplementation((_col: string, vals: string[]) => { inFilter = vals; return b }),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: rows()[0] ?? null, error: null })),
        insert: vi.fn().mockImplementation((payload: any) => {
          const arr = Array.isArray(payload) ? payload : [payload]
          const withIds = arr.map((r: any, i: number) => ({ ...r, id: `new-${table}-${(insertLog[table]?.length ?? 0) + i + 1}` }))
          insertLog[table] = (insertLog[table] ?? []).concat(withIds)
          const singleId = withIds[0]?.id
          const chain: any = {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: singleId }, error: null }),
            }),
            then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
          }
          return chain
        }),
        update: vi.fn().mockImplementation((patch: any) => {
          const upd: any = {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
              updateLog.push({ table, patch, ids })
              return Promise.resolve({ error: null })
            }),
          }
          return upd
        }),
        then: (resolve: any, reject?: any) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
      }
      return b
    })

    return { updateLog, insertLog }
  }

  it('promotes a mid-level student into the NEXT academic year\'s class one level up (matching stream by name)', async () => {
    currentUser.role = 'deputy'
    const { updateLog } = setupRealisticMock()

    const { result } = renderHook(() => usePromoteStudents(), { wrapper: createWrapper() })
    const out = await result.current.mutateAsync(undefined)

    expect(out.promoted).toBe(1)
    expect(out.completed).toBe(1)
    expect(out.skipped).toBe(0)
    expect(out.nextYearLabel).toBe('2027')

    const promoteUpdate = updateLog.find(u => u.ids.includes('stu-1'))
    expect(promoteUpdate?.patch).toEqual({ class_id: 'clsB-2', stream_id: 'strB-2', academic_year_id: 'year-B' })

    const completeUpdate = updateLog.find(u => u.ids.includes('stu-2'))
    expect(completeUpdate?.patch).toEqual({ status: 'completed', class_id: null, stream_id: null })
  })

  it('auto-creates the next academic year and mirrors classes/streams forward when none exists yet', async () => {
    currentUser.role = 'secretary'
    const { insertLog } = setupRealisticMock()
    // Remove the pre-existing next year — force the auto-create path.
    const withoutNextYear = { ...DB, academicYears: [DB.academicYears[0]] }
    Object.assign(DB, withoutNextYear)

    const { result } = renderHook(() => useSelectivePromote(), { wrapper: createWrapper() })
    const out = await result.current.mutateAsync(['stu-1'])

    expect(out.promoted).toBe(1)
    expect(insertLog.classes.length).toBeGreaterThan(0)   // next year had no classes yet — copied forward
    expect(insertLog.classes[0]).toMatchObject({ name: expect.any(String), level: expect.any(String) })

    // restore for any subsequent test in this describe block
    DB.academicYears = [
      { id: 'year-A', label: '2026', start_date: '2026-01-01', end_date: '2026-12-15', is_active: true,
        term1_start: null, term1_end: null, term2_start: null, term2_end: null, term3_start: null, term3_end: null },
      { id: 'year-B', label: '2027', start_date: '2027-01-01', end_date: '2027-12-15', is_active: false,
        term1_start: null, term1_end: null, term2_start: null, term2_end: null, term3_start: null, term3_end: null },
    ]
  })

  it('skips a student whose class has no level set, instead of silently guessing', async () => {
    currentUser.role = 'deputy'
    const original = DB.classes
    DB.classes = [{ id: 'clsA-1', name: 'S.1', level: null as any, academic_year_id: 'year-A' }]
    DB.students = [{ id: 'stu-3', class_id: 'clsA-1', stream_id: null, status: 'active' }]
    setupRealisticMock()

    const { result } = renderHook(() => usePromoteStudents(), { wrapper: createWrapper() })
    const out = await result.current.mutateAsync(undefined)

    expect(out.skipped).toBe(1)
    expect(out.promoted).toBe(0)
    expect(out.completed).toBe(0)

    DB.classes = original
    DB.students = [
      { id: 'stu-1', class_id: 'clsA-1', stream_id: 'strA-1', status: 'active' },
      { id: 'stu-2', class_id: 'clsA-2', stream_id: null,     status: 'active' },
    ]
  })

  it('reports progress via onProgress instead of leaving the caller\'s progress bar frozen', async () => {
    currentUser.role = 'deputy'
    setupRealisticMock()

    const onProgress = vi.fn()
    const { result } = renderHook(() => usePromoteStudents(), { wrapper: createWrapper() })
    await result.current.mutateAsync(onProgress)

    expect(onProgress).toHaveBeenCalled()
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]
    expect(lastCall[1]).toBe(2) // total students in the fixture
  })

  it('skips (rather than silently merges) students at a level shared by two classes', async () => {
    currentUser.role = 'deputy'
    const originalClasses = DB.classes
    const originalStudents = DB.students
    // Two source-year classes both claim level '1' — ambiguous which is the
    // "real" level-1 class, so level 2 (level+1 for a level-1 student) is fine,
    // but promoting FROM level 1 requires resolving level 2 unambiguously —
    // here we make level 2 itself ambiguous in the source year.
    DB.classes = [
      { id: 'clsA-1', name: 'S.1', level: '1', academic_year_id: 'year-A' },
      { id: 'clsA-2a', name: 'S.2 Science', level: '2', academic_year_id: 'year-A' },
      { id: 'clsA-2b', name: 'S.2 Arts',    level: '2', academic_year_id: 'year-A' },
      { id: 'clsB-1', name: 'S.1', level: '1', academic_year_id: 'year-B' },
    ]
    DB.students = [{ id: 'stu-4', class_id: 'clsA-1', stream_id: null, status: 'active' }]
    setupRealisticMock()

    const { result } = renderHook(() => usePromoteStudents(), { wrapper: createWrapper() })
    const out = await result.current.mutateAsync(undefined)

    expect(out.skipped).toBe(1)
    expect(out.promoted).toBe(0)

    DB.classes = originalClasses
    DB.students = originalStudents
  })
})

describe('resolveOrCreateNextAcademicYear label increment (via usePromoteStudents)', () => {
  it('increments every 4-digit year in a "YYYY/YYYY"-style label, not just the first', async () => {
    currentUser.role = 'deputy'
    const DB2 = {
      academicYears: [
        { id: 'year-A', label: '2026/2027', start_date: '2026-01-01', end_date: '2026-12-15', is_active: true,
          term1_start: null, term1_end: null, term2_start: null, term2_end: null, term3_start: null, term3_end: null },
      ],
      classes: [{ id: 'clsA-1', name: 'S.1', level: '1', academic_year_id: 'year-A' }],
      streams: [] as any[],
      students: [{ id: 'stu-5', class_id: 'clsA-1', stream_id: null, status: 'active' }],
    }

    mockFrom.mockImplementation((table: string) => {
      const eqs: Record<string, any> = {}
      let inFilter: string[] | undefined
      function rows(): any[] {
        if (table === 'students') return DB2.students.filter(s => !eqs.status || s.status === eqs.status)
        if (table === 'academic_years') return DB2.academicYears
        if (table === 'classes') {
          let r = [...DB2.classes]
          if (eqs.academic_year_id) r = r.filter(c => c.academic_year_id === eqs.academic_year_id)
          return r
        }
        if (table === 'streams') return []
        return []
      }
      const b: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => { eqs[col] = val; return b }),
        in: vi.fn().mockImplementation((_col: string, vals: string[]) => { inFilter = vals; return b }),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: rows()[0] ?? null, error: null })),
        insert: vi.fn().mockImplementation((payload: any) => {
          const arr = Array.isArray(payload) ? payload : [payload]
          const chain: any = {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'new-year-1' }, error: null }),
            }),
            then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
          }
          void arr
          return chain
        }),
        update: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ error: null }),
        })),
        then: (resolve: any, reject?: any) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
      }
      void inFilter
      return b
    })

    const { result } = renderHook(() => usePromoteStudents(), { wrapper: createWrapper() })
    const out = await result.current.mutateAsync(undefined)

    expect(out.nextYearLabel).toBe('2027/2028')
  })
})
