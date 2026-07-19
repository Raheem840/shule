import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { downloadFile, uploadFile, getPublicUrl } from '../lib/storage'
import { generateReportCardPDF, buildSubjectRows } from '../lib/reportCardPdf'
import { computeOverallAverage, getAutoRemark } from '../lib/autoRemarks'
import type { ReportCard, ReportCardStatus } from '../types/app'
import type { RawResult } from '../lib/reportCardPdf'

// ── Column lists ───────────────────────────────────────────────
const RC_COLS = [
  'id', 'school_id', 'student_id', 'term', 'year', 'status',
  'principal_remarks', 'generated_at',
  'approved_at', 'approved_by',
  'released_at', 'released_by',
  'unlock_reason', 'unlock_count',
  'pdf_url',
].join(', ')

type AnyRow = Record<string, unknown>

function toReportCard(r: AnyRow): ReportCard {
  return {
    id:               r.id as string,
    schoolId:         r.school_id as string,
    studentId:        r.student_id as string,
    term:             r.term as string,
    year:             r.year as number,
    status:           r.status as ReportCardStatus,
    principalRemarks: (r.principal_remarks as string) ?? null,
    generatedAt:      (r.generated_at as string) ?? null,
    approvedAt:       (r.approved_at as string) ?? null,
    approvedBy:       (r.approved_by as string) ?? null,
    releasedAt:       (r.released_at as string) ?? null,
    releasedBy:       (r.released_by as string) ?? null,
    unlockReason:     (r.unlock_reason as string) ?? null,
    unlockCount:      (r.unlock_count as number) ?? 0,
    pdfUrl:           (r.pdf_url as string) ?? null,
  }
}

// ── useReportCards ─────────────────────────────────────────────
export function useReportCards(
  filters: {
    term:      string
    year:      number
    classId?:  string
    streamId?: string
  },
  enabled = true,
) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['report-cards', user?.schoolId, filters],
    enabled:  !!user && enabled,
    queryFn:  async () => {
      // Scope to students in the selected class/stream when classId is provided
      let studentIds: string[] | null = null
      if (filters.classId) {
        let sq = supabase
          .from('students')
          .select('id')
          .eq('school_id', user!.schoolId)
          .eq('class_id', filters.classId)
        if (filters.streamId) sq = sq.eq('stream_id', filters.streamId)
        const { data: stus } = await sq
        studentIds = (stus ?? []).map(s => s.id as string)
        if (studentIds.length === 0) return []
      }

      let q = supabase
        .from('report_cards')
        .select(RC_COLS)
        .eq('school_id', user!.schoolId)
        .eq('term', filters.term)
        .eq('year', filters.year)

      if (studentIds) q = q.in('student_id', studentIds)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map(r => toReportCard(r as unknown as AnyRow))
    },
  })
}

// ── Student readiness check ────────────────────────────────────
// For each student in a class+stream, determine if a report card can be
// generated right now. Deliberately flexible for mid-term reports (e.g. a
// PTA meeting before the End-of-Term exam exists): readiness only requires
// that whatever exam journals a teacher HAS created and marked (CA and/or
// End-of-Term — any assessment type) actually have a mark recorded for the
// student. It does not require an End-of-Term journal to exist at all, and
// it never blocks on a manually-written teacher remark — remarks are always
// auto-generated from performance criteria at generation time (see
// src/lib/autoRemarks.ts), so there is nothing to be "missing" there.
export type ReadinessStatus = 'ready' | 'missing_marks' | 'not_ready'

export type StudentReadiness = {
  studentId:      string
  firstName:      string
  lastName:       string
  admissionNumber: string
  status:         ReadinessStatus
  issues:         string[]
}

