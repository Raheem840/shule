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

  // ── Header — uploaded template OR text fallback ───────────────
  if (d.school.templateBase64) {
    // Place the school's uploaded letterhead image as the header
    // Fit it full-width; height is proportional (we cap at 60mm)
    const imgProps = doc.getImageProperties(d.school.templateBase64)
    const imgW     = W - M * 2
    const imgH     = Math.min(60, (imgProps.height / imgProps.width) * imgW)
    doc.addImage(d.school.templateBase64, d.school.templateMimeType, M, y, imgW, imgH)
    y += imgH + 4

    // Thin teal rule below the template image
    doc.setDrawColor(13, 148, 136)
    doc.setLineWidth(0.6)
    doc.line(M, y, W - M, y)
    y += 4

    // Title + term still needed below the image
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('STUDENT REPORT CARD', col2, y, { align: 'center' })
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Term ${d.term}  ·  Academic Year ${d.year}`, col2, y, { align: 'center' })
    y += 6
  } else {
    // Text-only fallback (no template uploaded)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(d.school.name.toUpperCase(), col2, y, { align: 'center' })
    y += 6

    if (d.school.motto) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.text(`"${d.school.motto}"`, col2, y, { align: 'center' })
      y += 5
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('STUDENT REPORT CARD', col2, y, { align: 'center' })
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Term ${d.term}  ·  Academic Year ${d.year}`, col2, y, { align: 'center' })
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

    return [
      s.subjectName,
      ...scores,
      String(s.totalCaPoints),
      String(s.maxCaPoints),
      s.caOutOf20.toFixed(1),
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
  y = ensureSpace(doc, y, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136)
  doc.text('OVERALL PERFORMANCE', M, y)
  doc.setTextColor(0)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Total Grade Points: ${d.totalGradePoints}`, M, y)
  doc.text(`Average Grade: ${d.avgGrade} — ${d.avgDescriptor}`, col2, y)
  y += 7

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

  // ── Footer ────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 20)
  if (d.nextTermStartDate) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Next Term Begins: `, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(fmtDate(d.nextTermStartDate), M + 36, y)
    y += 7
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Class Teacher: _________________________  Date: _____________', M, y)
  y += 6
  doc.text('Principal: ____________________________', M, y)

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
  score:          number | null
  isAbsent:       boolean
  totalMarks:     number
}

export function buildSubjectRows(
  results:      RawResult[],
  subjectNames: Map<string, string>,
): SubjectPdfRow[] {
  // Group by subject
  const bySubject = new Map<string, RawResult[]>()
  for (const r of results) {
    const list = bySubject.get(r.subjectId) ?? []
    list.push(r)
    bySubject.set(r.subjectId, list)
  }

  const rows: SubjectPdfRow[] = []

  for (const [subjectId, subResults] of bySubject) {
    const caEntries = subResults
      .filter(r => r.assessmentType === 'ca')
      .sort((a, b) => {
        const numA = parseInt((a.caLabel ?? '').replace(/\D/g, ''), 10) || 0
        const numB = parseInt((b.caLabel ?? '').replace(/\D/g, ''), 10) || 0
        return numA - numB
      })

    const etEntry = subResults.find(r => r.assessmentType === 'end_of_term')

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
