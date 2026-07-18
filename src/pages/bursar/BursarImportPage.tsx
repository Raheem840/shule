import { useState, useCallback } from 'react'
import { ImportWizard } from '../../components/shared/ImportWizard'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { downloadFeeTemplate } from '../../lib/importTemplates'
import { localToday } from '../../lib/dates'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { ColumnSpec, ParsedRow, ImportResult, ConflictStrategy } from '../../components/shared/ImportWizard'

// ─── Types ─────────────────────────────────────────────────────────────────────

type MatchStatus = 'matched' | 'close' | 'unmatched'

interface StudentRec {
  id:               string
  first_name:       string
  last_name:        string
  admission_number: string | null
  class_id:         string | null
  stream_id:        string | null
}

interface ClassRec {
  id:   string
  name: string
}

interface StreamRec {
  id:      string
  name:    string
  classId: string
}

interface FeeStructureRec {
  id:      string
  name:    string
  classId: string | null
  term:    number
}

interface MatchedRow {
  rowIndex:      number
  rawRow:        ParsedRow
  matchStatus:   MatchStatus
  student:       StudentRec | null
  candidates:    StudentRec[]   // full class pool for close-match dropdown
  chosenId:      string | null  // null = not yet resolved
  skipped:       boolean
  dbClassName:   string         // DB-stored class name (e.g. "S.3 East") — used as bucket key
  feeStructureId: string | null // resolved from the row's fee_type column, if any
}

type ImportStage = 'wizard' | 'matching' | 'preview' | 'importing' | 'done'

// ─── Column specs ──────────────────────────────────────────────────────────────

const REQUIRED: ColumnSpec[] = [
  {
    key: 'student_name', label: 'Student Name', example: 'Amara Nakato',
    hint: 'Full name — first and last. Must match school register (case-insensitive).',
  },
  {
    key: 'class_name', label: 'Class Name', example: 'S.3',
    hint: 'Class name — e.g. S.1, S.2, Senior 3, Form 4. Used to narrow the search.',
  },
  {
    key: 'amount_paid', label: 'Amount Paid (UGX)', example: '250000',
    hint: 'How much the student has paid this term. Numbers only, no commas.',
    validate: v => isNaN(Number(v)) ? 'Must be a number' : null,
  },
  {
    key: 'amount_due', label: 'Amount Due (UGX)', example: '400000',
    hint: 'Total fees owed for the term. Balance = Due − Paid.',
    validate: v => isNaN(Number(v)) ? 'Must be a number' : null,
  },
  {
    key: 'term', label: 'Term (1, 2, or 3)', example: '1',
    hint: 'Which school term this record applies to.',
    validate: v => !['1', '2', '3'].includes(String(v).trim()) ? 'Must be 1, 2, or 3' : null,
  },
]

const OPTIONAL: ColumnSpec[] = [
  { key: 'admission_number', label: 'Admission Number', example: 'KJA/2026/001', hint: 'If provided, used directly — skips name matching.' },
  { key: 'stream_name',      label: 'Stream Name',      example: 'East',          hint: 'Further narrows to the correct stream.' },
  { key: 'fee_type',         label: 'Fee Type',         example: 'Tuition',       hint: 'Name of the fee item this payment is for (matches Fee Structure). Leave blank for a general/manual payment.' },
  { key: 'year',             label: 'Year',             example: '2026',          hint: 'Calendar year — leave blank to use the active academic year.' },
  { key: 'payment_date',     label: 'Payment Date',     example: '2026-02-01',    hint: 'Date of payment in YYYY-MM-DD format.' },
  { key: 'receipt_number',   label: 'Receipt Number',   example: 'REC-001',       hint: 'Reference number from payment receipt.' },
  { key: 'notes',            label: 'Notes',            example: 'Term 1 fees',   hint: 'Any additional notes about this payment.' },
]

// ─── Matching helpers ───────────────────────────────────────────────────────────

function normalizeClassName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    // Collapse verbose prefixes → single-letter equivalents so "Senior3" = "s3",
    // "Form4" = "s4", "Primary6" = "p6", "Grade8" = "g8"
    .replace(/^senior/, 's')
    .replace(/^form/, 's')
    .replace(/^primary/, 'p')
    .replace(/^grade/, 'g')
    .replace(/^year/, 'y')
    .replace(/^class/, 'c')
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Levenshtein distance — inline, no library
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ─── Currency formatter ─────────────────────────────────────────────────────────

