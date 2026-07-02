// AcademicYearPage's useCreateAcademicYear/useUpdateAcademicYear now run every
// date field through nullIfEmpty(v) before sending it to Supabase, so clearing
// a date input to "" sends `null` (Postgres rejects "" for a date column)
// instead of the empty string. This test drives the real Create/Edit modals
// and captures the payload actually sent to supabase.from('academic_years').
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import userEvent from '@testing-library/user-event'

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'principal', schoolId: 's1', name: 'P', email: 'p@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('../../hooks/useAdmin', () => ({
  useToggleSurvey: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
}))

const insertCalls: any[] = []
const updateCalls: any[] = []
let listResponse: any = { data: [], error: null }

vi.mock('../../lib/supabase', () => {
  function makeBuilder(): any {
    const b: any = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      insert: vi.fn((payload: any) => {
        insertCalls.push(payload)
        return Promise.resolve({ error: null })
      }),
      update: vi.fn((payload: any) => {
        updateCalls.push(payload)
        return b
      }),
      then: (res: any, rej?: any) => Promise.resolve(listResponse).then(res, rej),
    }
    return b
  }
  return {
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      from: vi.fn().mockImplementation(makeBuilder),
    },
  }
})

import { AcademicYearPage } from '../../pages/principal/AcademicYearPage'

const EXISTING_YEAR = {
  id: 'year-1',
  label: '2026',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  is_active: true,
  survey_active: false,
  term1_start: '2026-01-20', term1_end: '2026-04-20',
  term2_start: '2026-05-06', term2_end: '2026-08-10',
  term3_start: '2026-09-01', term3_end: '2026-12-05',
}

beforeEach(() => {
  insertCalls.length = 0
  updateCalls.length = 0
  listResponse = { data: [EXISTING_YEAR], error: null }
})

// FieldRow renders a plain <label> sibling to its <input> with no htmlFor/id
// association, so getByLabelText() can't find it — walk from the label text
// node to the input in the same wrapper div instead.
async function findTerm3EndInput(): Promise<HTMLInputElement> {
  const label = await screen.findByText(/term 3 end/i)
  const input = (label.parentElement as HTMLElement).querySelector('input')
  if (!input) throw new Error('Term 3 End input not found')
  return input as HTMLInputElement
}

describe('AcademicYearPage — nullIfEmpty on date fields', () => {
  it('sends null (not "") for a date field cleared to empty string on update', async () => {
    const user = userEvent.setup()
    render(<AcademicYearPage />)

    await waitFor(() => expect(screen.getByText('2026')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /edit/i }))

    const term3End = await findTerm3EndInput()
    await user.clear(term3End)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updateCalls.length).toBeGreaterThan(0))
    expect(updateCalls[0].term3_end).toBeNull()
    // Untouched fields should still carry their real values, not be nulled out.
    expect(updateCalls[0].term1_start).toBe('2026-01-20')
  })

  it('sends null (not "") for a date field cleared to empty string on create', async () => {
    const user = userEvent.setup()
    render(<AcademicYearPage />)

    await waitFor(() => expect(screen.getByText('2026')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /new year/i }))

    const term3End = await findTerm3EndInput()
    await user.clear(term3End)

    // Default start date is in the future (next calendar year) — must acknowledge the warning to submit.
    const ack = await screen.findByLabelText(/i understand/i)
    await user.click(ack)

    await user.click(screen.getByRole('button', { name: /create year/i }))

    await waitFor(() => expect(insertCalls.length).toBeGreaterThan(0))
    expect(insertCalls[0].term3_end).toBeNull()
  })
})
