import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calcFeeStatus } from './useFeePayments'
import type { Student } from '../types/app'
import type { PortalReportCard, ExamResultRow, StudentFeeRecord } from './useParentPortal'

type AnyRow = Record<string, unknown>

// ── useMyStudentRecord ─────────────────────────────────────────
// Finds the student row linked to the logged-in student's auth account.
// Requires: students table has an auth_user_id column (set when IT Admin
// creates the student's login via an Edge Function).
export function useMyStudentRecord() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-student-record', user?.id],
    enabled:  !!user?.id && user?.role === 'student',
    queryFn: async () => {
      // DB NEEDS: ALTER TABLE students ADD COLUMN auth_user_id UUID REFERENCES auth.users(id)
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, admission_number, first_name, last_name, dob, gender, class_id, stream_id, photo_url, status, enrolled_at')
        .eq('auth_user_id', user!.id)
        .eq('school_id', user!.schoolId)
        .maybeSingle()

      if (error?.code === '42703') return null  // auth_user_id column not yet added
      if (error) throw error
      if (!data) return null

      const r = data as AnyRow
      return {
        id:             r.id as string,
        schoolId:       r.school_id as string,
        admissionNumber: r.admission_number as string,
        firstName:      r.first_name as string,
        lastName:       r.last_name as string,
        dob:            (r.dob as string) ?? null,
        gender:         (r.gender as Student['gender']) ?? null,
        nationality:    null,
        religion:       null,
        classId:        (r.class_id as string) ?? null,
        streamId:       (r.stream_id as string) ?? null,
        studentType:    null,
        previousSchool: null,
        photoUrl:       (r.photo_url as string) ?? null,
        medicalNotes:   null,
        status:         r.status as Student['status'],
        enrolledAt:     r.enrolled_at as string,
        createdBy:      null,
      } satisfies Student
    },
  })
}

// ── useMyReleasedReportCards ──────────────────────────────────
// Student's own released report cards.
export function useMyReleasedReportCards(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-report-cards', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_cards')
        .select('id, term, year, pdf_url, released_at')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .eq('status',     'released')
        .order('year', { ascending: false })
        .order('term', { ascending: false })

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        id:         r.id as string,
        term:       r.term as number,
        year:       r.year as number,
        pdfUrl:     (r.pdf_url as string) ?? null,
        releasedAt: (r.released_at as string) ?? null,
      } satisfies PortalReportCard))
    },
  })
}

// ── useMyExamResults ──────────────────────────────────────────
// Student's own published exam results.
export function useMyExamResults(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-exam-results', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select('score, grade, term, year, exam_journal_id')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .order('year', { ascending: false })
        .order('term', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) return []

      const journalIds = [...new Set((data as AnyRow[]).map(r => r.exam_journal_id as string))]

      const { data: journals, error: jErr } = await supabase
        .from('exam_journal')
        .select('id, name, assessment_type, total_marks, subject_id')
        .in('id', journalIds)
        .eq('status', 'published')

      if (jErr) throw jErr

      const subjectIds = [...new Set(((journals ?? []) as AnyRow[]).map(j => j.subject_id as string))]
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)

      const journalMap = new Map<string, AnyRow>()
      for (const j of (journals ?? []) as AnyRow[]) journalMap.set(j.id as string, j)

      const subjectMap = new Map<string, string>()
      for (const s of (subjects ?? []) as AnyRow[]) subjectMap.set(s.id as string, s.name as string)

      return (data as AnyRow[]).map(r => {
        const j = journalMap.get(r.exam_journal_id as string)
        return {
          subjectName:    j ? (subjectMap.get(j.subject_id as string) ?? '—') : '—',
          assessmentType: (j?.assessment_type as string) ?? '—',
          journalName:    (j?.name as string) ?? '—',
          score:          (r.score as number) ?? null,
          grade:          (r.grade as string) ?? null,
          totalMarks:     (j?.total_marks as number) ?? 0,
          term:           r.term as string,
          year:           r.year as number,
          isAbsent:       false,
        } satisfies ExamResultRow
      })
    },
  })
}

// ── useMyFeeBalance ───────────────────────────────────────────
// Student's own fee payment history.
export function useMyFeeBalance(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-fee-balance', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_payments')
        .select('id, amount_due, amount_paid, balance, payment_date, receipt_number, term, year')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .order('year', { ascending: false })
        .order('term', { ascending: false })

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => {
        const amtDue  = Number(r.amount_due)  || 0
        const amtPaid = Number(r.amount_paid) || 0
        const balance = Number(r.balance)     ?? (amtDue - amtPaid)
        return {
          id:            r.id as string,
          termLabel:     `Term ${r.term} — ${r.year}`,
          amountDue:     amtDue,
          amountPaid:    amtPaid,
          balance,
          paymentDate:   (r.payment_date as string) ?? null,
          receiptNumber: (r.receipt_number as string) ?? null,
          status:        calcFeeStatus(amtPaid, balance),
        } satisfies StudentFeeRecord
      })
    },
  })
}

// ── useSubmitSurvey ───────────────────────────────────────────
// Submits student end-of-term survey response.
// DB NEEDS: survey_responses table
// CREATE TABLE survey_responses (
//   id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   school_id         UUID REFERENCES school_profile(id),
//   student_id        UUID REFERENCES students(id),
//   rating            INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
//   enjoyed_most      TEXT,
//   improve_next_term TEXT,
//   created_at        TIMESTAMPTZ DEFAULT now()
// );
export function useSubmitSurvey() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: {
      studentId:       string
      rating:          number
      enjoyedMost:     string
      improveNextTerm: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('survey_responses')
        .insert({
          school_id:         user.schoolId,
          student_id:        payload.studentId,
          rating:            payload.rating,
          enjoyed_most:      payload.enjoyedMost || null,
          improve_next_term: payload.improveNextTerm || null,
        })

      if (error) {
        if (error.code === '42P01') throw new Error('Survey temporarily unavailable')
        throw new Error(error.message)
      }
    },
  })
}

// ── useIsEndOfTermSurveyActive ────────────────────────────────
// DoS can toggle academic_years.survey_active to show the survey tab to students.
export function useIsEndOfTermSurveyActive() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['survey-active', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('survey_active')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      return !!(data as AnyRow)?.survey_active
    },
  })
}