export function useStudentReadiness(params: {
  term:     string | null | undefined
  year:     number | null | undefined
  classId:  string | null | undefined
  streamId: string | null | undefined
}) {
  const { user } = useAuth()
  const { term, year, classId, streamId } = params

  return useQuery({
    queryKey: ['student-readiness', user?.schoolId, term, year, classId, streamId],
    enabled:  !!user && !!term && !!year && !!classId,
    queryFn:  async () => {
      // 1. Fetch students in this class/stream
      let sq = supabase
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('school_id', user!.schoolId)
        .eq('class_id', classId!)
        .eq('status', 'active')

      if (streamId) sq = sq.eq('stream_id', streamId)
      const { data: students, error: se } = await sq
      if (se) throw se

      const studentIds = (students ?? []).map(s => s.id as string)
      if (studentIds.length === 0) return []

      // 2. Fetch all exam journals for this class+stream+term+year
      let jq = supabase
        .from('exam_journal')
        .select('id, assessment_type')
        .eq('school_id', user!.schoolId)
        .eq('class_id', classId!)
        .eq('term', term!)
        .eq('year', year!)

      if (streamId) jq = jq.eq('stream_id', streamId)
      const { data: journals, error: je } = await jq
      if (je) throw je

      const journalIds = (journals ?? []).map(j => j.id as string)

      // 3. Fetch exam_results — only meaningful when at least one journal exists
      const resultSet = new Set<string>()
      if (journalIds.length > 0) {
        const { data: results, error: re } = await supabase
          .from('exam_results')
          .select('student_id, exam_journal_id')
          .eq('school_id', user!.schoolId)
          .in('student_id', studentIds)
          .in('exam_journal_id', journalIds)
        if (re) throw re
        for (const r of (results ?? [])) {
          resultSet.add(`${r.student_id as string}::${r.exam_journal_id as string}`)
        }
      }

      // 4. Assess each student — ready as soon as every journal a teacher has
      // actually created (whatever mix of CA/End-of-Term exists so far) has a
      // mark recorded for this student. No journals at all yet => not ready.
      // Remarks are never a readiness blocker — always auto-generated.
      return (students ?? []).map(s => {
        const sid    = s.id as string
        const issues: string[] = []

        if (journalIds.length === 0) {
          issues.push('No exams recorded yet')
        } else {
          const missing = journalIds.filter(jid => !resultSet.has(`${sid}::${jid}`))
          if (missing.length > 0) issues.push(`Missing ${missing.length} mark(s)`)
        }

        const status: ReadinessStatus =
          issues.length === 0        ? 'ready' :
          journalIds.length === 0    ? 'not_ready' :
          'missing_marks'

        return {
          studentId:       sid,
          firstName:       s.first_name as string,
          lastName:        s.last_name as string,
          admissionNumber: s.admission_number as string,
          status,
          issues,
        } satisfies StudentReadiness
      })
    },
  })
}

// ── useGenerateReportCards ─────────────────────────────────────
export type GenerateInput = {
  studentIds: string[]
  term:       number | string
  year:       number
  classId:    string
  streamId:   string | null
  onProgress?: (done: number, total: number) => void
}

