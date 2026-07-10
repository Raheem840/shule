/**
 * Import template generator — produces downloadable CSV/XLSX with correct
 * column headers and realistic example rows for each import type.
 */

import ExcelJS from 'exceljs'

type TemplateType = 'students' | 'staff'

export function generateImportTemplate(type: TemplateType): void {
  // Use pre-built static templates with 15-25 realistic Ugandan records
  const staticFile = type === 'students'
    ? '/templates/students_import_template.csv'
    : '/templates/staff_import_template.csv'
  const filename = type === 'students'
    ? 'shule_student_import_template.csv'
    : 'shule_staff_import_template.csv'

  const a = document.createElement('a')
  a.href     = staticFile
  a.download = filename
  a.click()
}

/** Download the pre-built fee payments template (25 rows across all classes) */
export function downloadFeeTemplate(): void {
  const a = document.createElement('a')
  a.href     = '/templates/fee_payments_import_template.csv'
  a.download = 'shule_fee_payments_template.csv'
  a.click()
}

/** Download the pre-built exam marks template (20 rows, one class) */
export function downloadExamMarksTemplate(): void {
  const a = document.createElement('a')
  a.href     = '/templates/exam_marks_import_template.csv'
  a.download = 'shule_exam_marks_template.csv'
  a.click()
}

/** Download the pre-built attendance template (20 rows, two days) */
export function downloadAttendanceTemplate(): void {
  const a = document.createElement('a')
  a.href     = '/templates/attendance_import_template.csv'
  a.download = 'shule_attendance_template.csv'
  a.click()
}

/** Download the pre-built timetable reference template (10 rows, two classes) — reference only, no bulk-upload exists yet */
export function downloadTimetableTemplate(): void {
  const a = document.createElement('a')
  a.href     = '/templates/timetable_import_template.csv'
  a.download = 'shule_timetable_template.csv'
  a.click()
}

// ── Shared xlsx helpers ───────────────────────────────────────

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FF0F766E' } } }
  })
  row.height = 26
}

