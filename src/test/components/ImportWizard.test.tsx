import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { ImportWizard, type ColumnSpec, type ImportResult } from '../../components/shared/ImportWizard'

const REQUIRED_FIELDS: ColumnSpec[] = [
  { key: 'admission_number', label: 'Admission No.', required: true },
  {
    key: 'score', label: 'Score', required: true,
    validate: (v: string) => {
      const n = Number(v)
      if (isNaN(n) || n < 0) return 'Score must be a positive number'
      if (n > 100) return 'Score must not exceed 100'
      return null
    },
  },
]

function makeCsvFile(contents: string) {
  return new File([contents], 'marks.csv', { type: 'text/csv' })
}

async function uploadAndReachPreview(container: HTMLElement, csv: string) {
  const file = makeCsvFile(csv)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  await fireEvent.change(input, { target: { files: [file] } })
  // Step 2 — column mapping (auto-detected via ALIASES, just continue)
  await waitFor(() => expect(screen.getByText('Preview Data →')).toBeEnabled())
  fireEvent.click(screen.getByText('Preview Data →'))
  // Wait for the Preview step's table to actually render (not just the
  // "valid" summary badge text, which also collides with each row's own
  // per-row status badge showing the literal word "valid").
  await waitFor(() => expect(container.querySelector('table')).toBeTruthy())
}

describe('ImportWizard — editable preview', () => {
  it('renders read-only preview cells when editableFields is not passed', async () => {
    const onComplete = vi.fn<() => Promise<ImportResult>>()
    const { container } = render(
      <ImportWizard context="marks" requiredFields={REQUIRED_FIELDS} optionalFields={[]} onComplete={onComplete} />,
    )
    await uploadAndReachPreview(container, 'Admission No.,Score\nKJA/2025/001,85\n')

    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('table input')).toBeNull()
  })

  it('renders an editable input for fields listed in editableFields', async () => {
    const onComplete = vi.fn<() => Promise<ImportResult>>()
    const { container } = render(
      <ImportWizard
        context="marks"
        requiredFields={REQUIRED_FIELDS}
        optionalFields={[]}
        editableFields={['score']}
        onComplete={onComplete}
      />,
    )
    await uploadAndReachPreview(container, 'Admission No.,Score\nKJA/2025/001,85\n')

    const scoreInput = container.querySelector('table input') as HTMLInputElement
    expect(scoreInput).toBeTruthy()
    expect(scoreInput.value).toBe('85')
  })

  it('editing a cell to a valid value clears the row error and unblocks Continue', async () => {
    const onComplete = vi.fn<() => Promise<ImportResult>>()
    const { container } = render(
      <ImportWizard
        context="marks"
        requiredFields={REQUIRED_FIELDS}
        optionalFields={[]}
        editableFields={['score']}
        onComplete={onComplete}
      />,
    )
    // 150 exceeds the 100 max — starts as an error row
    await uploadAndReachPreview(container, 'Admission No.,Score\nKJA/2025/001,150\n')

    expect(screen.getByText('1 with errors')).toBeInTheDocument()
    const continueBtn = screen.getByText(/Continue →/)
    expect(continueBtn).toBeDisabled()

    const scoreInput = container.querySelector('table input') as HTMLInputElement
    fireEvent.change(scoreInput, { target: { value: '72' } })

    await waitFor(() => expect(screen.queryByText(/with errors/)).not.toBeInTheDocument())
    expect(screen.getByText(/Continue →/)).toBeEnabled()
  })

  it('editing a cell to an invalid value marks the row as errored', async () => {
    const onComplete = vi.fn<() => Promise<ImportResult>>()
    const { container } = render(
      <ImportWizard
        context="marks"
        requiredFields={REQUIRED_FIELDS}
        optionalFields={[]}
        editableFields={['score']}
        onComplete={onComplete}
      />,
    )
    await uploadAndReachPreview(container, 'Admission No.,Score\nKJA/2025/001,85\n')
    expect(screen.getByText('1 valid')).toBeInTheDocument()

    const scoreInput = container.querySelector('table input') as HTMLInputElement
    fireEvent.change(scoreInput, { target: { value: '999' } })

    await waitFor(() => expect(screen.getByText('1 with errors')).toBeInTheDocument())
  })
})

describe('ImportWizard — column auto-mapping', () => {
  const FEE_REQUIRED: ColumnSpec[] = [
    { key: 'student_name', label: 'Student Name', required: true },
    { key: 'class_name',   label: 'Class Name',   required: true },
    { key: 'amount_paid',  label: 'Amount Paid (UGX)', required: true },
    { key: 'amount_due',   label: 'Amount Due (UGX)',  required: true },
    { key: 'term',         label: 'Term',         required: true },
  ]

  it('auto-maps "Student Name" to the student_name field instead of leaving it unmapped, and "Amount Paid" to amount_paid instead of colliding with amount_due', async () => {
    const onComplete = vi.fn<() => Promise<ImportResult>>()
    const { container } = render(
      <ImportWizard context="fees" requiredFields={FEE_REQUIRED} optionalFields={[]} onComplete={onComplete} />,
    )
    const file = makeCsvFile('Student Name,Class Name,Amount Paid,Amount Due,Term\nGrace Apio,S.1,100000,400000,1\n')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/rows detected/)).toBeInTheDocument())

    const selects = container.querySelectorAll('select')
    const values = Array.from(selects).map(s => (s as HTMLSelectElement).value)
    expect(values).toEqual(['student_name', 'class_name', 'amount_paid', 'amount_due', 'term'])

    // All required fields resolved → Preview button is enabled without any manual fix-up.
    expect(screen.getByText('Preview Data →')).toBeEnabled()
  })
})
