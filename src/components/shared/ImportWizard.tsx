import { useState, useRef, useCallback } from 'react'
import ExcelJS from 'exceljs'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { RowWarning } from '../../lib/validators'

// ── Public types ──────────────────────────────────────────────
export type ImportContext = 'students' | 'staff' | 'fees' | 'marks'
export type ParsedRow    = Record<string, string>
export type ImportResult = {
  imported: number
  updated:  number
  skipped:  number
  failed:   Array<{ row: number; reason: string }>
}
export type ConflictStrategy = 'upsert' | 'skip'

export type ColumnSpec = {
  key:       string
  label:     string
  required?: boolean
  example?:  string
  hint?:     string
  validate?: (value: string) => string | null
}

interface ImportWizardProps {
  context:        ImportContext
  requiredFields: ColumnSpec[]
  optionalFields: ColumnSpec[]
  onComplete:     (rows: ParsedRow[], strategy: ConflictStrategy) => Promise<ImportResult>
  onClose?:       () => void
  /** Optional per-row validator — if provided, preview shows error/warning indicators */
  validateRow?:   (row: Record<string, unknown>) => RowWarning[]
  /** Field keys the user can correct inline on the Preview step before importing
   *  (e.g. a mis-scanned score) — edited cells are re-validated immediately. */
  editableFields?: string[]
}

// ── Internal types ────────────────────────────────────────────
type ParsedFile = {
  headers:  string[]
  preview:  string[][]
  allRows:  string[][]
}

type RowStatus   = 'valid' | 'warning' | 'error'
type ValidatedRow = {
  data:     Record<string, string>
  original: string[]
  status:   RowStatus
  errors:   string[]
}

// ── CSV parser ────────────────────────────────────────────────
function parseCsv(text: string): ParsedFile {
  const lines = text.split(/\r?\n/)
  const rows: string[][] = []
  for (const line of lines) {
    if (!line.trim()) continue
    const result: string[] = []
    let current  = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; continue }
      if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
      current += line[i]
    }
    result.push(current.trim())
    rows.push(result)
  }
  return { headers: rows[0] ?? [], preview: rows.slice(1, 6), allRows: rows.slice(1) }
}

// ── Excel parser ──────────────────────────────────────────────
async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer   = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('No worksheets found in this file')

  const rows: string[][] = []
  sheet.eachRow(row => {
    const vals = (row.values as ExcelJS.CellValue[]).slice(1)
    rows.push(vals.map(v => {
      if (v === null || v === undefined) return ''
      if (typeof v === 'object' && 'text' in v) return String((v as { text: unknown }).text ?? '')
      if (typeof v === 'object' && v instanceof Date) return v.toISOString().slice(0, 10)
      return String(v)
    }))
  })

  return { headers: rows[0] ?? [], preview: rows.slice(1, 6), allRows: rows.slice(1) }
}

// ── Fuzzy header auto-detect ─────────────────────────────────
const ALIASES: Record<string, string[]> = {
  first_name:       ['first name','firstname','fname','given name'],
  last_name:        ['last name','lastname','lname','surname','family name'],
  full_name:        ['full name','fullname','name','staff name'],
  admission_number: ['adm no','admission no','admission number','reg no','student id','adm number'],
  dob:              ['dob','date of birth','birth date','birthdate'],
  gender:           ['gender','sex'],
  nationality:      ['nationality','country'],
  religion:         ['religion','faith'],
  class:            ['class','form','year group'],
  stream:           ['stream','section','division'],
  student_type:     ['student type','type','day/boarder','boarder status'],
  previous_school:  ['previous school','former school','old school'],
  enrolled_at:      ['enrollment date','enrolment date','date enrolled','admission date'],
  amount_due:       ['amount due','total due','fee','amount'],
  amount_paid:      ['amount paid','paid','payment'],
  payment_date:     ['payment date','date paid','date of payment'],
  receipt_number:   ['receipt no','receipt number','receipt'],
  term:             ['term'],
  email:                ['email','email address','e-mail'],
  phone:                ['phone','phone number','mobile','contact'],
  department_name:      ['department','dept','department name'],
  subject1:             ['subject1','subject 1','first subject'],
  subject2:             ['subject2','subject 2','second subject'],
  subject:              ['subject','subjects'],
  score:                ['score','mark','marks','result'],
  parent_name:          ['parent name','parent_name','guardian name','guardian','parent/guardian'],
  parent_phone:         ['parent phone','parent_phone','guardian phone','parent contact'],
  parent_email:         ['parent email','parent_email','guardian email'],
  parent_relationship:  ['parent relationship','parent_relationship','relationship','guardian relationship'],
  date_of_birth:        ['date_of_birth','date of birth (staff)','dob (staff)'],
  address:              ['address','home address','residential address'],
}