function fmtUgx(n: number): string {
  return `UGX ${Number(n).toLocaleString('en-UG')}`
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function BursarImportPage() {
  const { user } = useAuth()
  const qc       = useQueryClient()

  const [stage,        setStage]        = useState<ImportStage>('wizard')
  const [matchedRows,  setMatchedRows]  = useState<MatchedRow[]>([])
  const [matching,     setMatching]     = useState(false)
  const [matchError,   setMatchError]   = useState<string | null>(null)
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [activeYearId, setActiveYearId] = useState<string | null>(null)
  // Conflict-resolution choice made on the wizard's own "Conflicts" step. The
  // wizard's onComplete only hands off rows for matching (the real DB write
  // happens later from the Preview stage's own Import button below), so the
  // chosen strategy must be carried in state to reach runImport().
  const [importStrategy, setImportStrategy] = useState<ConflictStrategy>('upsert')

  // ── After wizard parses rows → run matching ─────────────────────────────────
  const handleWizardComplete = useCallback(async (rows: ParsedRow[], strategy: ConflictStrategy): Promise<ImportResult> => {
    setImportStrategy(strategy)
    setStage('matching')
    setMatching(true)
    setMatchError(null)

    try {
      // 0. Fetch active academic year (required: fee_payments.academic_year_id NOT NULL)
      const { data: yearData, error: yearErr } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .maybeSingle()

      if (yearErr) throw new Error(yearErr.message)
      if (!yearData) throw new Error('No active academic year found. Please configure one before importing.')
      setActiveYearId((yearData as { id: string }).id)

      // 1. Fetch active students
      const { data: stuData, error: stuErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, class_id, stream_id')
        .eq('school_id', user!.schoolId)
        .eq('status', 'active')

      if (stuErr) throw new Error(stuErr.message)
      const students: StudentRec[] = (stuData ?? []) as StudentRec[]

      // 2. Fetch classes
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user!.schoolId)

      if (classErr) throw new Error(classErr.message)
      const classes: ClassRec[] = (classData ?? []) as ClassRec[]

      // 3. Fetch streams
      const { data: streamData, error: streamErr } = await supabase
        .from('streams')
        .select('id, name, class_id')
        .eq('school_id', user!.schoolId)

      if (streamErr) throw new Error(streamErr.message)
      const streams: StreamRec[] = ((streamData ?? []) as { id: string; name: string; class_id: string }[])
        .map(s => ({ id: s.id, name: s.name, classId: s.class_id }))

      // 3b. Fetch active fee structure items for this year — used to resolve the
      // optional fee_type column to a fee_structure_id, so imported payments
      // actually satisfy a defined fee item (rather than always landing as null,
      // which leaves the "students not yet billed" banner stuck non-zero even
      // after a bulk import covered them).
      const { data: fsData } = await supabase
        .from('fee_structure')
        .select('id, name, class_id, term')
        .eq('school_id', user!.schoolId)
        .eq('academic_year_id', (yearData as { id: string }).id)
        .eq('is_active', true)
      const feeStructures: FeeStructureRec[] = ((fsData ?? []) as { id: string; name: string; class_id: string | null; term: number }[])
        .map(f => ({ id: f.id, name: f.name, classId: f.class_id, term: f.term }))

      // Build lookups
      const classMap = new Map<string, ClassRec>()
      classes.forEach(c => classMap.set(normalizeClassName(c.name), c))

      const streamKey = (classId: string, name: string) => `${classId}::${normalizeName(name)}`
      const streamMap = new Map<string, StreamRec>()
      streams.forEach(s => streamMap.set(streamKey(s.classId, s.name), s))

      // Resolve a row's fee_type text → a specific fee_structure.id, scoped to
      // the row's matched class + term (or school-wide items with class_id=null).
      function resolveFeeStructureId(feeTypeRaw: string, classId: string | null, term: number): string | null {
        const name = normalizeName(feeTypeRaw)
        if (!name) return null
        const candidates = feeStructures.filter(f =>
          f.term === term && (f.classId === null || f.classId === classId)
        )
        const exact = candidates.find(f => normalizeName(f.name) === name)
        if (exact) return exact.id
        const partial = candidates.find(f => normalizeName(f.name).includes(name) || name.includes(normalizeName(f.name)))
        return partial ? partial.id : null
      }

      // 4. Match each row
      const matched: MatchedRow[] = rows.map((row, idx) => {
        const admNo      = String(row.admission_number ?? '').trim()
        const rowTerm    = Number(row.term ?? 1)
        const feeTypeRaw = String(row.fee_type ?? '').trim()

        // Path A: admission_number provided — direct lookup
        if (admNo) {
          const found      = students.find(s => String(s.admission_number ?? '').trim() === admNo)
          const foundClass = found ? classes.find(c => c.id === found.class_id) : null
          return {
            rowIndex:    idx,
            rawRow:      row,
            matchStatus: found ? 'matched' : 'unmatched',
            student:     found ?? null,
            candidates:  [],
            chosenId:    found ? found.id : null,
            skipped:     !found,
            dbClassName: foundClass?.name ?? String(row.class_name ?? 'Unknown').trim(),
            feeStructureId: found ? resolveFeeStructureId(feeTypeRaw, found.class_id, rowTerm) : null,
          }
        }

        // Path B: name + class matching
        const rawClassName = String(row.class_name ?? '').trim()
        const normClass    = normalizeClassName(rawClassName)

        // Fuzzy class lookup
        let matchedClass: ClassRec | undefined = classMap.get(normClass)
        if (!matchedClass) {
          for (const [key, cls] of classMap) {
            if (key.includes(normClass) || normClass.includes(key)) {
              matchedClass = cls
              break
            }
          }
        }

        const classStudents = matchedClass
          ? students.filter(s => s.class_id === matchedClass!.id)
          : []

        // Optionally narrow by stream
        const rawStreamName = String(row.stream_name ?? '').trim()
        let pool = classStudents
        if (rawStreamName && matchedClass) {
          const sk      = streamKey(matchedClass.id, rawStreamName)
          const stream  = streamMap.get(sk)
          if (stream) {
            const sub = classStudents.filter(s => s.stream_id === stream.id)
            if (sub.length > 0) pool = sub
          }
        }

        const rawStudentName = String(row.student_name ?? '').trim()
        const normInput      = normalizeName(rawStudentName)

        const dbClass  = matchedClass?.name ?? String(row.class_name ?? 'Unknown').trim()
        const rowFeeId = resolveFeeStructureId(feeTypeRaw, matchedClass?.id ?? null, rowTerm)

        // Exact full-name match
        const exact = pool.find(s => normalizeName(`${s.first_name} ${s.last_name}`) === normInput)
        if (exact) {
          return { rowIndex: idx, rawRow: row, matchStatus: 'matched', student: exact, candidates: [], chosenId: exact.id, skipped: false, dbClassName: dbClass, feeStructureId: rowFeeId }
        }

        // Levenshtein ≤ 2
        const close = pool.filter(s => levenshtein(normInput, normalizeName(`${s.first_name} ${s.last_name}`)) <= 2)
        if (close.length > 0) {
          return { rowIndex: idx, rawRow: row, matchStatus: 'close', student: close[0], candidates: pool, chosenId: null, skipped: false, dbClassName: dbClass, feeStructureId: rowFeeId }
        }

        return { rowIndex: idx, rawRow: row, matchStatus: 'unmatched', student: null, candidates: pool, chosenId: null, skipped: true, dbClassName: dbClass, feeStructureId: rowFeeId }
      })

      setMatchedRows(matched)
      setStage('preview')
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : 'Failed to match students')
      setStage('wizard')
    } finally {
      setMatching(false)
    }

    // Return placeholder — real result comes after preview confirmation
    return { imported: 0, updated: 0, skipped: 0, failed: [] }
  }, [user])

  // ── Run DB insert after preview ─────────────────────────────────────────────
  async function runImport() {
    if (!['bursar', 'principal'].includes(user?.role ?? '')) return
    setImporting(true)
    let imported = 0
    let updated  = 0
    const failed: Array<{ row: number; reason: string }> = []

    const toImport = matchedRows.filter(m => !m.skipped && m.chosenId !== null)

    // Look up existing fee_payments rows for every (student, term) pair in this
    // import, scoped to the active academic year — re-running an import (or
    // importing overlapping data) must UPDATE the existing record, not insert
    // a second row that would double-count in every KPI/ledger aggregate.
    const studentIds = Array.from(new Set(toImport.map(m => m.chosenId!)))
    type ExistingRow = { id: string; feeStructureId: string | null; amountDue: number; amountPaid: number }
    const existingByStudentTerm = new Map<string, ExistingRow[]>()
    if (studentIds.length > 0) {
      const { data: existingRows } = await supabase
        .from('fee_payments')
        .select('id, student_id, fee_structure_id, term, amount_due, amount_paid')
        .eq('school_id', user!.schoolId)
        .eq('academic_year_id', activeYearId!)
        .in('student_id', studentIds)
      for (const r of (existingRows ?? []) as { id: string; student_id: string; fee_structure_id: string | null; term: number; amount_due: number; amount_paid: number }[]) {
        const bucketKey = `${r.student_id}::${r.term}`
        const list = existingByStudentTerm.get(bucketKey) ?? []
        list.push({ id: r.id, feeStructureId: r.fee_structure_id, amountDue: Number(r.amount_due), amountPaid: Number(r.amount_paid) })
        existingByStudentTerm.set(bucketKey, list)
      }
    }

    // Find the existing row (if any) a re-imported row represents. Prefer an
    // exact fee_structure_id match (covers real fee-item charges, including
    // both sides null). If the import row resolved no fee_type (the column is
    // optional — omitting it is common), fall back to matching on the exact
    // amount_due/amount_paid pair, which is what "duplicate" means in practice
    // for a general/manual charge — this also correctly tells apart a true
    // duplicate from a second, genuinely different payment for the same
    // student/term (e.g. a top-up payment with a different amount).
    function findExisting(studentId: string, term: number, feeStructureId: string | null, amountDue: number, amountPaid: number): ExistingRow | undefined {
      const list = existingByStudentTerm.get(`${studentId}::${term}`) ?? []
      if (feeStructureId) {
        const exact = list.find(r => r.feeStructureId === feeStructureId)
        if (exact) return exact
        // Import resolved a real fee_type, but no row exists under that exact id —
        // fall back to a legacy row recorded before fee_type existed (fee_structure_id
        // null), so re-importing a corrected file updates it in place instead of
        // inserting a duplicate.
        return list.find(r => r.feeStructureId === null)
      }
      // No fee_type resolved on the import side — never treat "both null" alone as
      // a match (two general/manual charges for the same student/term are meant to
      // stay distinct rows, matching useAddPayment's own convention). Only match on
      // the exact amount_due/amount_paid pair, which is what "duplicate" means in
      // practice for a general charge.
      return list.find(r => r.feeStructureId === null && r.amountDue === amountDue && r.amountPaid === amountPaid)
    }

    let duplicatesSkipped = 0
    const toInsert: Array<Record<string, unknown>> = []
    for (const m of toImport) {
      const r          = m.rawRow
      const amountPaid = Number(r.amount_paid ?? 0)
      const amountDue  = Number(r.amount_due  ?? amountPaid)
      const termNum    = Number(r.term ?? 1)
      const existing   = findExisting(m.chosenId!, termNum, m.feeStructureId, amountDue, amountPaid)

      if (existing) {
        if (importStrategy === 'skip') {
          duplicatesSkipped++
          continue
        }
        const { error } = await supabase
          .from('fee_payments')
          .update({
            amount_due:       amountDue,
            amount_paid:      amountPaid,
            // balance is DB-generated (amount_due - amount_paid) — never set explicitly.
            fee_structure_id: m.feeStructureId,
            payment_date:   r.payment_date ? String(r.payment_date) : (amountPaid > 0 ? localToday() : null),
            receipt_number: r.receipt_number ? String(r.receipt_number) : null,
            notes:          r.notes ? String(r.notes) : null,
            imported:       true,
          })
          .eq('id', existing.id)
        if (error) failed.push({ row: m.rowIndex + 2, reason: error.message })
        else updated++
        continue
      }

      toInsert.push({
        school_id:        user!.schoolId,
        student_id:       m.chosenId!,
        fee_structure_id: m.feeStructureId,
        academic_year_id: activeYearId!,
        amount_paid:      amountPaid,
        amount_due:       amountDue,
        // balance is DB-generated (amount_due - amount_paid) — never set explicitly.
        payment_date:     r.payment_date ? String(r.payment_date) : (amountPaid > 0 ? localToday() : null),
        receipt_number:   r.receipt_number ? String(r.receipt_number) : null,
        notes:            r.notes ? String(r.notes) : null,
        term:             termNum,
        imported:         true,
        created_by:       user!.staffId ?? user!.id,
        __rowIndex:       m.rowIndex,
      })
    }

    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50).map(({ __rowIndex, ...rest }) => rest)
      const rowIndices = toInsert.slice(i, i + 50).map(r => r.__rowIndex as number)
      const { error } = await supabase.from('fee_payments').insert(batch)
      if (error) {
        rowIndices.forEach(idx => failed.push({ row: idx + 2, reason: error.message }))
      } else {
        imported += batch.length
      }
    }

    void qc.invalidateQueries({ queryKey: ['fee-payments', user?.schoolId] })
    void qc.invalidateQueries({ queryKey: ['bursar-student-fees'] })
    void qc.invalidateQueries({ queryKey: ['bursar-kpis', user?.schoolId] })
    void qc.invalidateQueries({ queryKey: ['uncharged-counts-v2'] })

    const skipped = matchedRows.filter(m => m.skipped).length + duplicatesSkipped
    setImportResult({ imported, updated, skipped, failed })
    setStage('done')
    setImporting(false)
  }

  // ── Preview row mutators ────────────────────────────────────────────────────
  function toggleSkip(rowIndex: number) {
    setMatchedRows(prev => prev.map(m => {
      if (m.rowIndex !== rowIndex) return m
      const nowSkipped = !m.skipped
      return {
        ...m,
        skipped:  nowSkipped,
        chosenId: nowSkipped ? null : (m.student?.id ?? null),
      }
    }))
  }

  function confirmCandidate(rowIndex: number, studentId: string) {
    setMatchedRows(prev => prev.map(m => {
      if (m.rowIndex !== rowIndex) return m
      return {
        ...m,
        chosenId:    studentId,
        skipped:     false,
        matchStatus: 'matched' as MatchStatus,
        student:     m.candidates.find(c => c.id === studentId) ?? m.student,
      }
    }))
  }

  function resetImport() {
    setStage('wizard')
    setMatchedRows([])
    setMatchError(null)
    setImportResult(null)
  }

  // ── Derived counts ──────────────────────────────────────────────────────────
  const matchedCount   = matchedRows.filter(m => m.matchStatus === 'matched').length
  const closeCount     = matchedRows.filter(m => m.matchStatus === 'close' && !m.skipped).length
  const unmatchedCount = matchedRows.filter(m => m.matchStatus === 'unmatched' && !m.skipped).length
  const pendingClose   = matchedRows.filter(m => m.matchStatus === 'close' && !m.skipped && m.chosenId === null).length
  const willImport     = matchedRows.filter(m => !m.skipped && m.chosenId !== null).length
  const canImport      = pendingClose === 0 && willImport > 0

  // Group rows by class name for preview
  // Group by DB class name so headers always show the school's canonical format (e.g. "S.3 East")
  const classBuckets = new Map<string, MatchedRow[]>()
  matchedRows.forEach(m => {
    const key = m.dbClassName || String(m.rawRow.class_name ?? 'Unknown Class').trim()
    const arr = classBuckets.get(key) ?? []
    arr.push(m)
    classBuckets.set(key, arr)
  })

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, #065f46 0%, #0d9488 100%)', padding: '26px 28px 22px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -.4 }}>Import Fee Payments</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, margin: '0 0 16px' }}>
            Upload a spreadsheet · student names + class names accepted · admission numbers optional
          </p>
          <button
            onClick={() => downloadFeeTemplate()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Template (.csv)
          </button>
        </div>
      </div>

      {/* ── Info cards (only on wizard stage) ────────────────────────────────── */}
      {stage === 'wizard' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { icon: 'M9 11l3 3L22 4',                                   label: 'Auto balance',  detail: 'Balance = Due − Paid. Computed on every row.' },
            { icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',    label: 'Name matching', detail: 'Matches by name + class. Admission number is optional.' },
            { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8', label: 'Class preview', detail: 'Review matches class-by-class before import runs.' },
            { icon: 'M12 5v14M5 12h14',                                 label: 'Batch safe',    detail: 'Import in batches of 50 — large files handled.' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2"><path d={k.icon}/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{k.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.5 }}>{k.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stage: wizard ────────────────────────────────────────────────────── */}
      {stage === 'wizard' && (
        <ImportWizard
          context="fees"
          requiredFields={REQUIRED}
          optionalFields={OPTIONAL}
          onComplete={handleWizardComplete}
        />
      )}

      {/* ── Stage: matching spinner ───────────────────────────────────────────── */}
      {stage === 'matching' && matching && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 24px', background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" style={{ animation: 'shule-spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 14 }}>Matching students…</div>
          <div style={{ color: 'var(--txt3)', fontSize: 12.5 }}>Looking up names and classes in the school register</div>
        </div>
      )}

      {/* ── Match error ───────────────────────────────────────────────────────── */}
      {matchError && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
          {matchError}
          <button onClick={resetImport} style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>
            Start over
          </button>
        </div>
      )}

      {/* ── Stage: preview ───────────────────────────────────────────────────── */}
      {stage === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge variant="green" dot>{matchedCount} matched</Badge>
            {closeCount > 0 && <Badge variant="amber" dot>{closeCount} needs confirmation</Badge>}
            {unmatchedCount > 0 && <Badge variant="red" dot>{unmatchedCount} unmatched</Badge>}
            <Badge variant="muted">{matchedRows.length} total rows</Badge>
            <Badge variant="blue">
              {importStrategy === 'skip' ? 'Duplicates will be skipped' : 'Duplicates will be updated'}
            </Badge>
          </div>

          {pendingClose > 0 && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 12.5, color: 'var(--warning)', fontWeight: 600 }}>
              {pendingClose} row{pendingClose !== 1 ? 's' : ''} need confirmation before you can import.
              Use the Confirm dropdown on each flagged row.
            </div>
          )}

          {/* Class buckets */}
          {Array.from(classBuckets.entries()).map(([className, rows]) => (
            <ClassPreviewBucket
              key={className}
              className={className}
              rows={rows}
              onToggleSkip={toggleSkip}
              onConfirm={confirmCandidate}
            />
          ))}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <Button variant="secondary" onClick={resetImport}>← Back</Button>
            <Button
              variant="primary"
              loading={importing}
              disabled={!canImport}
              onClick={() => void runImport()}
            >
              Import {willImport} Record{willImport !== 1 ? 's' : ''} →
            </Button>
          </div>
        </div>
      )}

      {/* ── Stage: done ──────────────────────────────────────────────────────── */}
      {stage === 'done' && importResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 24px', alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font2)', fontSize: 20, fontWeight: 800, color: 'var(--txt)' }}>Import Complete</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>Fee payment import finished</div>
          </div>

          <div className="mob-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, width: '100%', maxWidth: 520 }}>
            {[
              { label: 'Imported', value: importResult.imported,       variant: 'green' as const },
              { label: 'Updated',  value: importResult.updated,        variant: 'blue'  as const },
              { label: 'Skipped',  value: importResult.skipped,        variant: 'amber' as const },
              { label: 'Failed',   value: importResult.failed.length,  variant: 'red'   as const },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font2)', fontSize: 26, fontWeight: 900, color: 'var(--txt)' }}>{stat.value}</div>
                <Badge variant={stat.variant} style={{ marginTop: 4 }}>{stat.label}</Badge>
              </div>
            ))}
          </div>

          {importResult.failed.length > 0 && (
            <div style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--danger)', marginBottom: 6 }}>Failed rows</div>
              {importResult.failed.map((f, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginTop: 3 }}>Row {f.row}: {f.reason}</div>
              ))}
            </div>
          )}

          <Button variant="primary" onClick={resetImport}>Import More</Button>
        </div>
      )}
    </div>
  )
}