async function downloadXlsx(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Fee payments template (ExcelJS) ──────────────────────────

export async function generateFeeTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Shule Management System'

  // Sheet 1: Data
  const ws = wb.addWorksheet('Fee Payments Import')
  ws.columns = [
    { header: 'student_name',   key: 'student_name',   width: 24 },
    { header: 'class_name',     key: 'class_name',     width: 14 },
    { header: 'stream_name',    key: 'stream_name',    width: 14 },
    { header: 'term',           key: 'term',           width: 10 },
    { header: 'year',           key: 'year',           width: 10 },
    { header: 'amount_paid',    key: 'amount_paid',    width: 18 },
    { header: 'amount_due',     key: 'amount_due',     width: 18 },
    { header: 'payment_date',   key: 'payment_date',   width: 16 },
    { header: 'receipt_number', key: 'receipt_number', width: 16 },
    { header: 'notes',          key: 'notes',          width: 28 },
  ]
  applyHeaderStyle(ws.getRow(1))

  const examples: (string | number)[][] = [
    ['Amara Nakato',    'S.3', 'East', 1, 2026, 250000, 400000, '2026-02-01', 'REC-001', 'Term 1 partial'],
    ['Brian Ssemwanga', 'S.4', '',     1, 2026, 400000, 400000, '2026-02-03', 'REC-002', ''],
    ['Christine Aber',  'S.2', 'West', 1, 2026, 0,      300000, '',           '',         'Bursary case - pending'],
  ]
  examples.forEach((row, i) => {
    ws.addRow(row)
    const argb = i % 2 === 0 ? 'FFF0FDFA' : 'FFECFDF5'
    ws.getRow(i + 2).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
    })
  })

  // Sheet 2: Class Name Guide
  const guideWs = wb.addWorksheet('Class Name Guide')
  guideWs.columns = [
    { header: 'Short Form',    key: 'short', width: 16 },
    { header: 'Long Form',     key: 'long',  width: 20 },
    { header: 'Also Accepted', key: 'alt',   width: 22 },
  ]
  applyHeaderStyle(guideWs.getRow(1))
  ;[
    ['S.1', 'Senior 1', 'S1, Form 1'],
    ['S.2', 'Senior 2', 'S2, Form 2'],
    ['S.3', 'Senior 3', 'S3, Form 3'],
    ['S.4', 'Senior 4', 'S4, Form 4'],
    ['S.5', 'Senior 5', 'S5, Form 5'],
    ['S.6', 'Senior 6', 'S6, Form 6'],
  ].forEach(row => guideWs.addRow(row))

  // Sheet 3: Notes
  const notesWs = wb.addWorksheet('Notes & Instructions')
  notesWs.columns = [
    { header: 'Column',      key: 'col',  width: 20 },
    { header: 'Required?',   key: 'req',  width: 12 },
    { header: 'Description', key: 'desc', width: 52 },
    { header: 'Example',     key: 'ex',   width: 24 },
  ]
  applyHeaderStyle(notesWs.getRow(1))
  const noteRows: string[][] = [
    ['student_name',   'YES', 'Full name — must match the school register (case-insensitive)', 'Amara Nakato'],
    ['class_name',     'YES', 'Class — see "Class Name Guide" sheet for accepted formats',     'S.3'],
    ['stream_name',    'No',  'Stream/section name if your school uses streams',               'East'],
    ['term',           'YES', '1, 2, or 3 only',                                               '1'],
    ['year',           'YES', 'Calendar year (used to match the correct academic year)',        '2026'],
    ['amount_paid',    'YES', 'How much the student has paid this term (UGX, no commas)',       '250000'],
    ['amount_due',     'YES', 'Total fees owed for this term (UGX)',                            '400000'],
    ['payment_date',   'No',  'Date of payment in YYYY-MM-DD format',                          '2026-02-01'],
    ['receipt_number', 'No',  'Receipt reference number from payment records',                 'REC-001'],
    ['notes',          'No',  'Any additional notes about this payment',                       'Bursary case'],
    ['', '', '', ''],
    ['MATCHING LOGIC', '', 'If your file has an admission_number column, it is used directly.', ''],
    ['', '', 'Otherwise class_name narrows the search, then student_name is matched.', ''],
    ['', '', 'Close name matches (1-2 char typos) are flagged for manual confirmation.', ''],
  ]
  noteRows.forEach((row, i) => {
    notesWs.addRow(row)
    if (i === 11) {
      notesWs.getRow(i + 2).getCell(1).font = { bold: true }
    }
  })

  await downloadXlsx(wb, 'fee-payments-import-template.xlsx')
}

// ── Exam marks reference template (ExcelJS) ──────────────────

export async function generateExamMarksTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Shule Management System'

  const ws = wb.addWorksheet('Exam Marks')
  ws.columns = [
    { header: 'student_name', key: 'student_name', width: 24 },
    { header: 'class_name',   key: 'class_name',   width: 14 },
    { header: 'stream_name',  key: 'stream_name',  width: 14 },
    { header: 'score',        key: 'score',        width: 12 },
    { header: 'is_absent',    key: 'is_absent',    width: 12 },
  ]
  applyHeaderStyle(ws.getRow(1))
  ;[
    ['Amara Nakato',    'S.3', 'East', 72, 'FALSE'],
    ['Brian Ssemwanga', 'S.3', 'East', 58, 'FALSE'],
    ['Christine Aber',  'S.3', 'East', '',  'TRUE'],
  ].forEach((row, i) => {
    ws.addRow(row)
    const argb = i % 2 === 0 ? 'FFF0FDFA' : 'FFECFDF5'
    ws.getRow(i + 2).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
    })
  })

  const notesWs = wb.addWorksheet('Notes')
  notesWs.getColumn(1).width = 60
  ;[
    ['NOTE: This template is for reference only.'],
    ['Marks are entered directly on the Mark Entry page in Shule.'],
    ['is_absent: TRUE or FALSE — if TRUE, leave score blank.'],
  ].forEach((row, i) => {
    notesWs.addRow(row)
    if (i === 0) notesWs.getRow(1).getCell(1).font = { bold: true }
  })

  await downloadXlsx(wb, 'exam-marks-reference-template.xlsx')
}
