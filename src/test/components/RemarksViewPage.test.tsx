// RemarksViewPage guards remarksMap: if useAllTeacherRemarks ever returns a
// non-Map value (e.g. during a bad cache hydration or a hook bug), the page
// must not throw — it should fall back to an empty Map and render its
// "No remarks recorded yet" empty state.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'principal', schoolId: 's1', name: 'P', email: 'p@k.ug' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../../components/ui/TermPicker', () => ({
  TermPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="term-picker" value={value} onChange={e => onChange(e.target.value)}>
      {['1', '2', '3'].map(t => <option key={t} value={t}>Term {t}</option>)}
    </select>
  ),
}))

const { STUDENTS } = vi.hoisted(() => ({
  STUDENTS: [
    { id: 'stu-1', firstName: 'Grace', lastName: 'Apio', admissionNumber: 'KAB/2026/001', classId: 'c1', streamId: null, gender: 'female' },
  ],
}))

vi.mock('../../hooks/useStudents', () => ({
  useStudents: vi.fn().mockReturnValue({ data: STUDENTS, isLoading: false }),
}))
vi.mock('../../hooks/useClasses', () => ({
  useClasses: vi.fn().mockReturnValue({ data: [{ id: 'c1', name: 'S.1' }] }),
  useStreams: vi.fn().mockReturnValue({ data: [] }),
}))
vi.mock('../../hooks/useStaff', () => ({
  useStaff: vi.fn().mockReturnValue({ data: [] }),
}))

const mockUseAllTeacherRemarks = vi.fn()
vi.mock('../../hooks/useTeacherRemarks', () => ({
  useAllTeacherRemarks: (...args: any[]) => mockUseAllTeacherRemarks(...args),
}))

import { RemarksViewPage } from '../../pages/shared/RemarksViewPage'

describe('RemarksViewPage — remarksMap guard', () => {
  it('renders without throwing and shows the empty state when the hook returns a plain array', () => {
    mockUseAllTeacherRemarks.mockReturnValue({ data: [{ not: 'a map' }], isLoading: false })
    expect(() => render(<RemarksViewPage />)).not.toThrow()
    expect(screen.getByText(/no remarks recorded yet/i)).toBeInTheDocument()
  })

  it('renders without throwing and shows the empty state when the hook returns undefined', () => {
    mockUseAllTeacherRemarks.mockReturnValue({ data: undefined, isLoading: false })
    expect(() => render(<RemarksViewPage />)).not.toThrow()
    expect(screen.getByText(/no remarks recorded yet/i)).toBeInTheDocument()
  })

  it('still renders normally when the hook returns a real Map', () => {
    const map = new Map([['stu-1', [{ id: 'r1', teacherId: 't1', remarks: 'Great progress' }]]])
    mockUseAllTeacherRemarks.mockReturnValue({ data: map, isLoading: false })
    render(<RemarksViewPage />)
    expect(screen.getByText('Grace Apio')).toBeInTheDocument()
    expect(screen.queryByText(/no remarks recorded yet/i)).not.toBeInTheDocument()
  })
})
