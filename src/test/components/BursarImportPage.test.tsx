import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'
import type { ParsedRow } from '../../components/shared/ImportWizard'

// ── ImportWizard stub — exposes a button that fires onComplete with fixed rows ──
let capturedRows: ParsedRow[] = []
vi.mock('../../components/shared/ImportWizard', () => ({
  ImportWizard: ({ onComplete }: { onComplete: (rows: ParsedRow[], strategy: 'skip' | 'update') => Promise<unknown> }) => (
    <button onClick={() => void onComplete(capturedRows, 'update')}>Run Wizard</button>
  ),
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
      insert:      vi.fn().mockImplementation(() => Promise.resolve(tableData[`${table}_insert`] ?? { error: null })),
      update:      vi.fn().mockReturnThis(),
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
    user: { id: 'u1', role: 'bursar', schoolId: 'school-1', staffId: 'staff-1', name: 'Bursar B', email: 'b@school.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../lib/importTemplates', () => ({
  downloadFeeTemplate: vi.fn(),
}))

import { BursarImportPage } from '../../pages/bursar/BursarImportPage'

beforeEach(() => { vi.clearAllMocks(); clearResponses(); capturedRows = [] })

function setupBaseTables() {
  setResponse('academic_years', { data: { id: 'year-1' }, error: null })
  setResponse('classes', { data: [{ id: 'cls-1', name: 'S.1' }], error: null })
  setResponse('streams', { data: [], error: null })
  setResponse('fee_structure', { data: [{ id: 'fs-tuition', name: 'Tuition', class_id: null, term: 1 }], error: null })
}

describe('BursarImportPage — fee_structure_id resolution + dedupe', () => {
  it('resolves fee_type "Tuition" to the matching fee_structure row and inserts fee_structure_id (not null)', async () => {
    setupBaseTables()
    setResponse('students', {
      data: [{ id: 'stu-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'A1', class_id: 'cls-1', stream_id: null }],
      error: null,
    })
    setResponse('fee_payments', { data: [], error: null }) // no existing rows → insert path

    capturedRows = [{
      student_name: 'Grace Apio', class_name: 'S.1', stream_name: '', fee_type: 'Tuition',
      term: '1', year: '2026', amount_paid: '100000', amount_due: '400000',
      payment_date: '', receipt_number: '', notes: '',
    } as unknown as ParsedRow]

    const user = userEvent.setup()
    render(<BursarImportPage />)
    await user.click(screen.getByText('Run Wizard'))

    await waitFor(() => expect(screen.getByText(/Import 1 Record/i)).toBeInTheDocument())
    await user.click(screen.getByText(/Import 1 Record/i))

    await waitFor(() => expect(screen.getByText('Import Complete')).toBeInTheDocument())

    const feePaymentsBuilders = mockFrom.mock.calls
      .map((_, i) => mockFrom.mock.results[i].value)
      .filter((_, i) => mockFrom.mock.calls[i][0] === 'fee_payments')
    const insertingBuilder = feePaymentsBuilders.find(b => (b.insert as ReturnType<typeof vi.fn>).mock.calls.length > 0)
    expect(insertingBuilder).toBeDefined()
    expect(insertingBuilder!.insert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ fee_structure_id: 'fs-tuition', student_id: 'stu-1' })])
    )
  })

  it('updates an existing fee_payments row instead of inserting a duplicate on re-import', async () => {
    setupBaseTables()
    setResponse('students', {
      data: [{ id: 'stu-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'A1', class_id: 'cls-1', stream_id: null }],
      error: null,
    })
    // An existing row already covers this student/term/fee_structure combo.
    setResponse('fee_payments', {
      data: [{ id: 'existing-row-1', student_id: 'stu-1', fee_structure_id: 'fs-tuition', term: 1 }],
      error: null,
    })

    capturedRows = [{
      student_name: 'Grace Apio', class_name: 'S.1', stream_name: '', fee_type: 'Tuition',
      term: '1', year: '2026', amount_paid: '200000', amount_due: '400000',
      payment_date: '', receipt_number: '', notes: '',
    } as unknown as ParsedRow]

    const user = userEvent.setup()
    render(<BursarImportPage />)
    await user.click(screen.getByText('Run Wizard'))

    await waitFor(() => expect(screen.getByText(/Import 1 Record/i)).toBeInTheDocument())
    await user.click(screen.getByText(/Import 1 Record/i))

    await waitFor(() => expect(screen.getByText('Import Complete')).toBeInTheDocument())
    expect(screen.getByText('Updated')).toBeInTheDocument()

    const feePaymentsCalls = mockFrom.mock.calls
      .map((c, i) => ({ call: c, result: mockFrom.mock.results[i].value }))
      .filter(c => c.call[0] === 'fee_payments')
    const updateCalled = feePaymentsCalls.some(c => (c.result.update as ReturnType<typeof vi.fn>).mock.calls.length > 0)
    expect(updateCalled).toBe(true)
  })

  it('falls back to a legacy null-fee_structure_id row when re-importing a file that now resolves a fee_type — updates it in place instead of inserting a duplicate', async () => {
    setupBaseTables()
    setResponse('students', {
      data: [{ id: 'stu-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'A1', class_id: 'cls-1', stream_id: null }],
      error: null,
    })
    // Existing row was written by an earlier import that had no fee_type column
    // (fee_structure_id null) — this import's CSV now includes fee_type=Tuition.
    setResponse('fee_payments', {
      data: [{ id: 'legacy-row-1', student_id: 'stu-1', fee_structure_id: null, term: 1 }],
      error: null,
    })

    capturedRows = [{
      student_name: 'Grace Apio', class_name: 'S.1', stream_name: '', fee_type: 'Tuition',
      term: '1', year: '2026', amount_paid: '250000', amount_due: '400000',
      payment_date: '', receipt_number: '', notes: '',
    } as unknown as ParsedRow]

    const user = userEvent.setup()
    render(<BursarImportPage />)
    await user.click(screen.getByText('Run Wizard'))

    await waitFor(() => expect(screen.getByText(/Import 1 Record/i)).toBeInTheDocument())
    await user.click(screen.getByText(/Import 1 Record/i))

    await waitFor(() => expect(screen.getByText('Import Complete')).toBeInTheDocument())
    expect(screen.getByText('Updated')).toBeInTheDocument()

    const feePaymentsBuilders = mockFrom.mock.calls
      .map((_, i) => mockFrom.mock.results[i].value)
      .filter((_, i) => mockFrom.mock.calls[i][0] === 'fee_payments')
    const updatingBuilder = feePaymentsBuilders.find(b => (b.update as ReturnType<typeof vi.fn>).mock.calls.length > 0)
    expect(updatingBuilder).toBeDefined()
    // Updates the legacy row in place — and now stamps its resolved fee_structure_id —
    // rather than inserting a second row (which would double-count collections).
    expect(updatingBuilder!.update).toHaveBeenCalledWith(
      expect.objectContaining({ fee_structure_id: 'fs-tuition' })
    )
    expect(feePaymentsBuilders.some(b => (b.insert as ReturnType<typeof vi.fn>).mock.calls.length > 0)).toBe(false)
  })
})
