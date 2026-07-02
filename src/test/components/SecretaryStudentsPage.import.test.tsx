// SecretaryStudentsPage.handleImportComplete now rejects rows whose `class`
// cell doesn't resolve to a real class (via classMap) — pushing them into
// result.failed with a reason, instead of silently inserting class_id: null.
// This test captures the ImportWizard's onComplete callback and drives it
// directly with rows that include one valid and one invalid class value.
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

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn().mockReturnValue({ data: [{ id: 'c1', name: 'S.1' }], isLoading: false }),
  useStreams: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

vi.mock('../../pages/secretary/StudentsPage', () => ({
  StudentsPage: () => <div data-testid="students-page">students list</div>,
}))
vi.mock('../../pages/secretary/StudentRegistrationWizard', () => ({
  StudentRegistrationWizard: () => null,
}))
vi.mock('../../components/shared/PromoteStudentsSection', () => ({
  PromoteStudentsSection: () => null,
}))
// Always render children regardless of `open` — the import modal is normally
// only mounted after clicking "Import" inside the (stubbed) StudentsPage, but
// we need the ImportWizard mock to mount unconditionally so it can capture
// the onComplete callback passed to it.
vi.mock('../../components/ui/Modal', () => ({
  Modal: ({ children }: any) => <div>{children}</div>,
}))

let capturedOnComplete: ((rows: ParsedRow[], strategy: ConflictStrategy) => Promise<ImportResult>) | null = null
vi.mock('../../components/shared/ImportWizard', () => ({
  ImportWizard: (props: any) => {
    capturedOnComplete = props.onComplete
    return <div data-testid="import-wizard" />
  },
}))

const upsertCalls: any[] = []
vi.mock('../../lib/supabase', () => {
  const builder: any = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'year-1' }, error: null }),
    upsert:      vi.fn((rows: any, opts: any) => {
      upsertCalls.push({ rows, opts })
      return Promise.resolve({ data: null, error: null })
    }),
  }
  return {
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      from: vi.fn().mockReturnValue(builder),
    },
  }
})

import { SecretaryStudentsPage } from '../../pages/secretary/SecretaryStudentsPage'

beforeEach(() => {
  capturedOnComplete = null
  upsertCalls.length = 0
})

describe('SecretaryStudentsPage — import class validation', () => {
  it('rejects a row with a blank/unmatched class and only upserts the valid row', async () => {
    render(<SecretaryStudentsPage />)
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument()
    expect(capturedOnComplete).toBeTruthy()

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', admission_number: 'KAB/2026/010', class: 'S.1' },
      { first_name: 'Joel',  last_name: 'Otim', admission_number: 'KAB/2026/011', class: '' },
    ]

    const result = await capturedOnComplete!(rows, 'upsert')

    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]).toMatchObject({ row: 2, reason: 'Class is required' })
    expect(result.imported).toBe(1)

    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].rows).toHaveLength(1)
    expect(upsertCalls[0].rows[0].first_name).toBe('Grace')
  })

  it('rejects a row whose class name does not match any existing class', async () => {
    render(<SecretaryStudentsPage />)

    const rows: ParsedRow[] = [
      { first_name: 'Grace', last_name: 'Apio', admission_number: 'KAB/2026/010', class: 'S.1' },
      { first_name: 'Sam',   last_name: 'Okot', admission_number: 'KAB/2026/012', class: 'Nonexistent Class' },
    ]

    const result = await capturedOnComplete!(rows, 'upsert')

    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]).toMatchObject({ row: 2, reason: 'Class "Nonexistent Class" does not match any existing class' })
    expect(upsertCalls[0].rows).toHaveLength(1)
  })
})
