import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calcCBC, calculatePLEGrade, plePoints, calculatePLEAggregate, calculatePLEDivision } from '../types/app'
import type { PLEGrade, PLEDivision } from '../types/app'

// ── Types ──────────────────────────────────────────────────────

export type SubjectPdfRow = {
  subjectName: string
  caScores:    Array<{ label: string; score: number | null }>
  totalCaPoints: number
  maxCaPoints:   number
  caOutOf20:     number
  examScore:     number | null
  total:         number | null
  grade:         string | null
  gradePoints:   number | null
  descriptor:    string | null
}

export type ReportCardSchool = {
  name:              string
  motto:             string | null
  logoUrl:           string | null
  logoBase64:        string | null  // school badge — drawn in the text-header fallback only
  logoMimeType:      string         // 'image/png' | 'image/jpeg'
  templateBase64:    string | null  // PNG/JPG letterhead — used as page header if present
  templateMimeType:  string         // 'image/png' | 'image/jpeg'
}

export type ReportCardStudent = {
  firstName:       string
  lastName:        string
  admissionNumber: string
  gender:          string | null
  className:       string
  streamName:      string
}

export type ReportCardPdfData = {
  school:            ReportCardSchool
  student:           ReportCardStudent
  term:              number
  year:              number
  termStartDate:     string | null
  termEndDate:       string | null
  nextTermStartDate: string | null
  subjects:          SubjectPdfRow[]
  totalGradePoints:  number
  avgGrade:          string
  avgDescriptor:     string
  daysPresent:       number
  daysAbsent:        number
  teacherRemarks:    string
  principalRemarks:  string | null
}

// ── Helpers ────────────────────────────────────────────────────

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = 297
  const marginBottom = 14
  if (y + needed > pageH - marginBottom) {
    doc.addPage()
    return 14
  }
  return y
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

// jsPDF's addImage() format param wants a short type token ("JPEG", "PNG"),
// not a full MIME string — passing "image/jpeg" straight through makes it
// try to call a non-existent "processIMAGE/JPEG" method and throw, which
// the caller's try/catch swallows silently. The badge/letterhead image
// never rendered and there was no visible error anywhere to explain why.
function toPdfImageFormat(mimeType: string): string {
  const sub = mimeType.split('/')[1] ?? 'JPEG'
  return sub.toUpperCase() === 'JPG' ? 'JPEG' : sub.toUpperCase()
}

function gradeColor(grade: string | null): [number, number, number] {
  if (grade === 'A') return [16, 185, 129]   // green
  if (grade === 'B') return [14, 165, 233]   // blue
  if (grade === 'C') return [245, 158, 11]   // amber
  if (grade === 'D') return [249, 115, 22]   // orange
  return [244, 63, 94]                       // red
}

// PLE's scale is the reverse of CBC's — D1 (1 point) is the BEST grade,
// F9 (9 points) is the worst. A grade-color function keyed the same way as
// CBC's would show the best possible primary-school grade in danger-red,
// which is exactly backwards — kept as its own function, not a branch
// inside gradeColor, so the two scales can never be confused for each other.
function pleGradeColor(grade: PLEGrade | null): [number, number, number] {
  if (grade === 'D1' || grade === 'D2') return [16, 185, 129]   // green — distinction
  if (grade === 'C3' || grade === 'C4' || grade === 'C5' || grade === 'C6') return [14, 165, 233]  // blue — credit
  if (grade === 'P7' || grade === 'P8') return [245, 158, 11]   // amber — pass
  return [244, 63, 94]                                          // red — fail (F9) or ungraded
}

// ── Shared header/student-info/attendance/remarks/footer ────────
// Used by both generateReportCardPDF (CBC, O-level/A-level) and
// generatePrimaryReportCardPDF (PLE, Primary) — identical for both stages,
// factored out once so the two layouts can never silently drift apart.

