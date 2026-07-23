import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (t: string, r: any) => { tableData[t] = r }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  function makeBuilder(table: string) {
    const b: any = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null })),
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
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />, XAxis: () => <div />, YAxis: () => <div />,
  CartesianGrid: () => <div />, Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../pages/secretary/StudentRegistrationWizard', () => ({
  StudentRegistrationWizard: () => <div data-testid="wizard" />,
}))

vi.mock('../../components/shared/FeeStatusDonut', () => ({
  FeeStatusDonut: () => <div data-testid="fee-donut" />,
}))

import { SecretaryDashboard } from '../../pages/secretary/SecretaryDashboard'

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

describe('SecretaryDashboard — Enrollment by Class heatmap', () => {
  it('groups new enrollments by class and month into the heatmap', async () => {
    const year = new Date().getFullYear()
    setResponse('students', { data: [
      { id: 's1', status: 'active', class_id: 'cls-1', enrolled_at: `${year}-01-15T00:00:00Z` },
      { id: 's2', status: 'active', class_id: 'cls-1', enrolled_at: `${year}-01-20T00:00:00Z` },
      { id: 's3', status: 'active', class_id: 'cls-2', enrolled_at: `${year}-03-01T00:00:00Z` },
      { id: 's4', status: 'active', class_id: 'cls-2', enrolled_at: `${year - 1}-03-01T00:00:00Z` }, // different year — excluded
    ], error: null })
    setResponse('classes', { data: [
      { id: 'cls-1', name: 'S1' },
      { id: 'cls-2', name: 'S2' },
    ], error: null })
    setResponse('staff',           { data: [], error: null })
    setResponse('report_cards',    { data: [], error: null })
    setResponse('exam_results',    { data: [], error: null })
    setResponse('exam_journal',    { data: [], error: null })
    setResponse('fee_status_for_secretary', { data: [], error: null })
    setResponse('audit_log',       { data: [], error: null })
    setResponse('academic_years',  { data: [], error: null })
    setResponse('school_profile',  { data: { school_name: 'Test School', short_name: 'TS' }, error: null })
    setResponse('parent_accounts', { count: 0, data: [], error: null })

    render(<SecretaryDashboard />)

    await waitFor(() => expect(screen.getByText('Enrollment by Class')).toBeInTheDocument())
    // Rows are keyed by class — S1 (2 enrollments in Jan) and S2 (1 enrollment in Mar).
    expect(await screen.findByText('S1')).toBeInTheDocument()
    expect(screen.getByText('S2')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // S1 Jan count
  })
})