function autoDetect(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const used = new Set<string>()
  headers.forEach(h => {
    const norm = h.toLowerCase().trim()
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (used.has(field)) continue
      if (aliases.some(a => norm === a || norm.includes(a) || a.includes(norm))) {
        mapping[h] = field
        used.add(field)
        break
      }
    }
  })
  return mapping
}

// ── Row validation ────────────────────────────────────────────
function validateFields(data: Record<string, string>, fields: ColumnSpec[]): string[] {
  const errors: string[] = []
  fields.forEach(f => {
    const val = (data[f.key] ?? '').trim()
    if (f.required && !val) {
      errors.push(`${f.label} is required`)
    } else if (val && f.validate) {
      const msg = f.validate(val)
      if (msg) errors.push(msg)
    }
  })
  return errors
}

function validateRows(
  allRows:  string[][],
  headers:  string[],
  mapping:  Record<string, string>,
  fields:   ColumnSpec[],
): ValidatedRow[] {
  return allRows.map(row => {
    const data: Record<string, string> = {}
    headers.forEach((h, i) => {
      const field = mapping[h]
      if (field && field !== '__skip__') data[field] = row[i] ?? ''
    })

    const errors = validateFields(data, fields)

    return {
      data,
      original: row,
      status:   errors.length > 0 ? 'error' : 'valid',
      errors,
    }
  })
}

// ── Step indicator ────────────────────────────────────────────
const STEPS = ['Upload', 'Map Columns', 'Preview', 'Conflicts', 'Results']