export function useGenerateReportCards() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: GenerateInput) => {
      if (!user) throw new Error('Not authenticated')
      if (!['principal', 'dos', 'secretary'].includes(user.role ?? '')) throw new Error('Forbidden')
      const { studentIds, term, year, classId, streamId, onProgress } = input
      const schoolId = user!.schoolId

      // ── Fetch school profile (including template URL) ─────────
      const { data: school, error: se } = await supabase
        .from('school_profile')
        .select('school_name, motto, logo_url, report_template_url')
        .eq('id', schoolId)
        .single()
      if (se) throw se

      // ── Load template image as base64 if one has been uploaded ─
      // report_template_url stores the storage PATH (e.g. "school-id/report.png")
      // We download it through Supabase storage so private bucket auth is handled.
      let templateBase64:   string | null = null
      let templateMimeType: string        = 'image/png'
      const templatePath = (school as Record<string, unknown>).report_template_url as string | null
      if (templatePath) {
        try {
          let blob: Blob | null = null
          let dlErr: Error | null = null
          try { blob = await downloadFile('templates', templatePath) } catch (e) { dlErr = e as Error }
          if (!dlErr && blob) {
            templateMimeType = blob.type || 'image/png'
            const reader = await new Promise<string>((resolve, reject) => {
              const fr = new FileReader()
              fr.onload  = () => resolve(fr.result as string)
              fr.onerror = reject
              fr.readAsDataURL(blob)
            })
            // jsPDF addImage expects raw base64 without the data-URL prefix
            templateBase64 = reader.split(',')[1] ?? null
          }
        } catch {
          // Template load failed — fall back to text header silently
          templateBase64 = null
        }
      }

      // ── Load school badge/logo as base64 (text-header fallback only —
      // a custom letterhead template already carries its own branding) ─
      // logo_url is a full public URL (staff-photos bucket), not a storage
      // path, so it's fetched directly rather than through downloadFile().
      let logoBase64:   string | null = null
      let logoMimeType: string        = 'image/jpeg'
      const logoUrl = (school as Record<string, unknown>).logo_url as string | null
      if (logoUrl && !templateBase64) {
        try {
          const res = await fetch(logoUrl)
          const blob = await res.blob()
          logoMimeType = blob.type || 'image/jpeg'
          const reader = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader()
            fr.onload  = () => resolve(fr.result as string)
            fr.onerror = reject
            fr.readAsDataURL(blob)
          })
          logoBase64 = reader.split(',')[1] ?? null
        } catch {
          // Logo load failed — fall back to text-only header silently
          logoBase64 = null
        }
      }

      // ── Fetch class + stream names ─────────────────────────
      const [clsRes, strRes] = await Promise.all([
        supabase.from('classes').select('name, level').eq('id', classId).eq('school_id', schoolId).single(),
        streamId
          ? supabase.from('streams').select('name, class_teacher_id').eq('id', streamId).eq('school_id', schoolId).single()
          : Promise.resolve({ data: null }),
      ])

      const className      = (clsRes.data?.name as string) ?? ''
      const classLevel     = (clsRes.data?.level as string | null) ?? null
      const streamName     = ((strRes.data as Record<string,unknown> | null)?.name as string) ?? ''
      const classTeacherId = ((strRes.data as Record<string,unknown> | null)?.class_teacher_id as string) ?? null

      // ── Fetch active academic year for term dates ──────────
      const { data: activeYear } = await supabase
        .from('academic_years')
        .select('term1_start,term1_end,term2_start,term2_end,term3_start,term3_end')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .maybeSingle()

      const ay = activeYear as Record<string,string|null> | null
      const termNum = Number(term)
      const termKey = termNum === 1 ? ['term1_start','term1_end'] : termNum === 2 ? ['term2_start','term2_end'] : ['term3_start','term3_end']
      const termStartDate     = ay?.[termKey[0]] ?? null
      const termEndDate       = ay?.[termKey[1]] ?? null
      const nextTermStartDate = termNum === 1 ? (ay?.term2_start ?? null) : termNum === 2 ? (ay?.term3_start ?? null) : null

      // ── Fetch subject names ────────────────────────────────
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name, level, is_active')
        .eq('school_id', schoolId)

      const subjectNames = new Map<string, string>()
      for (const sub of (subjects ?? [])) {
        subjectNames.set(sub.id as string, sub.name as string)
      }

      // Every active subject that applies to this class — a subject with no
      // level restriction applies school-wide; one with a level only shows
      // on report cards for classes at that level. Report cards previously
      // only ever showed subjects a student actually had exam_results for,
      // so a student marked in one out of a full subject list looked like
      // they only took that one subject.
      const allSubjectIds = ((subjects ?? []) as Array<{ id: string; level: string | null; is_active: boolean | null }>)
        .filter(s => s.is_active !== false && (s.level == null || s.level === classLevel))
        .map(s => s.id)

      // ── Fetch all exam_results for these students ──────────
      // Include is_absent so absent students are correctly shown as ABS not 0.
      // exam_journal.status = 'published' — a teacher's draft marks (still
      // being entered/corrected) must never silently flow onto a generated
      // report card, matching the published-only convention used everywhere
      // else in the app (DoS analytics, exam aggregates, etc.).
      const { data: rawResults, error: re } = await supabase
        .from('exam_results')
        .select(`
          student_id, subject_id, score, is_absent,
          exam_journal!inner(
            id, assessment_type, name, ca_label, competency, total_marks, status
          )
        `)
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .eq('term', String(term))
        .eq('year', year)
        .eq('exam_journal.status', 'published')

      if (re) throw re

      // ── Fetch class teacher's auth_user_id ─────────────────
      // Priority: stream's class_teacher_id → staff.role='class_teacher' in this class
      let classTeacherAuthId: string | null = null
      if (classTeacherId) {
        const { data: ct } = await supabase
          .from('staff')
          .select('auth_user_id')
          .eq('id', classTeacherId)
          .maybeSingle()
        classTeacherAuthId = (ct as Record<string,unknown> | null)?.auth_user_id as string ?? null
      }
      if (!classTeacherAuthId) {
        // Fallback: find a class_teacher whose classes array contains classId
        const { data: ct2 } = await supabase
          .from('staff')
          .select('auth_user_id, id')
          .eq('school_id', schoolId)
          .eq('role', 'class_teacher')
          .contains('classes', [classId])
          .not('auth_user_id', 'is', null)
          .limit(1)
          .maybeSingle()
        classTeacherAuthId = (ct2 as Record<string,unknown> | null)?.auth_user_id as string ?? null
      }

      // ── Fetch teacher remarks — prefer class teacher's remark ─
      const { data: rawRemarks } = await supabase
        .from('teacher_remarks')
        .select('student_id, teacher_id, remarks')
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .eq('term', String(term))
        .eq('year', year)

      const remarkMap = new Map<string, string>()
      for (const r of (rawRemarks ?? [])) {
        const sid  = r.student_id as string
        const tid  = r.teacher_id as string
        const text = r.remarks    as string
        // Always store; if class teacher's remark comes later, overwrite with theirs
        if (!remarkMap.has(sid) || tid === classTeacherAuthId) {
          remarkMap.set(sid, text)
        }
      }

      // ── Fetch attendance for this class/term ───────────────
      // Sum per student: present=1, absent=1 (excused also counts absent for report)
      let attQ = supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .in('student_id', studentIds)
      if (termStartDate) attQ = attQ.gte('date', termStartDate)
      if (termEndDate)   attQ = attQ.lte('date', termEndDate)
      const { data: attRows } = await attQ

      const attendanceMap = new Map<string, { present: number; absent: number }>()
      for (const a of (attRows ?? [])) {
        const sid = a.student_id as string
        const cur = attendanceMap.get(sid) ?? { present: 0, absent: 0 }
        if ((a.status as string) === 'present') cur.present++
        else cur.absent++
        attendanceMap.set(sid, cur)
      }

      // ── Fetch student details ──────────────────────────────
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, gender')
        .eq('school_id', schoolId)
        .in('id', studentIds)

      type StudentRow = { id: unknown; first_name: unknown; last_name: unknown; admission_number: unknown; gender: unknown }
      const studentMap = new Map<string, StudentRow>()
      for (const s of (students ?? [])) {
        studentMap.set(s.id as string, s as StudentRow)
      }

      // ── Fetch existing report cards (to check for principal remarks + preserve status) ─
      const { data: existingCards } = await supabase
        .from('report_cards')
        .select('student_id, principal_remarks, status')
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .eq('term', String(term))
        .eq('year', year)

      const principalRemarksMap = new Map<string, string | null>()
      const existingStatusMap   = new Map<string, string>()
      for (const c of (existingCards ?? [])) {
        const sid = c.student_id as string
        principalRemarksMap.set(sid, (c.principal_remarks as string) ?? null)
        if (c.status) existingStatusMap.set(sid, c.status as string)
      }

      // ── Group raw results by student ───────────────────────
      const resultsByStudent = new Map<string, RawResult[]>()
      for (const r of (rawResults ?? [])) {
        const row = r as Record<string, unknown>
        const ej  = row.exam_journal as Record<string, unknown>
        const sid = row.student_id as string
        const entry: RawResult = {
          subjectId:      row.subject_id as string,
          assessmentType: ej.assessment_type as string,
          journalName:    ej.name as string,
          caLabel:        (ej.ca_label as string) ?? null,
          competency:     (ej.competency as string) ?? null,
          score:          (row.score as number) ?? null,
          isAbsent:       (row.is_absent as boolean) ?? false,
          totalMarks:     ej.total_marks as number,
        }
        const list = resultsByStudent.get(sid) ?? []
        list.push(entry)
        resultsByStudent.set(sid, list)
      }

      // ── Generate PDFs one by one ───────────────────────────
      const results: { studentId: string; success: boolean; error?: string }[] = []

      for (let i = 0; i < studentIds.length; i++) {
        const studentId = studentIds[i]
        onProgress?.(i, studentIds.length)

        try {
          const stu      = studentMap.get(studentId)
          if (!stu) throw new Error('Student not found')

          const subjectRows = buildSubjectRows(
            resultsByStudent.get(studentId) ?? [],
            subjectNames,
            allSubjectIds,
          )

          const totalGradePoints = subjectRows.reduce((s, r) => s + (r.gradePoints ?? 0), 0)
          const gradedCount      = subjectRows.filter(r => r.grade !== null).length
          // null (not 0) when nothing is fully graded yet — e.g. a mid-term
          // report where only CA marks exist for every subject — so it
          // reads as "Pending" rather than falsely showing grade E.
          const avgPoints        = gradedCount > 0 ? totalGradePoints / gradedCount : null

          const descriptors: Record<string, string> = {
            A: 'Exceptional', B: 'Outstanding', C: 'Satisfactory', D: 'Basic', E: 'Elementary',
          }

          const avgGrade = avgPoints === null ? 'Pending' :
            avgPoints >= 4.5 ? 'A' :
            avgPoints >= 3.5 ? 'B' :
            avgPoints >= 2.5 ? 'C' :
            avgPoints >= 1.5 ? 'D' : 'E'

          const avgDescriptor = avgPoints === null ? 'Exam not yet complete' : (descriptors[avgGrade] ?? '')

          const autoRemark = getAutoRemark(computeOverallAverage(subjectRows))

          const pdfData = {
            school: {
              name:             school.school_name as string,
              motto:            (school.motto as string) ?? null,
              logoUrl:          (school.logo_url as string) ?? null,
              logoBase64,
              logoMimeType,
              templateBase64,
              templateMimeType,
            },
            student: {
              firstName:       stu.first_name as string,
              lastName:        stu.last_name as string,
              admissionNumber: stu.admission_number as string,
              gender:          (stu.gender as string) ?? null,
              className,
              streamName,
            },
            term:              Number(term),
            year,
            termStartDate,
            termEndDate,
            nextTermStartDate,
            subjects:          subjectRows,
            totalGradePoints,
            avgGrade,
            avgDescriptor,
            daysPresent:       attendanceMap.get(studentId)?.present ?? 0,
            daysAbsent:        attendanceMap.get(studentId)?.absent  ?? 0,
            // A teacher's own written remark always wins when present;
            // otherwise fall back to the automatic performance-band remark
            // so generation never depends on one having been typed in.
            teacherRemarks:    remarkMap.get(studentId) || autoRemark,
            principalRemarks:  principalRemarksMap.get(studentId) ?? null,
          }

          const doc  = generateReportCardPDF(pdfData)
          const blob = doc.output('blob')

          // Upload to Supabase Storage
          const path = `${schoolId}/${year}/${term}/${studentId}.pdf`
          await uploadFile('report-cards', path, blob, { upsert: true, contentType: 'application/pdf' })

          const pdfUrl = getPublicUrl('report-cards', path) ?? ''

          // Upsert report_cards row — preserve status if already approved/released
          const existingStatus = existingStatusMap.get(studentId)
          const upsertStatus = (existingStatus === 'approved' || existingStatus === 'released')
            ? existingStatus
            : 'ready'

          const { error: rcErr } = await supabase
            .from('report_cards')
            .upsert({
              school_id:    schoolId,
              student_id:   studentId,
              term:         String(term),
              year,
              status:       upsertStatus,
              pdf_url:      pdfUrl,
              generated_at: new Date().toISOString(),
            }, {
              onConflict: 'school_id,student_id,term,year',
            })

          if (rcErr) throw rcErr

          results.push({ studentId, success: true })
        } catch (err) {
          results.push({ studentId, success: false, error: String(err) })
        }
      }

      onProgress?.(studentIds.length, studentIds.length)
      return results
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-cards', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['student-readiness', user?.schoolId] })
    },
  })
}

