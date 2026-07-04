import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'
import userEvent from '@testing-library/user-event'
import type { SchoolEvent } from '../../types/week9'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { EventTimeline } from '../../components/shared/EventTimeline'

beforeEach(() => vi.clearAllMocks())

function pastEvent(overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  return {
    id: 'ev-1',
    title: 'Mid Term Test',
    eventDate: '2020-01-01',
    eventType: 'test',
    description: null,
    className: 'S1', streamName: null, subjectName: 'Maths',
    term: '1', totalMarks: 100, passMark: 50,
    journaled: false, journalId: null,
    visibleToParents: false, creatorName: 'Mr T', createdBy: 'staff-1',
    ...overrides,
  } as SchoolEvent
}

describe('EventTimeline — click-to-journal on past events', () => {
  it('clicking a past, unjournaled, journalable event card navigates straight to the exam journal', async () => {
    const user = userEvent.setup()
    render(
      <EventTimeline
        events={[pastEvent()]}
        isLoading={false}
        canDelete={() => false}
        canEdit={() => false}
        canJournal={true}
      />,
    )

    await user.click(screen.getByText('Mid Term Test'))

    expect(mockNavigate).toHaveBeenCalledWith('/teacher/exams', { state: { prefill: pastEvent() } })
  })

  it('clicking a past event that is already journaled just expands the card (no navigation)', async () => {
    const user = userEvent.setup()
    render(
      <EventTimeline
        events={[pastEvent({ journaled: true })]}
        isLoading={false}
        canDelete={() => false}
        canEdit={() => false}
        canJournal={true}
      />,
    )

    await user.click(screen.getByText('Mid Term Test'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('clicking a past event when canJournal=false just expands the card (no navigation)', async () => {
    const user = userEvent.setup()
    render(
      <EventTimeline
        events={[pastEvent()]}
        isLoading={false}
        canDelete={() => false}
        canEdit={() => false}
        canJournal={false}
      />,
    )

    await user.click(screen.getByText('Mid Term Test'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('clicking a future event just expands the card (no navigation)', async () => {
    const user = userEvent.setup()
    render(
      <EventTimeline
        events={[pastEvent({ eventDate: '2099-01-01' })]}
        isLoading={false}
        canDelete={() => false}
        canEdit={() => false}
        canJournal={true}
      />,
    )

    await user.click(screen.getByText('Mid Term Test'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
