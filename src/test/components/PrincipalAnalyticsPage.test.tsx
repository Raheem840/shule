// PrincipalAnalyticsPage now has a ClassPicker on both the Academic tab
// (filters the class pass-rate heatmap) and the Attendance tab (filters the
// "Attendance by Class" bar chart), and a TermPicker on the Finance tab wired
// to useFeeCollectionByClass(term, null) — replacing the previous hardcoded
// useFeeCollectionByClass(1, null). This test mounts the page with all its
// hooks mocked and checks the pickers render in the right tabs.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  }
})

const { CLASSES } = vi.hoisted(() => ({
  CLASSES: [{ id: 'c1', name: 'S.1' }, { id: 'c2', name: 'S.2' }],
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn().mockReturnValue({ data: CLASSES, isLoading: false }),
}))

vi.mock('../../hooks/useDos', () => ({
  useDosOverview: vi.fn().mockReturnValue({
    data: { passRateTrend: [], subjectRankings: [] },
    isLoading: false,
  }),
}))

const mockUseFeeCollectionByClass = vi.fn()
vi.mock('../../hooks/useFeePayments', () => ({
  useFeeCollectionByClass: (...args: any[]) => mockUseFeeCollectionByClass(...args),
  ugx: (v: number) => `UGX ${v.toLocaleString()}`,
}))

vi.mock('../../hooks/usePrincipal', () => ({
  usePrincipalKpis: vi.fn().mockReturnValue({
    data: {
      totalStudents: 100, totalStaff: 10, overallPassRate: 72,
      feeCollectionRate: 80, attendanceRateThisWeek: 88, pendingReportCards: 2,
    },
    isLoading: false, isError: false,
  }),
  useAllClassPerformance: vi.fn().mockReturnValue({
    data: [{ classId: 'c1', className: 'S.1', passRate: 75, avgScore: 68, studentCount: 30, resultCount: 20 }],
    isLoading: false, isError: false,
  }),
  useAttendanceByClass: vi.fn().mockReturnValue({
    data: [{ classId: 'c1', className: 'S.1', rate: 90, present: 27, total: 30 }],
    isLoading: false,
  }),
  useGenderEnrollment: vi.fn().mockReturnValue({ data: [{ gender: 'Male', count: 50 }, { gender: 'Female', count: 50 }], isLoading: false }),
  useStaffRoleBreakdown: vi.fn().mockReturnValue({ data: [{ role: 'teacher', count: 8 }], isLoading: false }),
  useMonthlyDiscipline: vi.fn().mockReturnValue({ data: [{ month: 'Jan 26', count: 1 }], isLoading: false }),
  useSchoolFeeSummary: vi.fn().mockReturnValue({
    data: { totalExpected: 1000000, totalCollected: 800000, outstanding: 200000, overdueCount: 5 },
    isLoading: false,
  }),
}))

import { PrincipalAnalyticsPage } from '../../pages/principal/PrincipalAnalyticsPage'

describe('PrincipalAnalyticsPage — Class/Term pickers', () => {
  it('renders a class dropdown with "All Classes" on the Academic tab', () => {
    mockUseFeeCollectionByClass.mockReturnValue({ data: [], isLoading: false })
    render(<PrincipalAnalyticsPage />)

    expect(screen.getByText('All Classes')).toBeInTheDocument()
    expect(screen.getByText('Class Pass Rate Heatmap')).toBeInTheDocument()
  })

  it('renders a class dropdown on the Attendance tab', async () => {
    mockUseFeeCollectionByClass.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<PrincipalAnalyticsPage />)

    await user.click(screen.getByRole('button', { name: 'Attendance' }))
    expect(screen.getByText('Attendance by Class — Last 30 Days')).toBeInTheDocument()
    // Two class pickers exist in total now (only one visible per active tab, but both selects render "All Classes")
    expect(screen.getAllByText('All Classes').length).toBeGreaterThan(0)
  })

  it('switching to the Finance tab renders the Term picker (Term 1/2/3 buttons)', async () => {
    mockUseFeeCollectionByClass.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<PrincipalAnalyticsPage />)

    await user.click(screen.getByRole('button', { name: 'Finance' }))

    expect(screen.getByRole('button', { name: 'Term 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Term 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Term 3' })).toBeInTheDocument()
  })

  it('calls useFeeCollectionByClass with the numeric term selected via the picker', async () => {
    mockUseFeeCollectionByClass.mockReturnValue({ data: [], isLoading: false })
    const user = userEvent.setup()
    render(<PrincipalAnalyticsPage />)

    await user.click(screen.getByRole('button', { name: 'Finance' }))
    await waitFor(() => expect(mockUseFeeCollectionByClass).toHaveBeenCalledWith(1, null))

    await user.click(screen.getByRole('button', { name: 'Term 2' }))
    await waitFor(() => expect(mockUseFeeCollectionByClass).toHaveBeenCalledWith(2, null))
  })
})
