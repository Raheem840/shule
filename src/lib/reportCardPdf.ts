import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calcCBC } from '../types/app'

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

export type ReportCardPdfData = {
  school: {
    name:              string
    motto:             string | null
    logoUrl:           string | null
    logoBase64:        string | null  // school badge — drawn in the text-header fallback only
    logoMimeType:      string         // 'image/png' | 'image/jpeg'
    templateBase64:    string | null  // PNG/JPG letterhead — used as page header if present
    templateMimeType:  string         // 'image/png' | 'image/jpeg'
  }
  student: {
    firstName:       string
    lastName:        string
    admissionNumber: string
    gender:          string | null
    className:       string
    streamName:      string
  }
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

// ── generateReportCardPDF ──────────────────────────────────────
// Produces a jsPDF document for one student's report card.
// Caller is responsible for doc.save() or uploading the blob.
export function generateReportCardPDF(d: ReportCardPdfData): jsPDF {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W    = 210
  const M    = 14   // left/right margin
  const col2 = W / 2
  let y      = 14

  // ── Header — uploaded template OR designed fallback ────────────
  if (d.school.templateBase64) {
    // Place the school's uploaded letterhead image as the header
    // Fit it full-width; height is proportional (we cap at 60mm)
    const imgProps = doc.getImageProperties(d.school.templateBase64)
    const imgW     = W - M * 2
    const imgH     = Math.min(60, (imgProps.height / imgProps.width) * imgW)
    doc.addImage(d.school.templateBase64, toPdfImageFormat(d.school.templateMimeType), M, y, imgW, imgH)
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
    doc.text(`Term ${d.term}  ·  Academic Year ${d.year}`, col2, y, { align: 'center' })
    y += 8
  } else {
    // Designed fallback (no custom letterhead uploaded): a soft brand-tint
    // banner behind the school identity, badge centered above the name for
    // a composed, single-document feel rather than plain stacked text.
    const bandH = d.school.logoBase64 ? 34 : 26
    doc.setFillColor(240, 253, 250) // brand-light
    doc.rect(0, 0, W, bandH, 'F')

    if (d.school.logoBase64) {
      try {
        const logoProps = doc.getImageProperties(d.school.logoBase64)
        const logoH     = 16
        const logoW     = (logoProps.width / logoProps.height) * logoH
        doc.addImage(d.school.logoBase64, toPdfImageFormat(d.school.logoMimeType), col2 - logoW / 2, 5, logoW, logoH)
        y = 25
      } catch {
        // Malformed image data — skip the badge, text header still renders
        y = 12
      }
    } else {
      y = 12
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text(d.school.name.toUpperCase(), col2, y, { align: 'center' })
    y += 5.5

    if (d.school.motto) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(71, 85, 105)
      doc.text(`"${d.school.motto}"`, col2, y, { align: 'center' })
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
    doc.text(`Term ${d.term}  ·  Academic Year ${d.year}`, col2, y, { align: 'center' })
    doc.setTextColor(0)
    y += 6

    doc.setDrawColor(13, 148, 136)
    doc.setLineWidth(0.6)
    doc.line(M, y, W - M, y)
    y += 5
  }

  // ── Student info ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const fullName = `${d.student.firstName} ${d.student.lastName}`
  doc.text(`Name: `, M, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fullName, M + 12, y)

  doc.setFont('helvetica', 'bold')
  doc.text(`Adm. No: `, col2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(d.student.admissionNumber, col2 + 18, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.text(`Class: `, M, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${d.student.className} ${d.student.streamName}`, M + 13, y)

  doc.setFont('helvetica', 'bold')
  doc.text(`Gender: `, col2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(d.student.gender ?? '—', col2 + 16, y)
  y += 5

  if (d.termStartDate || d.termEndDate) {
    doc.setFont('helvetica', 'bold')
    doc.text(`Term Dates: `, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${fmtDate(d.termStartDate)} – ${fmtDate(d.termEndDate)}`, M + 24, y)
    y += 5
  }

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 5

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

  // ── Attendance (hidden when no data collected yet) ───────────
  if (d.daysPresent > 0 || d.daysAbsent > 0) {
    y = ensureSpace(doc, y, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(13, 148, 136)
    doc.text('ATTENDANCE', M, y)
    doc.setTextColor(0)
    y += 5

    const total      = d.daysPresent + d.daysAbsent
    const attendRate = Math.round((d.daysPresent / total) * 100)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(
      `Days Present: ${d.daysPresent}    Days Absent: ${d.daysAbsent}    Attendance Rate: ${attendRate}%`,
      M, y,
    )
    y += 7

    doc.setDrawColor(226, 232, 240)
    doc.line(M, y, W - M, y)
    y += 5
  }

  // ── Class Teacher's Remarks ───────────────────────────────────
  const remarkLines = doc.splitTextToSize(d.teacherRemarks || '—', W - M * 2)
  y = ensureSpace(doc, y, 10 + remarkLines.length * 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136)
  doc.text("CLASS TEACHER'S REMARKS", M, y)
  doc.setTextColor(0)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(remarkLines, M, y)
  y += remarkLines.length * 4.5 + 4

  doc.setDrawColor(226, 232, 240)
  doc.line(M, y, W - M, y)
  y += 5

  // ── Principal's Remarks ───────────────────────────────────────
  y = ensureSpace(doc, y, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136)
  doc.text("PRINCIPAL'S REMARKS", M, y)
  doc.setTextColor(0)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (d.principalRemarks) {
    const pLines = doc.splitTextToSize(d.principalRemarks, W - M * 2)
    doc.text(pLines, M, y)
    y += pLines.length * 4.5 + 4
  } else {
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.3)
    doc.line(M, y + 2, W - M, y + 2)
    doc.setDrawColor(226, 232, 240)
    y += 8
  }

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 5

  // ── Footer — digital-only, no signature lines. This report card is
  // released and viewed entirely in-app (student/parent portal), never
  // physically signed, so wet-signature blanks would just sit permanently
  // empty. A digital-issue notice replaces them instead. ─────────────────
  y = ensureSpace(doc, y, 20)
  if (d.nextTermStartDate) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Next Term Begins: `, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(fmtDate(d.nextTermStartDate), M + 36, y)
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
    `Digitally issued by ${d.school.name} · Approved by the Principal · ${fmtDate(new Date().toISOString())}`,
    col2, y, { align: 'center' },
  )
  doc.setTextColor(0)

  return doc
}

// ── buildSubjectRows ───────────────────────────────────────────
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
