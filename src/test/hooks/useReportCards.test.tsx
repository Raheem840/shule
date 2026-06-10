// Phase 4 — Hook tests for useReportCards.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const { mockFrom, mockStorage, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      upsert:      vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then:        (resolve: any, reject?: any) =>
        Promise.resolve(tableData[table] ?? { data: [], error: null }).then(resolve, reject),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)

  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload:       vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.url/test.pdf' } }),
    }),
  }

  return { mockFrom, mockStorage, setResponse, clearResponses }
})

// jsPDF is used by generateReportCardPDF inside useGenerateReportCards
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(function (this: unknown): unknown {
    return {
      setFont:         vi.fn().mockReturnThis(),
      setFontSize:     vi.fn().mockReturnThis(),
      setDrawColor:    vi.fn().mockReturnThis(),
      setLineWidth:    vi.fn().mockReturnThis(),
      setTextColor:    vi.fn().mockReturnThis(),
      text:            vi.fn().mockReturnThis(),
      line:            vi.fn().mockReturnThis(),
      addPage:         vi.fn().mockReturnThis(),
      splitTextToSize: vi.fn().mockImplementation((t: string) => [t]),
      output:          vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' })),
      lastAutoTable:   { finalY: 100 },
    }
  }),
}))
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut:           vi.fn(),
    },
    from:    mockFrom,
    storage: mockStorage,
  },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'principal-1', role: 'principal', schoolId: 'school-1', name: 'P', email: 'p@k.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

import { useReportCards, useApproveReportCard, useReleaseReportCard, useUnlockReportCard } from '../../hooks/useReportCards'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const dbReportCard = {
  id:                'rc-1',
  school_id:         'school-1',
  student_id:        'stu-1',
  term:              '1',
  year:              2025,
  status:            'ready',
  principal_remarks: null,
  generated_at:      '2025-06-01T10:00:00Z',
  approved_at:       null,
  approved_by:       null,
  released_at:       null,
  released_by:       null,
  unlock_reason:     null,
  unlock_count:      0,
  pdf_url:           'https://storage.url/rc-1.pdf',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearResponses()
})

describe('useReportCards', () => {
  it('returns mapped ReportCard objects', async () => {
    setResponse('report_cards', { data: [dbReportCard], error: null })
    const { result } = renderHook(
      () => useReportCards({ term: '1', year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    const rc = result.current.data![0]
    expect(rc.id).toBe('rc-1')
    expect(rc.status).toBe('ready')
    expect(rc.term).toBe('1')
    expect(rc.year).toBe(2025)
    expect(rc.pdfUrl).toBe('https://storage.url/rc-1.pdf')
    expect(rc.approvedAt).toBeNull()
  })

  it('returns empty array when no report cards exist', async () => {
    setResponse('report_cards', { data: [], error: null })
    const { result } = renderHook(
      () => useReportCards({ term: '1', year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('is disabled when enabled=false', () => {
    const { result } = renderHook(
      () => useReportCards({ term: '1', year: 2025 }, false),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('exposes error when Supabase fails', async () => {
    setResponse('report_cards', { data: null, error: { message: 'Access denied' } })
    const { result } = renderHook(
      () => useReportCards({ term: '1', year: 2025 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useApproveReportCard', () => {
  it('calls supabase update with status=approved', async () => {
    setResponse('report_cards', { data: null, error: null })
    const { result } = renderHook(() => useApproveReportCard(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        reportCardId: 'rc-1',
        principalRemarks: 'Excellent progress!',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('report_cards')
  })

  it('throws when supabase update fails', async () => {
    setResponse('report_cards', { data: null, error: { message: 'Update failed' } })
    const { result } = renderHook(() => useApproveReportCard(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportCardId: 'rc-1' })
      ).rejects.toEqual({ message: 'Update failed' })
    })
  })
})

describe('useReleaseReportCard', () => {
  it('calls supabase update with status=released', async () => {
    setResponse('report_cards', { data: null, error: null })
    const { result } = renderHook(() => useReleaseReportCard(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ reportCardId: 'rc-1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useUnlockReportCard', () => {
  it('calls supabase update with status=draft (unlocks for editing)', async () => {
    setResponse('report_cards', { data: null, error: null })
    const { result } = renderHook(() => useUnlockReportCard(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        reportCardId: 'rc-1',
        unlockReason: 'Wrong mark entered',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('schema boundary: report_cards', () => {
  it('mapper exposes approvedBy, releasedBy, unlockCount, unlockReason from DB', async () => {
    setResponse('report_cards', { data: [{
      ...dbReportCard,
      approved_by: 'principal-1', released_by: 'principal-1',
      unlock_reason: 'Incorrect grade', unlock_count: 1,
    }], error: null })
    const { result } = renderHook(() => useReportCards({ term: '1', year: 2025 }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const rc = result.current.data![0]
    expect(rc.approvedBy).toBe('principal-1')
    expect(rc.releasedBy).toBe('principal-1')
    expect(rc.unlockReason).toBe('Incorrect grade')
    expect(rc.unlockCount).toBe(1)
  })

  it('mapper reads unlock_count from DB row and defaults to 0 when null', async () => {
    setResponse('report_cards', { data: [{ ...dbReportCard, unlock_count: null }], error: null })
    const { result } = renderHook(() => useReportCards({ term: '1', year: 2025 }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].unlockCount).toBe(0)
  })
})
