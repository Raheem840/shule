import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '../utils'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (t: string, r: any) => { tableData[t] = r }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  function makeBuilder(table: string) {
    const b: any = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      then: (res: any, rej?: any) => Promise.resolve(tableData[table] ?? { data: [], error: null }).then(res, rej),
    }
    return b
  }
  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setResponse, clearResponses }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'secretary-1', role: 'secretary', schoolId: 'school-1', name: 'S', email: 's@k.ug' },
    loading: false, signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />, XAxis: () => <div />, YAxis: () => <div />,
  CartesianGrid: () => <div />, Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../components/shared/AttendanceHeatmap', () => ({
  AttendanceHeatmap: () => <div data-testid="heatmap" />,
}))

import { SecretaryReportsPage } from '../../pages/secretary/SecretaryReportsPage'

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

describe('SecretaryReportsPage — Fee Status Summary', () => {
  it('scopes fee_status_for_secretary to the active academic year, not all-time', async () => {
    setResponse('academic_years', { data: [{ id: 'ay-2026', is_active: true }], error: null })
    setResponse('fee_status_for_secretary', { data: [], error: null })
    setResponse('students',       { data: [], error: null })
    setResponse('classes',        { data: [], error: null })

    render(<SecretaryReportsPage />)
    const card = screen.getByText('Fee Status Summary').closest('div[style*="border-radius: 14px"]') as HTMLElement
    fireEvent.click(within(card).getByText('Generate'))

    await waitFor(() => {
      const feeCallIdx = mockFrom.mock.calls.findIndex(c => c[0] === 'fee_status_for_secretary')
      expect(feeCallIdx).toBeGreaterThan(-1)
      const feeBuilder = mockFrom.mock.results[feeCallIdx].value
      expect(feeBuilder.eq).toHaveBeenCalledWith('academic_year_id', 'ay-2026')
    })
  })
})

describe('SecretaryReportsPage — Guardian Contact List', () => {
  beforeEach(() => {
    setResponse('student_guardians', { data: [
      { id: 'g-1', student_id: 'stu-1', full_name: 'Mary Stone',  relationship: 'mother', phone: '+256700000001', email: null, do_not_contact: false },
      { id: 'g-2', student_id: 'stu-2', full_name: 'Peter Nakato', relationship: 'father', phone: '+256700000002', email: null, do_not_contact: false },
    ], error: null })
    setResponse('students', { data: [
      { id: 'stu-1', first_name: 'Amara', last_name: 'Stone',  class_id: 'cls-s1' },
      { id: 'stu-2', first_name: 'Brian', last_name: 'Nakato', class_id: 'cls-s2' },
    ], error: null })
    setResponse('classes', { data: [
      { id: 'cls-s1', name: 'S1' },
      { id: 'cls-s2', name: 'S2' },
    ], error: null })
  })

  function openReport() {
    render(<SecretaryReportsPage />)
    const card = screen.getByText('Guardian Contact List').closest('div[style*="border-radius: 14px"]') as HTMLElement
    fireEvent.click(within(card).getByText('Generate'))
  }

  it('shows a class column and both guardians by default', async () => {
    openReport()
    await waitFor(() => expect(screen.getByText('Mary Stone')).toBeInTheDocument())
    expect(screen.getByText('Peter Nakato')).toBeInTheDocument()
    expect(screen.getAllByText('S1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('S2').length).toBeGreaterThan(0)
  })

  it('filters rows by class pill', async () => {
    openReport()
    await waitFor(() => expect(screen.getByText('Mary Stone')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'S1' }))

    expect(screen.getByText('Mary Stone')).toBeInTheDocument()
    expect(screen.queryByText('Peter Nakato')).not.toBeInTheDocument()
  })

  it('toggles alphabetical sort direction', async () => {
    openReport()
    await waitFor(() => expect(screen.getByText('Mary Stone')).toBeInTheDocument())

    const rowsAsc = screen.getAllByRole('row').slice(1) // skip header
    expect(rowsAsc[0]).toHaveTextContent('Amara Stone')

    fireEvent.click(screen.getByText('Student A→Z'))

    const rowsDesc = screen.getAllByRole('row').slice(1)
    expect(rowsDesc[0]).toHaveTextContent('Brian Nakato')
  })
})