function drawHeader(doc: jsPDF, school: ReportCardSchool, term: number, year: number): number {
  const W = 210
  const M = 14
  const col2 = W / 2
  let y = 14

  if (school.templateBase64) {
    const imgProps = doc.getImageProperties(school.templateBase64)
    const imgW     = W - M * 2
    const imgH     = Math.min(60, (imgProps.height / imgProps.width) * imgW)
    doc.addImage(school.templateBase64, toPdfImageFormat(school.templateMimeType), M, y, imgW, imgH)
    y += imgH + 4

    doc.setDrawColor(13, 148, 136)
    doc.setLineWidth(0.6)
    doc.line(M, y, W - M, y)
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('STUDENT REPORT CARD', col2, y, { align: 'center' })
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Term ${term}  ·  Academic Year ${year}`, col2, y, { align: 'center' })
    y += 8
  } else {
    const bandH = school.logoBase64 ? 34 : 26
    doc.setFillColor(240, 253, 250) // brand-light
    doc.rect(0, 0, W, bandH, 'F')

    if (school.logoBase64) {
      try {
        const logoProps = doc.getImageProperties(school.logoBase64)
        const logoH     = 16
        const logoW     = (logoProps.width / logoProps.height) * logoH
        doc.addImage(school.logoBase64, toPdfImageFormat(school.logoMimeType), col2 - logoW / 2, 5, logoW, logoH)
        y = 25
      } catch {
        y = 12
      }
    } else {
      y = 12
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text(school.name.toUpperCase(), col2, y, { align: 'center' })
    y += 5.5

    if (school.motto) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(71, 85, 105)
      doc.text(`"${school.motto}"`, col2, y, { align: 'center' })
      y += 4.5
    }
    doc.setTextColor(0)

    y = Math.max(y, bandH) + 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(13, 148, 136)
    doc.text('STUDENT REPORT CARD', col2, y, { align: 'center' })
    doc.setTextColor(0)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`Term ${term}  ·  Academic Year ${year}`, col2, y, { align: 'center' })
    doc.setTextColor(0)
    y += 6

    doc.setDrawColor(13, 148, 136)
    doc.setLineWidth(0.6)
    doc.line(M, y, W - M, y)
    y += 5
  }

  return y
}

function drawStudentInfo(
  doc: jsPDF,
  student: ReportCardStudent,
  termStartDate: string | null,
  termEndDate: string | null,
  y: number,
): number {
  const W = 210
  const M = 14
  const col2 = W / 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const fullName = `${student.firstName} ${student.lastName}`
  doc.text(`Name: `, M, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fullName, M + 12, y)

  doc.setFont('helvetica', 'bold')
  doc.text(`Adm. No: `, col2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(student.admissionNumber, col2 + 18, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.text(`Class: `, M, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${student.className} ${student.streamName}`, M + 13, y)

  doc.setFont('helvetica', 'bold')
  doc.text(`Gender: `, col2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(student.gender ?? '—', col2 + 16, y)
  y += 5

  if (termStartDate || termEndDate) {
    doc.setFont('helvetica', 'bold')
    doc.text(`Term Dates: `, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${fmtDate(termStartDate)} – ${fmtDate(termEndDate)}`, M + 24, y)
    y += 5
  }

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 5

  return y
}

function drawAttendance(doc: jsPDF, daysPresent: number, daysAbsent: number, y: number): number {
  const W = 210
  const M = 14

  if (daysPresent > 0 || daysAbsent > 0) {
    y = ensureSpace(doc, y, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(13, 148, 136)
    doc.text('ATTENDANCE', M, y)
    doc.setTextColor(0)
    y += 5

    const total      = daysPresent + daysAbsent
    const attendRate = Math.round((daysPresent / total) * 100)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(
      `Days Present: ${daysPresent}    Days Absent: ${daysAbsent}    Attendance Rate: ${attendRate}%`,
      M, y,
    )
    y += 7

    doc.setDrawColor(226, 232, 240)
    doc.line(M, y, W - M, y)
    y += 5
  }

  return y
}

// Shared for both "CLASS TEACHER'S REMARKS" and "PRINCIPAL'S REMARKS" —
// principal remarks draws a blank signature-style line when empty instead
// of the '—' placeholder teacher remarks always has text for.
function drawTextSection(
  doc: jsPDF,
  title: string,
  text: string | null,
  y: number,
  opts: { blankLineWhenEmpty?: boolean } = {},
): number {
  const W = 210
  const M = 14

  if (!text && opts.blankLineWhenEmpty) {
    y = ensureSpace(doc, y, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(13, 148, 136)
    doc.text(title, M, y)
    doc.setTextColor(0)
    y += 5

    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.3)
    doc.line(M, y + 2, W - M, y + 2)
    doc.setDrawColor(226, 232, 240)
    y += 8
  } else {
    const lines = doc.splitTextToSize(text || '—', W - M * 2)
    y = ensureSpace(doc, y, 10 + lines.length * 4.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(13, 148, 136)
    doc.text(title, M, y)
    doc.setTextColor(0)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(lines, M, y)
    y += lines.length * 4.5 + 4
  }

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 5

  return y
}

// Footer — digital-only, no signature lines. This report card is released
// and viewed entirely in-app (student/parent portal), never physically
// signed, so wet-signature blanks would just sit permanently empty. A
// digital-issue notice replaces them instead.
function drawFooter(doc: jsPDF, schoolName: string, nextTermStartDate: string | null, y: number): void {
  const W = 210
  const M = 14
  const col2 = W / 2

  y = ensureSpace(doc, y, 20)
  if (nextTermStartDate) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Next Term Begins: `, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(fmtDate(nextTermStartDate), M + 36, y)
    y += 8
  }

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 5

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Digitally issued by ${schoolName} · Approved by the Principal · ${fmtDate(new Date().toISOString())}`,
    col2, y, { align: 'center' },
  )
  doc.setTextColor(0)
}

// ── generateReportCardPDF (CBC — O-level / A-level) ──────────────
// Produces a jsPDF document for one student's report card.
// Caller is responsible for doc.save() or uploading the blob.
export function generateReportCardPDF(d: ReportCardPdfData): jsPDF {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W    = 210
  const M    = 14   // left/right margin

  let y = drawHeader(doc, d.school, d.term, d.year)
  y = drawStudentInfo(doc, d.student, d.termStartDate, d.termEndDate, y)

  // ── Academic Performance table ───────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136)
  doc.text('ACADEMIC PERFORMANCE', M, y)
  doc.setTextColor(0)
  y += 4

  // Determine max CA count across all subjects
  const maxCA = Math.max(1, ...d.subjects.map(s => s.caScores.length))

  // Build dynamic column headers: Subject, C1...Cn, Pts, Max, /20, Exam, Total, Grade
  const caHeaders = Array.from({ length: maxCA }, (_, i) => `C${i + 1}`)
  const headers   = ['Subject', ...caHeaders, 'Pts', 'Max', '/20', 'Exam', 'Total', 'Grade']

  const body = d.subjects.map(s => {
    // Pad CA scores to maxCA length
    const scores: string[] = caHeaders.map((_, i) => {
      const entry = s.caScores[i]
      return entry !== undefined ? (entry.score !== null ? String(entry.score) : 'ABS') : ''
    })

    // No CA journal recorded yet at all (maxCaPoints === 0) is different
    // from a genuinely-scored 0 — show a dash rather than a number that
    // reads as an actual zero result.
    const hasAnyCA = s.maxCaPoints > 0

    return [
      s.subjectName,
      ...scores,
      hasAnyCA ? String(s.totalCaPoints) : '—',
      hasAnyCA ? String(s.maxCaPoints)   : '—',
      hasAnyCA ? s.caOutOf20.toFixed(1)  : '—',
      s.examScore !== null ? String(s.examScore) : '—',
      s.total     !== null ? s.total.toFixed(1)  : '—',
      s.grade ?? '—',
    ]
  })

  // Column widths: Subject gets ~38mm, CA columns ~7mm each, rest fixed
  const subjectW = 38
  const caW      = 7
  const numW     = 10
  const totalW   = 12
  const gradeW   = 11

  autoTable(doc, {
    startY:          y,
    head:            [headers],
    body,
    margin:          { left: M, right: M },
    theme:           'grid',
    styles: {
      fontSize:    7.5,
      cellPadding: 1.5,
      font:        'helvetica',
    },
    headStyles: {
      fillColor:  [13, 148, 136],
      textColor:  255,
      fontStyle:  'bold',
      halign:     'center',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: subjectW },
      // CA columns
      ...Object.fromEntries(
        Array.from({ length: maxCA }, (_, i) => [i + 1, { halign: 'center', cellWidth: caW }])
      ),
      // Pts, Max, /20, Exam, Total
      [maxCA + 1]: { halign: 'center', cellWidth: numW },
      [maxCA + 2]: { halign: 'center', cellWidth: numW },
      [maxCA + 3]: { halign: 'center', cellWidth: numW },
      [maxCA + 4]: { halign: 'center', cellWidth: numW },
      [maxCA + 5]: { halign: 'center', cellWidth: totalW },
      // Grade — last column
      [headers.length - 1]: { halign: 'center', cellWidth: gradeW, fontStyle: 'bold' },
    },
    didParseCell: data => {
      // Colour-code grade cells in body rows
      if (data.section === 'body' && data.column.index === headers.length - 1) {
        const grade = data.cell.raw as string
        if (['A', 'B', 'C', 'D', 'E'].includes(grade)) {
          const [r, g, b] = gradeColor(grade)
          data.cell.styles.textColor = [r, g, b]
        }
      }
    },
    // Track where the table ends so we can continue below it
    didDrawPage: () => {},
  })

  // Move cursor past the table
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // ── Overall Performance ──────────────────────────────────────
  y = ensureSpace(doc, y, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136)
  doc.text('OVERALL PERFORMANCE', M, y)
  doc.setTextColor(0)
  y += 6

  // totalGradePoints sums 0 for every ungraded subject — showing "0" here
  // when nothing has actually been graded yet (avgGrade === 'Pending')
  // reads as a real zero result rather than "no complete subject yet".
  const gradedSubjects  = d.subjects.filter(s => s.total !== null)
  const marksObtained   = gradedSubjects.reduce((s, r) => s + (r.total ?? 0), 0)
  const marksPossible   = gradedSubjects.length * 100
  const gradePointsDisplay = d.avgGrade === 'Pending' ? '—' : String(d.totalGradePoints)
  const marksDisplay       = gradedSubjects.length > 0 ? `${marksObtained.toFixed(0)} / ${marksPossible}` : '—'

  const stats = [
    { label: 'TOTAL MARKS OBTAINED', value: marksDisplay },
    { label: 'TOTAL GRADE POINTS',   value: gradePointsDisplay },
    { label: 'AVERAGE GRADE',        value: `${d.avgGrade}${d.avgGrade !== 'Pending' ? ` — ${d.avgDescriptor}` : ''}` },
  ]
  const statW = (W - M * 2 - 6) / 3
  stats.forEach((s, i) => {
    const bx = M + i * (statW + 3)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.roundedRect(bx, y, statW, 16, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(s.label, bx + 3, y + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(s.value.length > 12 ? 9 : 11)
    doc.setTextColor(13, 148, 136)
    doc.text(s.value, bx + 3, y + 12)
    doc.setTextColor(0)
  })
  y += 22

  doc.setDrawColor(226, 232, 240)
  doc.line(M, y, W - M, y)
  y += 5

  y = drawAttendance(doc, d.daysPresent, d.daysAbsent, y)
  y = drawTextSection(doc, "CLASS TEACHER'S REMARKS", d.teacherRemarks, y)
  y = drawTextSection(doc, "PRINCIPAL'S REMARKS", d.principalRemarks, y, { blankLineWhenEmpty: true })
  drawFooter(doc, d.school.name, d.nextTermStartDate, y)

  return doc
}

// ── buildSubjectRows (CBC) ───────────────────────────────────────
// Groups raw result rows by subject and computes CBC metrics.
// subjectNames is a Map<subjectId, subjectName> for display.
export type RawResult = {
  subjectId:      string
  assessmentType: string
  journalName:    string
  caLabel:        string | null
  competency?:    string | null
  score:          number | null
  isAbsent:       boolean
  totalMarks:     number
}

export function buildSubjectRows(
  results:      RawResult[],
  subjectNames: Map<string, string>,
  // Every subject that should appear on this report card regardless of
  // whether marks were ever recorded — previously the report card only
  // ever showed subjects with at least one exam_results row, so a student
  // with marks in one subject out of a full curriculum silently looked
  // like they only took that one subject. Any id in here with no matching
  // results still gets a row, with every score/grade field blank.
  allSubjectIds: string[] = [],
): SubjectPdfRow[] {
  // Group by subject
  const bySubject = new Map<string, RawResult[]>()
  for (const r of results) {
    const list = bySubject.get(r.subjectId) ?? []
    list.push(r)
    bySubject.set(r.subjectId, list)
  }

  const rows: SubjectPdfRow[] = []

  for (const subjectId of allSubjectIds) {
    if (bySubject.has(subjectId)) continue
    rows.push({
      subjectName:   subjectNames.get(subjectId) ?? subjectId,
      caScores:      [],
      totalCaPoints: 0,
      maxCaPoints:   0,
      caOutOf20:     0,
      examScore:     null,
      total:         null,
      grade:         null,
      gradePoints:   null,
      descriptor:    null,
    })
  }

  for (const [subjectId, subResults] of bySubject) {
    const caEntries = subResults
      .filter(r => r.assessmentType === 'ca')
      .sort((a, b) => {
        const numA = parseInt((a.caLabel ?? '').replace(/\D/g, ''), 10) || 0
        const numB = parseInt((b.caLabel ?? '').replace(/\D/g, ''), 10) || 0
        return numA - numB
      })

    const etEntry = subResults.find(r => r.assessmentType === 'end_of_term')

    // Report card CA columns keep the standard "C1"/"C2"/"C3" UNEB labelling
    // — the competency/topic recorded on the journal is still captured and
    // shown in the teacher-facing journal UI, just not substituted here.
    const caScores = caEntries.map(r => ({
      label: r.caLabel ?? r.journalName,
      score: r.isAbsent ? null : r.score,
    }))

    const totalCaPoints = caScores.reduce((s, c) => s + (c.score ?? 0), 0)
    const assessed      = caScores.filter(c => c.score !== null).length
    const maxCaPoints   = assessed * 3
    const caOutOf20     = maxCaPoints > 0
      ? Math.round((totalCaPoints / maxCaPoints) * 20 * 10) / 10
      : 0

    const examScore = etEntry && !etEntry.isAbsent ? (etEntry.score ?? null) : null

    let total: number | null = null
    let grade: string | null = null
    let gradePoints: number | null = null
    let descriptor: string | null  = null

    if (assessed > 0 && examScore !== null) {
      const cbc   = calcCBC(totalCaPoints, assessed, examScore)
      total       = cbc.total
      grade       = cbc.grade
      gradePoints = cbc.gradePoints
      descriptor  = cbc.descriptor
    }

    rows.push({
      subjectName:   subjectNames.get(subjectId) ?? subjectId,
      caScores,
      totalCaPoints,
      maxCaPoints,
      caOutOf20,
      examScore,
      total,
      grade,
      gradePoints,
      descriptor,
    })
  }

  return rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName))
}

// ── PRIMARY (PLE) report card ────────────────────────────────────
// PLE grading has no CA/exam weighted-composite concept the way O-level's
// CBC formula does (see calculatePLEGrade's doc-comment in types/app.ts) —
// a Ugandan primary school's termly report simply reports the term's
// exam-based mark per subject, graded D1-F9 directly. Kept as fully
// separate types/functions from the CBC ones above (not a branch inside
// them) for the same reason calculateALevelGrade stays separate from
// calculateCBCGrade: the two layouts can be corrected independently
// without risking cross-contamination.

export type PrimarySubjectPdfRow = {
  subjectName: string
  score:       number | null
  totalMarks:  number | null
  grade:       PLEGrade | null
  points:      number | null
  isCore:      boolean   // one of the 4 official PLE subjects (subjects.is_ple_core)
}

export type PrimaryReportCardPdfData = {
  school:            ReportCardSchool
  student:           ReportCardStudent
  term:              number
  year:              number
  termStartDate:     string | null
  termEndDate:       string | null
  nextTermStartDate: string | null
  subjects:          PrimarySubjectPdfRow[]
  aggregate:         number | null           // sum of points across core subjects; null until all 4 are graded
  division:          PLEDivision | 'Pending'
  daysPresent:       number
  daysAbsent:        number
  teacherRemarks:    string
  principalRemarks:  string | null
}

export type PrimaryRawResult = {
  subjectId:      string
  assessmentType: string
  score:          number | null
  isAbsent:       boolean
  totalMarks:     number
}

export function buildPrimarySubjectRows(
  results:        PrimaryRawResult[],
  subjectNames:   Map<string, string>,
  coreSubjectIds: Set<string>,
  allSubjectIds:  string[] = [],
): PrimarySubjectPdfRow[] {
  const bySubject = new Map<string, PrimaryRawResult[]>()
  for (const r of results) {
    const list = bySubject.get(r.subjectId) ?? []
    list.push(r)
    bySubject.set(r.subjectId, list)
  }

  const rows: PrimarySubjectPdfRow[] = []

  for (const subjectId of allSubjectIds) {
    if (bySubject.has(subjectId)) continue
    rows.push({
      subjectName: subjectNames.get(subjectId) ?? subjectId,
      score: null, totalMarks: null, grade: null, points: null,
      isCore: coreSubjectIds.has(subjectId),
    })
  }

  for (const [subjectId, subResults] of bySubject) {
    // Prefer the end-of-term mark as the term's authoritative result; fall
    // back to whatever other assessment was actually entered (e.g. only a
    // mid-term exists so far) rather than showing a blank subject row.
    const entry = subResults.find(r => r.assessmentType === 'end_of_term' && !r.isAbsent && r.score !== null)
      ?? subResults.find(r => !r.isAbsent && r.score !== null)
      ?? null

    let grade:  PLEGrade | null = null
    let points: number | null   = null
    if (entry && entry.score !== null && entry.totalMarks > 0) {
      const pct = (entry.score / entry.totalMarks) * 100
      grade  = calculatePLEGrade(pct)
      points = plePoints(grade)
    }

    rows.push({
      subjectName: subjectNames.get(subjectId) ?? subjectId,
      score:       entry?.score ?? null,
      totalMarks:  entry?.totalMarks ?? null,
      grade,
      points,
      isCore: coreSubjectIds.has(subjectId),
    })
  }

  return rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName))
}

// Aggregate/division are only meaningful once all 4 core PLE subjects
// (English, Mathematics, Science, Social Studies — flagged via
// subjects.is_ple_core) have a grade this term. Fewer than 4 graded core
// subjects → 'Pending', not a misleadingly-partial number.
export function computePrimaryAggregate(
  rows: PrimarySubjectPdfRow[],
): { aggregate: number | null; division: PLEDivision | 'Pending' } {
  const coreGrades = rows.filter(r => r.isCore && r.grade !== null).map(r => r.grade!)
  if (coreGrades.length < 4) return { aggregate: null, division: 'Pending' }
  const aggregate = calculatePLEAggregate(coreGrades)
  return { aggregate, division: calculatePLEDivision(aggregate) }
}

export function generatePrimaryReportCardPDF(d: PrimaryReportCardPdfData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = 210
  const M   = 14

  let y = drawHeader(doc, d.school, d.term, d.year)
  y = drawStudentInfo(doc, d.student, d.termStartDate, d.termEndDate, y)

  // ── Academic Performance table ───────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136)
  doc.text('ACADEMIC PERFORMANCE', M, y)
  doc.setTextColor(0)
  y += 4

  const headers = ['Subject', 'Score', 'Out of', 'Grade', 'Points']
  const body = d.subjects.map(s => [
    s.isCore ? `${s.subjectName} *` : s.subjectName,
    s.score      !== null ? String(s.score)      : '—',
    s.totalMarks !== null ? String(s.totalMarks)  : '—',
    s.grade  ?? '—',
    s.points !== null ? String(s.points) : '—',
  ])

  autoTable(doc, {
    startY: y,
    head:   [headers],
    body,
    margin: { left: M, right: M },
    theme:  'grid',
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 3) {
        const grade = data.cell.raw as string
        if (/^[DCPF][1-9]$/.test(grade)) {
          const [r, g, b] = pleGradeColor(grade as PLEGrade)
          data.cell.styles.textColor = [r, g, b]
        }
      }
    },
    didDrawPage: () => {},
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('* Core PLE subject (counts toward aggregate)', M, y)
  doc.setTextColor(0)
  y += 6

  // ── Overall Performance ──────────────────────────────────────
  y = ensureSpace(doc, y, 26)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136)
  doc.text('OVERALL PERFORMANCE', M, y)
  doc.setTextColor(0)
  y += 6

  const stats = [
    { label: 'AGGREGATE', value: d.aggregate !== null ? String(d.aggregate) : '—' },
    { label: 'DIVISION',  value: d.division },
  ]
  const statW = (W - M * 2 - 3) / 2
  stats.forEach((s, i) => {
    const bx = M + i * (statW + 3)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.roundedRect(bx, y, statW, 16, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(s.label, bx + 3, y + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(13, 148, 136)
    doc.text(s.value, bx + 3, y + 12)
    doc.setTextColor(0)
  })
  y += 22

  doc.setDrawColor(226, 232, 240)
  doc.line(M, y, W - M, y)
  y += 5

  y = drawAttendance(doc, d.daysPresent, d.daysAbsent, y)
  y = drawTextSection(doc, "CLASS TEACHER'S REMARKS", d.teacherRemarks, y)
  y = drawTextSection(doc, "PRINCIPAL'S REMARKS", d.principalRemarks, y, { blankLineWhenEmpty: true })
  drawFooter(doc, d.school.name, d.nextTermStartDate, y)

  return doc
}
