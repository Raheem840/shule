import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { generateReportCardPDF, buildSubjectRows } from '../lib/reportCardPdf'
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
// For each student in a class+stream, determine if they have all required
// data for report card generation: CA marks, end-of-term marks, remarks.
export type ReadinessStatus = 'ready' | 'missing_marks' | 'missing_remarks' | 'not_ready'

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

      const journalIds   = (journals ?? []).map(j => j.id as string)
      const caJournalIds = (journals ?? []).filter(j => j.assessment_type === 'ca').map(j => j.id as string)
      const etJournalIds = (journals ?? []).filter(j => j.assessment_type === 'end_of_term').map(j => j.id as string)

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

      // 4. Fetch teacher_remarks for these students+term+year
      const { data: remarks, error: mke } = await supabase
        .from('teacher_remarks')
        .select('student_id')
        .eq('school_id', user!.schoolId)
        .in('student_id', studentIds)
        .eq('term', term!)
        .eq('year', year!)

      if (mke) throw mke
      const remarkSet = new Set<string>((remarks ?? []).map(r => r.student_id as string))

      // 5. Assess each student
      return (students ?? []).map(s => {
        const sid    = s.id as string
        const issues: string[] = []

        // Check all CA journals have a result
        const missingCA = caJournalIds.filter(jid => !resultSet.has(`${sid}::${jid}`))
        if (missingCA.length > 0) issues.push(`Missing ${missingCA.length} CA mark(s)`)

        // Check end-of-term result exists
        if (etJournalIds.length === 0) {
          issues.push('No end-of-term exam created')
        } else {
          const missingET = etJournalIds.filter(jid => !resultSet.has(`${sid}::${jid}`))
          if (missingET.length > 0) issues.push('Missing end-of-term mark(s)')
        }

        // Check remarks
        if (!remarkSet.has(sid)) issues.push('Missing teacher remarks')

        let status: ReadinessStatus = 'ready'
        if (issues.length === 1 && issues[0].includes('remarks')) {
          status = 'missing_remarks'
        } else if (issues.some(i => i.includes('mark') || i.includes('exam'))) {
          status = issues.length > 1 ? 'not_ready' : 'missing_marks'
        }

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
  term:       number
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
      const { studentIds, term, year, classId, streamId, onProgress } = input
      const schoolId = user!.schoolId

      // ── Fetch school profile ───────────────────────────────
      const { data: school, error: se } = await supabase
        .from('school_profile')
        .select('school_name, motto, logo_url')
        .eq('id', schoolId)
        .single()
      if (se) throw se

      // ── Fetch class + stream names ─────────────────────────
      const { data: cls } = await supabase
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single()

      const { data: str } = streamId
        ? await supabase.from('streams').select('name').eq('id', streamId).single()
        : { data: null }

      const className  = (cls?.name as string) ?? ''
      const streamName = (str?.name as string) ?? ''

      // ── Fetch subject names ────────────────────────────────
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', schoolId)

      const subjectNames = new Map<string, string>()
      for (const sub of (subjects ?? [])) {
        subjectNames.set(sub.id as string, sub.name as string)
      }

      // ── Fetch all exam_results for these students ──────────
      const { data: rawResults, error: re } = await supabase
        .from('exam_results')
        .select(`
          student_id, subject_id, score,
          exam_journal!inner(
            id, assessment_type, name, ca_label, total_marks
          )
        `)
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .eq('term', String(term))
        .eq('year', year)

      if (re) throw re

      // ── Fetch teacher remarks ──────────────────────────────
      const { data: rawRemarks } = await supabase
        .from('teacher_remarks')
        .select('student_id, remarks')
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .eq('term', String(term))
        .eq('year', year)

      const remarkMap = new Map<string, string>()
      for (const r of (rawRemarks ?? [])) {
        remarkMap.set(r.student_id as string, r.remarks as string)
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

      // ── Fetch existing report cards (to check for principal remarks) ─
      const { data: existingCards } = await supabase
        .from('report_cards')
        .select('student_id, principal_remarks')
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .eq('term', term)
        .eq('year', year)

      const principalRemarksMap = new Map<string, string | null>()
      for (const c of (existingCards ?? [])) {
        principalRemarksMap.set(c.student_id as string, (c.principal_remarks as string) ?? null)
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
          score:          (row.score as number) ?? null,
          isAbsent:       false,
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
          )

          const totalGradePoints = subjectRows.reduce((s, r) => s + (r.gradePoints ?? 0), 0)
          const gradedCount      = subjectRows.filter(r => r.grade !== null).length
          const avgPoints        = gradedCount > 0 ? totalGradePoints / gradedCount : 0

          const avgGrade =
            avgPoints >= 4.5 ? 'A' :
            avgPoints >= 3.5 ? 'B' :
            avgPoints >= 2.5 ? 'C' :
            avgPoints >= 1.5 ? 'D' : 'E'

          const descriptors: Record<string, string> = {
            A: 'Exceptional', B: 'Outstanding', C: 'Satisfactory', D: 'Basic', E: 'Elementary',
          }

          const pdfData = {
            school: {
              name:    school.school_name as string,
              motto:   (school.motto as string) ?? null,
              logoUrl: (school.logo_url as string) ?? null,
            },
            student: {
              firstName:       stu.first_name as string,
              lastName:        stu.last_name as string,
              admissionNumber: stu.admission_number as string,
              gender:          (stu.gender as string) ?? null,
              className,
              streamName,
            },
            term,
            year,
            termStartDate:     null,
            termEndDate:       null,
            nextTermStartDate: null,
            subjects:          subjectRows,
            totalGradePoints,
            avgGrade,
            avgDescriptor:     descriptors[avgGrade] ?? '',
            daysPresent:       0,
            daysAbsent:        0,
            teacherRemarks:    remarkMap.get(studentId) ?? '',
            principalRemarks:  principalRemarksMap.get(studentId) ?? null,
          }

          const doc  = generateReportCardPDF(pdfData)
          const blob = doc.output('blob')

          // Upload to Supabase Storage
          const path = `${schoolId}/${year}/${term}/${studentId}.pdf`
          const { error: uploadErr } = await supabase.storage
            .from('report-cards')
            .upload(path, blob, { upsert: true, contentType: 'application/pdf' })

          if (uploadErr) throw uploadErr

          const { data: urlData } = supabase.storage
            .from('report-cards')
            .getPublicUrl(path)

          const pdfUrl = urlData.publicUrl

          // Upsert report_cards row
          const { error: rcErr } = await supabase
            .from('report_cards')
            .upsert({
              school_id:    schoolId,
              student_id:   studentId,
              term:         String(term),
              year,
              status:       'ready',
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
      const now   = new Date().toISOString()
      const patch: AnyRow = {}

      if (action === 'approve') {
        patch.status          = 'approved'
        patch.approved_at     = now
        patch.approved_by     = user!.id
        if (principalRemarks !== undefined) patch.principal_remarks = principalRemarks
      } else if (action === 'release') {
        patch.status      = 'released'
        patch.released_at = now
        patch.released_by = user!.id
      } else {
        patch.status        = 'draft'
        patch.approved_at   = null
        patch.approved_by   = null
        patch.released_at   = null
        patch.released_by   = null
        patch.unlock_reason = _unlockReason ?? null
      }

      const { error } = await supabase
        .from('report_cards')
        .update(patch)
        .eq('id', reportCardId)
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return reportCardId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-cards', user?.schoolId] })
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
    mutationFn: async ({ term, year, count }: { term: number; year: number; count: number }) => {
      const { error } = await supabase
        .from('notifications')
        .insert({
          school_id: user!.schoolId,
          from_user: user!.id,
          target_role: 'principal',
          title: 'Report Cards Ready for Approval',
          body:  `${count} report card(s) for Term ${term} ${year} are ready for your review.`,
          link:  '/principal/report-cards',
        })
      if (error) throw error
    },
  })
}
