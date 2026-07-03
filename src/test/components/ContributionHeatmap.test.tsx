import { describe, it, expect } from 'vitest'
import { render, screen } from '../utils'
import { ContributionHeatmap } from '../../components/shared/ContributionHeatmap'

describe('ContributionHeatmap', () => {
  it('shows the empty message when there are no rows', () => {
    render(<ContributionHeatmap columnLabels={['Jan', 'Feb']} rows={[]} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders one row per input row and one column header per label', () => {
    render(
      <ContributionHeatmap
        columnLabels={['Jan', 'Feb', 'Mar']}
        rows={[
          { id: 'c1', label: 'S1', cells: [{ label: 'Jan', count: 3 }, { label: 'Feb', count: 0 }, { label: 'Mar', count: 1 }] },
          { id: 'c2', label: 'S2', cells: [{ label: 'Jan', count: 0 }, { label: 'Feb', count: 0 }, { label: 'Mar', count: 0 }] },
        ]}
      />
    )
    expect(screen.getByText('S1')).toBeInTheDocument()
    expect(screen.getByText('S2')).toBeInTheDocument()
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Mar')).toBeInTheDocument()
    // Non-zero counts render as visible text; zero counts render as an empty cell.
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