// ── useUpdateReportCardStatus ──────────────────────────────────
function useUpdateStatus(action: 'approve' | 'release' | 'unlock') {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reportCardId,
      principalRemarks,
      unlockReason: _unlockReason,
    }: {
      reportCardId:     string
      principalRemarks?: string | null
      unlockReason?:     string
    }) => {
      if (!user) throw new Error('Not authenticated')
      const now   = new Date().toISOString()
      const patch: AnyRow = {}

      let currentUnlockCount = 0
      if (action === 'unlock') {
        const { data: existing } = await supabase
          .from('report_cards')
          .select('unlock_count')
          .eq('id', reportCardId)
          .eq('school_id', user!.schoolId)
          .single()
        currentUnlockCount = ((existing as Record<string, unknown> | null)?.unlock_count as number) ?? 0
      }

      if (action === 'approve') {
        patch.status          = 'approved'
        patch.approved_at     = now
        // approved_by/released_by are FKs to staff.id, not auth.users.id —
        // user.id is the auth UUID, which always violates
        // report_cards_approved_by_fkey since no staff row has that as its
        // own id.
        patch.approved_by     = user!.staffId ?? null
        if (principalRemarks !== undefined) patch.principal_remarks = principalRemarks
      } else if (action === 'release') {
        patch.status      = 'released'
        patch.released_at = now
        patch.released_by = user!.staffId ?? null
      } else {
        patch.status        = 'draft'
        patch.approved_at   = null
        patch.approved_by   = null
        patch.released_at   = null
        patch.released_by   = null
        patch.unlock_reason = _unlockReason ?? null
        patch.unlock_count  = currentUnlockCount + 1
      }

      const { error } = await supabase
        .from('report_cards')
        .update(patch)
        .eq('id', reportCardId)
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return reportCardId
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['report-cards',        user?.schoolId] })
      if ((vars as any)?.status === 'released' || action === 'release') {
        qc.invalidateQueries({ queryKey: ['parent-report-cards', user?.schoolId] })
        qc.invalidateQueries({ queryKey: ['my-report-cards',     user?.schoolId] })
      }
    },
  })
}