function WizardSteps({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      {STEPS.map((label, i) => {
        const num    = i + 1
        const done   = num < current
        const active = num === current
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div
                className={done ? 'sui-wstep-done' : active ? 'sui-wstep-active' : 'sui-wstep-pending'}
                style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', flexShrink: 0 }}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : num}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: active ? 'var(--brand)' : done ? 'var(--txt2)' : 'var(--txt3)', fontFamily: 'var(--font2)', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={done ? 'sui-wline-done' : 'sui-wline-pending'}
                style={{ flex: 1, height: 2, margin: '0 0.4rem', marginBottom: 18 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function ImportWizard({ context, requiredFields, optionalFields, onComplete, onClose, validateRow, editableFields }: ImportWizardProps) {
  const allFields = [...requiredFields, ...optionalFields]

  const [step,       setStep]       = useState(1)
  const [dragOver,   setDragOver]   = useState(false)
  const [fileError,  setFileError]  = useState<string | null>(null)
  const [parsing,    setParsing]    = useState(false)
  const [parsed,     setParsed]     = useState<ParsedFile | null>(null)
  const [mapping,    setMapping]    = useState<Record<string, string>>({})
  const [validated,  setValidated]  = useState<ValidatedRow[]>([])
  const [strategy,   setStrategy]   = useState<ConflictStrategy>('upsert')
  const [importing,  setImporting]  = useState(false)
  const [result,     setResult]     = useState<ImportResult | null>(null)
  const [importErr,  setImportErr]  = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File handling ──────────────────────────────────────────
  const ACCEPT = ['.xlsx', '.xls', '.csv', '.ods']

  async function handleFile(file: File) {
    setFileError(null)
    setParsing(true)
    try {
      let data: ParsedFile
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        data = parseCsv(text)
      } else if (file.name.match(/\.(xlsx|xls)$/)) {
        data = await parseExcel(file)
      } else {
        throw new Error('Unsupported format. Please use .xlsx, .xls, or .csv')
      }
      if (data.headers.length === 0) throw new Error('No headers found. Check that your file has a header row.')
      if (data.allRows.length === 0) throw new Error('The file has no data rows.')
      setParsed(data)
      setMapping(autoDetect(data.headers))
      setStep(2)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Failed to read file')
    } finally {
      setParsing(false)
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { e.target.value = ''; handleFile(file) }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  // ── Step 3 — validate ──────────────────────────────────────
  function buildValidated() {
    if (!parsed) return
    const rows = validateRows(parsed.allRows, parsed.headers, mapping, allFields)
    setValidated(rows)
    setStep(3)
  }

  // ── Step 3 — inline cell edit + re-validate ────────────────
  function editCell(rowIndex: number, key: string, value: string) {
    setValidated(rows => rows.map((r, i) => {
      if (i !== rowIndex) return r
      const data   = { ...r.data, [key]: value }
      const errors = validateFields(data, allFields)
      return { ...r, data, errors, status: errors.length > 0 ? 'error' : 'valid' }
    }))
  }

  // ── Step 5 — import ────────────────────────────────────────
  async function runImport() {
    setImporting(true)
    setImportErr(null)
    try {
      const validRows = validated.filter(r => r.status !== 'error').map(r => r.data)
      const res = await onComplete(validRows, strategy)
      setResult(res)
      setStep(5)
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Derived counts ─────────────────────────────────────────
  const validCount   = validated.filter(r => r.status === 'valid').length
  const errorCount   = validated.filter(r => r.status === 'error').length
  const requiredMapped = requiredFields.every(f => Object.values(mapping).includes(f.key))

  // ── Per-row warnings from external validateRow prop ──────────
  const rowWarnings: RowWarning[][] = validateRow
    ? validated.map(row => validateRow(row.data as Record<string, unknown>))
    : validated.map(() => [])
  const extErrorCount   = rowWarnings.filter(w => w.some(x => x.severity === 'error')).length
  const extWarningCount = rowWarnings.filter(w => w.some(x => x.severity === 'warning') && !w.some(x => x.severity === 'error')).length

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <WizardSteps current={step} />

      {/* ── STEP 1 — UPLOAD ─────────────────────────────── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input ref={fileInputRef} type="file" accept={ACCEPT.join(',')} style={{ display: 'none' }} onChange={onFileInput} />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragOver ? 'var(--brand)' : 'var(--border)'}`,
              borderRadius: 'var(--r-lg)',
              padding: '3rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              background: dragOver ? 'var(--brand-light)' : 'var(--surface2)',
              transition: 'all 0.15s',
              textAlign: 'center',
            }}
          >
            {parsing ? (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" style={{ animation: 'shule-spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>Parsing file…</span>
              </>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>Drop your file here or click to browse</div>
                  <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>Supports .xlsx · .xls · .csv</div>
                </div>
              </>
            )}
          </div>

          {fileError && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>
              {fileError}
            </div>
          )}

          {/* Template hint */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--info-bg)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 'var(--r)', fontSize: 12 }}>
            <span style={{ fontWeight: 800, color: 'var(--info)' }}>Required columns: </span>
            <span style={{ color: 'var(--txt2)' }}>
              {requiredFields.map(f => f.label).join(', ')}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── STEP 2 — COLUMN MAPPING ─────────────────────── */}
      {step === 2 && parsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
            <strong style={{ color: 'var(--txt)' }}>{parsed.allRows.length}</strong> rows detected.
            Map each file column to a Shule field.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
            {parsed.headers.map(header => (
              <div key={header} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--surface2)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font3)' }}>
                  {header}
                </span>
                <select
                  value={mapping[header] ?? ''}
                  onChange={e => setMapping(m => ({ ...m, [header]: e.target.value }))}
                  style={{ padding: '0.35rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--txt)', fontFamily: 'var(--font1)', width: '100%' }}
                >
                  <option value="">Skip column</option>
                  <optgroup label="Required">
                    {requiredFields.map(f => (
                      <option key={f.key} value={f.key}>{f.label} ★</option>
                    ))}
                  </optgroup>
                  <optgroup label="Optional">
                    {optionalFields.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ))}
          </div>

          {/* Required fields checklist */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', letterSpacing: '0.5px', marginBottom: 8, fontFamily: 'var(--font2)' }}>
              REQUIRED FIELDS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {requiredFields.map(f => {
                const mapped = Object.values(mapping).includes(f.key)
                return (
                  <Badge key={f.key} variant={mapped ? 'green' : 'red'} dot>
                    {f.label}
                  </Badge>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" onClick={() => { setParsed(null); setStep(1) }}>← Back</Button>
            <Button variant="primary" onClick={buildValidated} disabled={!requiredMapped}>
              Preview Data →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3 — PREVIEW & VALIDATE ─────────────────── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Summary badges */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge variant="green" dot>{validCount} valid</Badge>
            {errorCount > 0 && <Badge variant="red" dot>{errorCount} with errors</Badge>}
            <Badge variant="muted">{validated.length} total rows</Badge>
          </div>

          {editableFields && editableFields.length > 0 && (
            <div style={{ padding: '0.6rem 0.85rem', background: 'var(--info-bg)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 'var(--r)', fontSize: 12.5, color: '#0369a1' }}>
              Spotted a mistake? Click any highlighted cell below to correct it before importing — errors clear as soon as the value is valid.
            </div>
          )}

          {/* External validator summary banner */}
          {validateRow && (extErrorCount > 0 || extWarningCount > 0) && (
            <div style={{
              padding: '0.6rem 0.85rem',
              background: extErrorCount > 0 ? 'rgba(244,63,94,0.06)' : 'rgba(245,158,11,0.06)',
              border: `1px solid ${extErrorCount > 0 ? 'rgba(244,63,94,0.25)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: 'var(--r)', fontSize: 12.5, fontWeight: 600,
              color: extErrorCount > 0 ? 'var(--danger)' : 'var(--warning)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {extErrorCount > 0 && <span>{extErrorCount} row{extErrorCount > 1 ? 's' : ''} have errors</span>}
              {extErrorCount > 0 && extWarningCount > 0 && <span style={{ color: 'var(--txt3)' }}>·</span>}
              {extWarningCount > 0 && <span style={{ color: 'var(--warning)' }}>{extWarningCount} row{extWarningCount > 1 ? 's' : ''} have warnings</span>}
            </div>
          )}

          {/* Preview table */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 340, border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={{ ...thStyle, width: 80 }}>Status</th>
                  {allFields.filter(f => Object.values(mapping).includes(f.key)).map(f => (
                    <th key={f.key} style={thStyle}>{f.label}</th>
                  ))}
                  {validateRow && <th style={{ ...thStyle, width: 72 }}>Issues</th>}
                </tr>
              </thead>
              <tbody>
                {validated.map((row, i) => {
                  const extWarns   = rowWarnings[i] ?? []
                  const hasExtErr  = extWarns.some(w => w.severity === 'error')
                  const hasExtWarn = extWarns.some(w => w.severity === 'warning')
                  const leftBorder = row.status === 'error' || hasExtErr
                    ? '3px solid var(--danger)'
                    : hasExtWarn ? '3px solid var(--warning)' : '3px solid transparent'
                  const rowBg = row.status === 'error' || hasExtErr
                    ? 'rgba(244,63,94,0.05)'
                    : hasExtWarn ? 'rgba(245,158,11,0.05)' : 'transparent'
                  return (
                    <tr key={i} style={{ background: rowBg, borderLeft: leftBorder }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>
                        <Badge variant={row.status === 'error' ? 'red' : row.status === 'warning' ? 'amber' : 'green'} dot>
                          {row.status}
                        </Badge>
                      </td>
                      {allFields.filter(f => Object.values(mapping).includes(f.key)).map(f => {
                        const isErrored = row.errors.some(e => e.includes(f.label))
                        if (editableFields?.includes(f.key)) {
                          return (
                            <td key={f.key} style={tdStyle}>
                              <input
                                value={row.data[f.key] ?? ''}
                                onChange={e => editCell(i, f.key, e.target.value)}
                                style={{
                                  width: 90, padding: '4px 7px',
                                  border: `1px solid ${isErrored ? 'var(--danger)' : 'var(--border)'}`,
                                  borderRadius: 6, fontSize: 12, fontFamily: 'var(--font3)',
                                  background: 'var(--surface)', color: 'var(--txt)',
                                }}
                              />
                            </td>
                          )
                        }
                        return (
                          <td key={f.key} style={{ ...tdStyle, color: isErrored ? 'var(--danger)' : 'var(--txt2)' }}>
                            {row.data[f.key] || <span style={{ color: 'var(--txt3)' }}>—</span>}
                          </td>
                        )
                      })}
                      {validateRow && (
                        <td style={tdStyle}>
                          {hasExtErr && <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 11 }}>● {extWarns.filter(w => w.severity === 'error').length} err</span>}
                          {!hasExtErr && hasExtWarn && <span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: 11 }}>● {extWarns.length} warn</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Error summary */}
          {errorCount > 0 && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--r)', fontSize: 12 }}>
              <div style={{ fontWeight: 800, color: 'var(--danger)', marginBottom: 4 }}>
                {errorCount} row{errorCount > 1 ? 's' : ''} will be skipped
              </div>
              {validated.filter(r => r.status === 'error').slice(0, 5).map((r, i) => (
                <div key={i} style={{ color: 'var(--danger-txt)', marginTop: 2 }}>
                  Row {validated.indexOf(r) + 1}: {r.errors.join(' · ')}
                </div>
              ))}
              {errorCount > 5 && <div style={{ color: 'var(--txt3)', marginTop: 2 }}>…and {errorCount - 5} more</div>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
            <Button variant="primary" onClick={() => setStep(4)} disabled={validCount === 0}>
              Continue → ({validCount} rows)
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4 — CONFLICT RESOLUTION ────────────────── */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
            If any of the <strong style={{ color: 'var(--txt)' }}>{validCount} records</strong> already exist in the system,
            how should Shule handle them?
          </p>

          {(['upsert', 'skip'] as const).map(opt => {
            const isSelected = strategy === opt
            return (
              <label key={opt} style={{ display: 'flex', gap: '0.85rem', padding: '1rem', border: `2px solid ${isSelected ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', background: isSelected ? 'var(--brand-light)' : 'var(--surface2)', cursor: 'pointer', transition: 'all 0.15s' }}>
                <input type="radio" name="strategy" value={opt} checked={isSelected} onChange={() => setStrategy(opt)} style={{ accentColor: 'var(--brand)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? 'var(--brand)' : 'var(--txt)', marginBottom: 4 }}>
                    {opt === 'upsert' ? 'Update existing records' : 'Skip duplicates'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                    {opt === 'upsert'
                      ? 'Matching records will be updated with new values. New records will be created.'
                      : 'Records that already exist will be left unchanged. Only new records will be added.'}
                  </div>
                </div>
              </label>
            )
          })}

          {importErr && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>
              {importErr}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" onClick={() => setStep(3)}>← Back</Button>
            <Button variant="primary" loading={importing} onClick={runImport}>
              Import {validCount} Records
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 5 — RESULTS ────────────────────────────── */}
      {step === 5 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font2)', fontSize: 18, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.3px' }}>
              Import Complete
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
              {context.charAt(0).toUpperCase() + context.slice(1)} import finished
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Imported', value: result.imported, variant: 'green' as const },
              { label: 'Updated',  value: result.updated,  variant: 'blue' as const },
              { label: 'Skipped',  value: result.skipped,  variant: 'amber' as const },
              { label: 'Failed',   value: result.failed.length, variant: 'red' as const },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font2)', fontSize: 24, fontWeight: 900, color: 'var(--txt)' }}>{stat.value}</div>
                <Badge variant={stat.variant} style={{ marginTop: 4 }}>{stat.label}</Badge>
              </div>
            ))}
          </div>

          {result.failed.length > 0 && (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--danger)', marginBottom: 6 }}>
                Failed rows
              </div>
              {result.failed.map((f, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--danger-txt)', marginTop: 3 }}>
                  Row {f.row}: {f.reason}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared table styles ───────────────────────────────────────
const thStyle: React.CSSProperties = {
  textAlign:      'left',
  fontSize:       10,
  fontWeight:     900,
  letterSpacing:  '0.8px',
  textTransform:  'uppercase',
  color:          'var(--txt3)',
  padding:        '0.5rem 0.75rem',
  borderBottom:   '1px solid var(--border)',
  background:     'var(--surface2)',
  fontFamily:     'var(--font2)',
  whiteSpace:     'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding:      '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  color:        'var(--txt2)',
  fontSize:     12,
  verticalAlign:'middle',
}
