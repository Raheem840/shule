import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import userEvent from '@testing-library/user-event'
import { PillGroup } from '../../components/shared/PillGroup'

describe('PillGroup', () => {
  it('renders all option labels and calls onChange with the clicked value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PillGroup
        value="a"
        onChange={onChange}
        options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]}
      />,
    )

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()

    await user.click(screen.getByText('Beta'))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('does not call onChange for the already-active pill click (still fires — caller decides no-op)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PillGroup
        value="a"
        onChange={onChange}
        options={[{ value: 'a', label: 'Alpha' }]}
      />,
    )
    await user.click(screen.getByText('Alpha'))
    expect(onChange).toHaveBeenCalledWith('a')
  })
})