export function useApproveReportCard()  { return useUpdateStatus('approve') }
export function useReleaseReportCard()  { return useUpdateStatus('release') }
export function useUnlockReportCard()   { return useUpdateStatus('unlock') }

// ── useNotifyPrincipal ─────────────────────────────────────────
// Inserts a notification row so the principal knows report cards are ready.
export function useNotifyPrincipal() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ term, year, count }: { term: string | number; year: number; count: number }) => {
      if (!user) throw new Error('Not authenticated')
      // Fetch all principals so each gets a notification row (user_id is required for the bell query)
      const { data: principals } = await supabase
        .from('staff')
        .select('auth_user_id')
        .eq('school_id', user!.schoolId)
        .eq('role', 'principal')
        .not('auth_user_id', 'is', null)

      const rows = (principals ?? []).map((p: any) => ({
        school_id:   user!.schoolId,
        user_id:     p.auth_user_id as string,
        from_user:   user!.id,
        target_role: 'principal',
        type:  'report_card',
        title: 'Report Cards Ready for Approval',
        body:  `${count} report card(s) for Term ${term} ${year} are ready for your review.`,
        link:  '/principal/report-cards',
        read:  false,
        read_at: null,
      }))

      if (rows.length === 0) return
      const { error } = await supabase.from('notifications').insert(rows)
      if (error) throw error
    },
  })
}
