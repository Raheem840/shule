import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '../utils'
import userEvent from '@testing-library/user-event'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:        vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'teacher', schoolId: 's1', name: 'T', email: 't@k.ug' }, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}))
vi.mock('../../hooks/useExamJournal', () => ({
  useExamJournals:  () => ({ data: [], isLoading: false }),
  useCreateJournal: () => ({ mutateAsync: vi.fn().mockResolvedValue('j-1'), isPending: false }),
  useNextCALabel:   () => ({ data: 'C1', isLoading: false }),
}))
vi.mock('../../hooks/useClasses', () => ({
  useClasses:  () => ({ data: [], isLoading: false }),
  useStreams:   () => ({ data: [], isLoading: false }),
  useSubjects: () => ({ data: [], isLoading: false }),
}))

import { ExamJournalPage, journalSchema } from '../../pages/teacher/ExamJournalPage'

beforeEach(() => vi.clearAllMocks())

describe('ExamJournalPage', () => {
  it('renders the Exam Journal page header', () => {
    render(<ExamJournalPage />)
    expect(screen.getByText('Exam Journal')).toBeInTheDocument()
  })

  it('renders a "Create Journal Entry" button', () => {
    render(<ExamJournalPage />)
    expect(screen.getByRole('button', { name: /create journal entry/i })).toBeInTheDocument()
  })

  it('shows "No journal entries yet" when there are no journals', () => {
    render(<ExamJournalPage />)
    expect(screen.getByText(/no journal entries yet/i)).toBeInTheDocument()
  })

  it('clicking "Create Journal Entry" opens the create modal (shows Assessment Type field)', async () => {
    const user = userEvent.setup()
    render(<ExamJournalPage />)

    await user.click(screen.getByRole('button', { name: /create journal entry/i }))

    // The modal form has an "Assessment Type" label that only appears inside the modal
    await waitFor(() => {
      expect(screen.getByText('Assessment Type')).toBeInTheDocument()
    })
  })

  describe('Create Journal modal — totalMarks field', () => {
    // Default assessment type in the modal is 'ca' (which hides totalMarks).
    // These tests switch to 'mid_term' to show the totalMarks field.
    async function openModalWithMidTerm() {
      const user = userEvent.setup()
      render(<ExamJournalPage />)
      await user.click(screen.getByRole('button', { name: /create journal entry/i }))
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

      const dialog = screen.getByRole('dialog')

      // Change from default 'ca' to 'mid_term' (within the dialog) to reveal totalMarks
      const assessmentSelect = within(dialog).getAllByRole('combobox')[0]
      await user.selectOptions(assessmentSelect, 'mid_term')
      await waitFor(() => expect(within(dialog).queryByLabelText(/total marks/i)).toBeInTheDocument())

      return user
    }

    it('totalMarks input is present for non-CA assessment type (mid_term)', async () => {
      await openModalWithMidTerm()
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByLabelText(/total marks/i)).toBeInTheDocument()
    })

    it('valid totalMarks value of 80 can be entered without error', async () => {
      const user = await openModalWithMidTerm()
      const dialog = screen.getByRole('dialog')
      const input = within(dialog).getByLabelText(/total marks/i)
      await user.clear(input)
      await user.type(input, '80')
      expect((input as HTMLInputElement).value).toBe('80')
    })

    it('zero totalMarks causes validation error on submit', async () => {
      const user = await openModalWithMidTerm()
      const dialog = screen.getByRole('dialog')
      const input = within(dialog).getByLabelText(/total marks/i)
      await user.clear(input)
      await user.type(input, '0')

      await user.click(within(dialog).getByRole('button', { name: /create journal/i }))

      // superRefine reports error for totalMarks < 1 in non-CA assessments
      await waitFor(() => {
        expect(within(dialog).getByText(/total marks is required/i)).toBeInTheDocument()
      })
    })

    it('rejects totalMarks above 100 (max 100 enforced)', () => {
      const base = {
        assessmentType: 'mid_term' as const,
        subjectId: 'sub-1', classId: 'cls-1', streamId: null,
        term: '1', date: '2025-06-10',
        totalMarks: 101, passMark: 50,
      }
      const result = journalSchema.safeParse(base)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path.join('.'))
        expect(paths).toContain('totalMarks')
      }
    })
  })
})
