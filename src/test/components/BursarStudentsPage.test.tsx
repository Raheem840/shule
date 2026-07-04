import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

// ── Virtualiser (avoids DOM measurement issues in jsdom) ───────
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize:    () => 0,
    getVirtualItems: () => [],
    measureElement:  () => {},
  }),
}))

vi.mock('exceljs', () => ({
  default: class Workbook {
    creator = ''; created = new Date()
    addWorksheet() {
      return {
        mergeCells: vi.fn(),
        getCell:    vi.fn().mockReturnValue({}),
        getRow:     vi.fn().mockReturnValue({ height: 0, eachCell: vi.fn(), values: [] }),
        addRow:     vi.fn().mockReturnValue({ height: 0, eachCell: vi.fn() }),
        columns:    [],
      }
    }
    xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array()) }
  },
}))

const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
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
    user: { id: 'u1', role: 'bursar', schoolId: 'school-1', name: 'Bursar B', email: 'b@school.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast:      () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: () => ({ data: [
    { id: 'cls-1', name: 'S.1' },
    { id: 'cls-2', name: 'S.2' },
  ] }),
  useStreams: () => ({ data: [] }),
}))

vi.mock('../../hooks/useFeeStructure', () => ({
  useAcademicYears: () => ({ data: [{ id: 'ay-1', name: '2025/2026', isActive: true }] }),
}))

import { BursarStudentsPage } from '../../pages/bursar/BursarStudentsPage'

beforeEach(() => { vi.clearAllMocks(); clearResponses() })

describe('BursarStudentsPage — All Classes view', () => {
  it('defaults the Class filter to "All Classes" and loads students without requiring a class pick', async () => {
    setResponse('students', {
      data: [
        { id: 'stu-1', admission_number: 'A1', first_name: 'Grace', last_name: 'Apio', gender: 'female', student_type: 'day', class_id: 'cls-1', stream_id: null, classes: { name: 'S.1' }, streams: null },
        { id: 'stu-2', admission_number: 'A2', first_name: 'Brian', last_name: 'Okello', gender: 'male', student_type: 'boarder', class_id: 'cls-2', stream_id: null, classes: { name: 'S.2' }, streams: null },
      ],
      error: null,
    })
    setResponse('fee_payments', { data: [], error: null })
    setResponse('fee_structure', { data: [], error: null })
    setResponse('school_profile', { data: { school_name: 'Test School', short_name: 'TS' }, error: null })

    render(<BursarStudentsPage />)

    // "All Classes" pill is the default active class filter.
    expect(screen.getByText('All Classes')).toBeInTheDocument()
    expect(screen.getByText('S.1')).toBeInTheDocument()
    expect(screen.getByText('S.2')).toBeInTheDocument()

    // Both students (from two different classes) should be counted without picking a class.
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
    expect(screen.getByText('Total Students')).toBeInTheDocument()

    // The old "Select a Class to Begin" gate must be gone.
    expect(screen.queryByText(/select a class to begin/i)).not.toBeInTheDocument()
  })

  it('narrows to a single class once its pill is clicked', async () => {
    setResponse('students', {
      data: [
        { id: 'stu-1', admission_number: 'A1', first_name: 'Grace', last_name: 'Apio', gender: 'female', student_type: 'day', class_id: 'cls-1', stream_id: null, classes: { name: 'S.1' }, streams: null },
      ],
      error: null,
    })
    setResponse('fee_payments', { data: [], error: null })
    setResponse('fee_structure', { data: [], error: null })
    setResponse('school_profile', { data: { school_name: 'Test School', short_name: 'TS' }, error: null })

    const user = userEvent.setup()
    render(<BursarStudentsPage />)

    await user.click(screen.getByText('S.1'))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })

  it('shows a Sort By control with name/balance/% paid options', () => {
    setResponse('students', { data: [], error: null })
    setResponse('fee_payments', { data: [], error: null })
    setResponse('fee_structure', { data: [], error: null })
    setResponse('school_profile', { data: null, error: null })

    render(<BursarStudentsPage />)
    const sortSelect = screen.getByLabelText('Sort by') as HTMLSelectElement
    const optionValues = Array.from(sortSelect.options).map(o => o.value)
    expect(optionValues).toEqual(['name', 'balance', 'pct'])
  })

  it('shows a Boarder / Day pill filter and scopes the student query when clicked', async () => {
    setResponse('students', { data: [], error: null })
    setResponse('fee_payments', { data: [], error: null })
    setResponse('fee_structure', { data: [], error: null })
    setResponse('school_profile', { data: null, error: null })

    const user = userEvent.setup()
    render(<BursarStudentsPage />)

    expect(screen.getByText('All Students')).toBeInTheDocument()
    expect(screen.getByText('Boarder')).toBeInTheDocument()

    await user.click(screen.getByText('Boarder'))

    await waitFor(() => {
      const studentsBuilders = mockFrom.mock.calls
        .map((c, i) => ({ table: c[0], builder: mockFrom.mock.results[i].value }))
        .filter(c => c.table === 'students')
      const scopedCall = studentsBuilders.some(c =>
        (c.builder.eq as ReturnType<typeof vi.fn>).mock.calls.some(args => args[0] === 'student_type' && args[1] === 'boarder')
      )
      expect(scopedCall).toBe(true)
    })
  })
})
