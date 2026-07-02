// ImportDataPage.handleStudentImport now treats class_name as a required
// field — rows whose class_name fails to resolve to a real class (via
// classMap) get pushed to failedItems with a reason, instead of silently
// inserting a student with class_id: null. This test captures the
// ImportWizard's onComplete callback and drives it directly.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'
import type { ParsedRow, ImportResult } from '../../components/shared/ImportWizard'

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'secretary', schoolId: 's1', name: 'Secretary', email: 'sec@school.ac.ug' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../lib/importTemplates', () => ({
  generateImportTemplate: vi.fn(),
}))

vi.mock('../../lib/validators', () => ({
  validateStudentRow: vi.fn().mockReturnValue(null),
  validateStaffRow:   vi.fn().mockReturnValue(null),
  capitalizeName:     (s: string) => s,
  normalizeEmail:     (s: string) => s,
  normalizePhone:     (s: string) => ({ normalized: s, warning: null }),
}))

let capturedOnComplete: ((rows: ParsedRow[]) => Promise<ImportResult>) | null = null
vi.mock('../../components/shared/ImportWizard', () => ({
  ImportWizard: (props: any) => {
    capturedOnComplete = props.onComplete
    return <div data-testid="import-wizard" />
  },
}))

const insertCalls: Array<{ table: string; payload: any }> = []

vi.mock('../../lib/supabase', () => {
  const responses: Record<string, any> = {
    classes:        { data: [{ id: 'c1', name: 'S.1' }], error: null },
    streams:        { data: [], error: null },
    academic_years: { data: { id: 'year-1' }, error: null },
    students:       { data: [], error: null },
    school_profile: { data: { short_name: 'NYS' }, error: null },
  }

  function makeBuilder(table: string) {
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      like:        vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(responses[table])),
      single:      vi.fn().mockImplementation(() => Promise.resolve(responses[table])),
      insert: vi.fn((payload: any) => {
        insertCalls.push({ table, payload })
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-1',
              first_name: payload.first_name,
              last_name:  payload.last_name,
              admission_number: payload.admission_number ?? 'NYS/2026/0001',
            },
            error: null,
          }),
        }
      }),
      update: vi.fn().mockReturnThis(),
      then: (res: any, rej?: any) => Promise.resolve(responses[table]).then(res, rej),
    }
    return b
  }

  return {
    supabase: {
      auth: {
        getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
      from: vi.fn().mockImplementation(makeBuilder),
    },
  }
})

import { ImportDataPage } from '../../pages/secretary/ImportDataPage'

beforeEach(() => {
  capturedOnComplete = null
  insertCalls.length = 0
})

describe('ImportDataPage — class_name required for student import', () => {
  it('imports a row with a valid class and rejects a row with a blank class', async () => {
    render(<ImportDataPage />)
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument()
    expect(capturedOnComplete).toBeTruthy()

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', class_name: 'S.1' },
      { first_name: 'Joel',  last_name: 'Otim', class_name: '' },
    ]

    const result = await capturedOnComplete!(rows)

    expect(result.imported).toBe(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]).toMatchObject({ row: 3, reason: 'Class is required' })

    const studentInserts = insertCalls.filter(c => c.table === 'students')
    expect(studentInserts).toHaveLength(1)
    expect(studentInserts[0].payload.first_name).toBe('Grace')
    expect(studentInserts[0].payload.class_id).toBe('c1')
  })

  it('rejects a row whose class_name does not match any existing class', async () => {
    render(<ImportDataPage />)

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', class_name: 'S.1' },
      { first_name: 'Sam',   last_name: 'Okot', class_name: 'Nonexistent Class' },
    ]

    const result = await capturedOnComplete!(rows)

    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]).toMatchObject({ row: 3, reason: 'Class "Nonexistent Class" does not match any existing class' })

    const studentInserts = insertCalls.filter(c => c.table === 'students')
    expect(studentInserts).toHaveLength(1)
    expect(studentInserts[0].payload.first_name).toBe('Grace')
  })
})