// ─── ClassPreviewBucket ────────────────────────────────────────────────────────

interface ClassPreviewBucketProps {
  className:    string
  rows:         MatchedRow[]
  onToggleSkip: (rowIndex: number) => void
  onConfirm:    (rowIndex: number, studentId: string) => void
}

function ClassPreviewBucket({ className, rows, onToggleSkip, onConfirm }: ClassPreviewBucketProps) {
  const [open, setOpen] = useState(true)
  const activeCount     = rows.filter(r => !r.skipped).length

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'var(--surface2)', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)',
        }}
      >
        <span>{className} — {rows.length} row{rows.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant="muted">{activeCount} active</Badge>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div>
          {rows.map(m => (
            <PreviewRow key={m.rowIndex} m={m} onToggleSkip={onToggleSkip} onConfirm={onConfirm} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PreviewRow ────────────────────────────────────────────────────────────────

interface PreviewRowProps {
  m:            MatchedRow
  onToggleSkip: (rowIndex: number) => void
  onConfirm:    (rowIndex: number, studentId: string) => void
}

function PreviewRow({ m, onToggleSkip, onConfirm }: PreviewRowProps) {
  const rawName = String(m.rawRow.student_name ?? '').trim()
  const paid    = Number(m.rawRow.amount_paid ?? 0)
  const due     = Number(m.rawRow.amount_due  ?? 0)
  const term    = String(m.rawRow.term ?? '')

  let statusIcon: React.ReactNode
  let rowBg = 'transparent'

  if (m.skipped) {
    statusIcon = <span style={{ color: 'var(--txt3)', fontSize: 15 }}>—</span>
    rowBg      = 'rgba(148,163,184,0.05)'
  } else if (m.matchStatus === 'matched') {
    statusIcon = (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    )
  } else if (m.matchStatus === 'close') {
    rowBg      = 'rgba(245,158,11,0.04)'
    statusIcon = (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )
  } else {
    rowBg      = 'rgba(244,63,94,0.04)'
    statusIcon = (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    )
  }

  return (
    <div style={{
      display:        'grid',
      gridTemplateColumns: '24px 1fr auto auto',
      gap:            '0 12px',
      alignItems:     'center',
      padding:        '9px 14px',
      background:     rowBg,
      borderBottom:   '1px solid var(--border)',
      opacity:        m.skipped ? 0.5 : 1,
    }}>
      {/* Status icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {statusIcon}
      </div>

      {/* Name + match info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ textDecoration: m.skipped ? 'line-through' : 'none' }}>{rawName}</span>
          {!m.skipped && m.matchStatus === 'matched' && m.student && (
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 400 }}>
              → {m.student.first_name} {m.student.last_name}
            </span>
          )}
          {!m.skipped && m.matchStatus === 'close' && (
            <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
              → {m.student?.first_name} {m.student?.last_name}? (close match)
            </span>
          )}
          {!m.skipped && m.matchStatus === 'unmatched' && (
            <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>NOT FOUND</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>
          Term {term} · {fmtUgx(paid)} paid / {fmtUgx(due)} due
        </div>
      </div>

      {/* Confirm dropdown for close matches */}
      <div>
        {!m.skipped && m.matchStatus === 'close' && m.candidates.length > 0 && (
          <select
            value={m.chosenId ?? ''}
            onChange={e => { if (e.target.value) onConfirm(m.rowIndex, e.target.value) }}
            style={{
              padding: '8px 10px', minHeight: 36, fontSize: 12, borderRadius: 8,
              border: '1.5px solid var(--warning)', background: 'var(--surface)',
              color: 'var(--txt)', cursor: 'pointer', maxWidth: 200,
            }}
          >
            <option value="">Confirm ▾</option>
            {m.candidates.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Skip / restore toggle */}
      <button
        onClick={() => onToggleSkip(m.rowIndex)}
        style={{
          fontSize: 11.5, fontWeight: 700, padding: '8px 12px', minHeight: 36, borderRadius: 7,
          border: '1px solid var(--border)', background: 'var(--surface2)',
          color: m.skipped ? 'var(--brand)' : 'var(--txt3)', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {m.skipped ? 'Restore' : 'Skip row'}
      </button>
    </div>
  )
}
