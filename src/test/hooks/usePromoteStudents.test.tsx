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
    expect(out).toEqual({ promoted: 0, completed: 0 })
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
