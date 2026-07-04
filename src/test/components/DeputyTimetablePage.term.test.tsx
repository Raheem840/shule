// DeputyTimetablePage previously initialized `term` as 'Term 1' (full format)
// while `useTimetableSlots`/timetable_slots and every other consumer (DOS,
// Teacher, Student portal) use the short '1'/'2'/'3' format — so a Deputy
// viewing the default term would silently see none of the slots DOS actually
// created under the short format. This verifies the query now starts in sync.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'

const { mockUseTimetableSlots } = vi.hoisted(() => ({ mockUseTimetableSlots: vi.fn() }))

vi.mock('../../hooks/useTimetableSlots', () => ({
  useTimetableSlots: mockUseTimetableSlots,
}))

vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn().mockReturnValue({ data: [] }),
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'deputy', schoolId: 's1', name: 'Deputy', email: 'dep@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}))

import { DeputyTimetablePage } from '../../pages/deputy/DeputyTimetablePage'

describe('DeputyTimetablePage — term format', () => {
  it('queries useTimetableSlots with the short term format ("1") on initial load, matching DOS/Teacher/Student', () => {
    mockUseTimetableSlots.mockReturnValue({ data: [], isLoading: false })
    render(<DeputyTimetablePage />)

    expect(mockUseTimetableSlots).toHaveBeenCalledWith(
      expect.objectContaining({ term: '1', published: true })
    )
  })

  it('renders the term picker with "Term 1" pre-selected', () => {
    mockUseTimetableSlots.mockReturnValue({ data: [], isLoading: false })
    render(<DeputyTimetablePage />)
    expect(screen.getByRole('button', { name: 'Term 1' })).toBeInTheDocument()
  })
})
