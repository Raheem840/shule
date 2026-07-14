// ImportDataPage's student-import handler delegates to the shared
// importStudentsFromCsv() (src/lib/studentImport.ts) — this is now the
// only student-import entry point (the duplicate inline modal on
// SecretaryStudentsPage was removed since it was a stripped-down copy of
// this page). Covers: admission_number left blank for the DB trigger,
// match-by-name+class overwrites instead of duplicating, "skip" strategy,
// blank CSV cells don't null out existing fields, guardian re-import
// updates the existing row instead of inserting a second one.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'
import type { ParsedRow, ConflictStrategy, ImportResult } from '../../components/shared/ImportWizard'

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'secretary', schoolId: 's1', name: 'Secretary', email: 'sec@k.ug' },
    loading: false,
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

let capturedOnComplete: ((rows: ParsedRow[], strategy: ConflictStrategy) => Promise<ImportResult>) | null = null
vi.mock('../../components/shared/ImportWizard', () => ({
  ImportWizard: (props: any) => {
    capturedOnComplete = props.onComplete
    return <div data-testid="import-wizard" />
  },
}))

const { mockFrom, setResponse, clearResponses, insertCalls, updateCalls } = vi.hoisted(() => {
  const tableData: Record<string, any> = {}
  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => { for (const k of Object.keys(tableData)) delete tableData[k] }
  const insertCalls: Array<{ table: string; rows: any }> = []
  const updateCalls: Array<{ table: string; patch: any }> = []

  function makeBuilder(table: string) {
    let lastInsert: any = null
    let lastUpdate: any = null
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      ilike:       vi.fn().mockReturnThis(),
      like:        vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      insert:      vi.fn((rows: any) => { lastInsert = rows; insertCalls.push({ table, rows }); return b }),
      update:      vi.fn((patch: any) => { lastUpdate = patch; updateCalls.push({ table, patch }); return b }),
      single:      vi.fn().mockImplementation(() => Promise.resolve(
        lastInsert ? { data: { id: 'new-student-id', first_name: lastInsert.first_name, last_name: lastInsert.last_name, admission_number: lastInsert.admission_number ?? 'AUTO/2026/0001' }, error: null }
                   : (tableData[table] ?? { data: null, error: null })
      )),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(tableData[table] ?? { data: null, error: null })),
      then: (res: any, rej?: any) => {
        if (lastUpdate) return Promise.resolve({ data: null, error: null }).then(res, rej)
        return Promise.resolve(tableData[table] ?? { data: [], error: null }).then(res, rej)
      },
    }
    return b
  }
  const mockFrom = vi.fn().mockImplementation(makeBuilder)
  return { mockFrom, setResponse, clearResponses, insertCalls, updateCalls }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: mockFrom,
  },
}))

import { ImportDataPage } from '../../pages/secretary/ImportDataPage'

beforeEach(() => {
  capturedOnComplete = null
  insertCalls.length = 0
  updateCalls.length = 0
  clearResponses()
  setResponse('classes', { data: [{ id: 'c1', name: 'S.1' }], error: null })
  setResponse('streams', { data: [], error: null })
  setResponse('academic_years', { data: { id: 'year-1' }, error: null })
  setResponse('students', { data: [], error: null })
  setResponse('school_profile', { data: { short_name: 'KAB' }, error: null })
})

describe('ImportDataPage — student import (shared importStudentsFromCsv)', () => {
  it('does not require admission_number — leaves it blank for the DB trigger to generate', async () => {
    render(<ImportDataPage />)
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument()
    expect(capturedOnComplete).toBeTruthy()

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', class_name: 'S.1' },
    ]

    await capturedOnComplete!(rows, 'upsert')

    const studentInsert = insertCalls.find(c => c.table === 'students')
    expect(studentInsert).toBeTruthy()
    expect(studentInsert!.rows.admission_number).toBeUndefined()
  })

  it('matches an existing student by name+class and UPDATEs (overwrites) rather than inserting a duplicate', async () => {
    setResponse('students', {
      data: [{ id: 'existing-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'KAB/2026/0001', class_id: 'c1' }],
      error: null,
    })
    render(<ImportDataPage />)

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', class_name: 'S.1', religion: 'Christian' },
    ]

    const result = await capturedOnComplete!(rows, 'upsert')

    expect(result.updated).toBe(1)
    expect(result.imported).toBe(0)
    const studentUpdate = updateCalls.find(c => c.table === 'students')
    expect(studentUpdate).toBeTruthy()
    expect(studentUpdate!.patch.religion).toBe('Christian')
    expect(insertCalls.find(c => c.table === 'students')).toBeUndefined()
  })

  it('honors "skip" strategy — leaves an existing matched student untouched', async () => {
    setResponse('students', {
      data: [{ id: 'existing-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'KAB/2026/0001', class_id: 'c1' }],
      error: null,
    })
    render(<ImportDataPage />)

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', class_name: 'S.1', religion: 'Christian' },
    ]

    const result = await capturedOnComplete!(rows, 'skip')

    expect(result.skipped).toBe(1)
    expect(result.updated).toBe(0)
    expect(updateCalls.find(c => c.table === 'students')).toBeUndefined()
    expect(updateCalls.find(c => c.table === 'student_guardians')).toBeUndefined()
  })

  it('preserves existing profile fields when the CSV cell is blank on update, instead of nulling them', async () => {
    setResponse('students', {
      data: [{ id: 'existing-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'KAB/2026/0001', class_id: 'c1' }],
      error: null,
    })
    render(<ImportDataPage />)

    // CSV row has no dob/religion/previous_school columns filled in at all.
    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', class_name: 'S.1' },
    ]

    await capturedOnComplete!(rows, 'upsert')

    const studentUpdate = updateCalls.find(c => c.table === 'students')
    expect(studentUpdate).toBeTruthy()
    expect(studentUpdate!.patch).not.toHaveProperty('dob')
    expect(studentUpdate!.patch).not.toHaveProperty('religion')
    expect(studentUpdate!.patch).not.toHaveProperty('previous_school')
  })

  it('re-importing a guardian for an existing student UPDATEs the existing guardian row instead of inserting a duplicate', async () => {
    setResponse('students', {
      data: [{ id: 'existing-1', first_name: 'Grace', last_name: 'Apio', admission_number: 'KAB/2026/0001', class_id: 'c1' }],
      error: null,
    })
    setResponse('student_guardians', { data: { id: 'guardian-1' }, error: null })
    render(<ImportDataPage />)

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', class_name: 'S.1', parent_name: 'Jane Apio', parent_phone: '0700000000' },
    ]

    await capturedOnComplete!(rows, 'upsert')

    const guardianUpdate = updateCalls.find(c => c.table === 'student_guardians')
    const guardianInsert = insertCalls.find(c => c.table === 'student_guardians')
    expect(guardianUpdate).toBeTruthy()
    expect(guardianUpdate!.patch.phone).toBe('0700000000')
    expect(guardianInsert).toBeUndefined()
  })
})
