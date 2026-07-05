import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calcFeeStatus } from './useFeePayments'
import type { Student } from '../types/app'
import type { PortalReportCard, ExamResultRow, StudentFeeRecord } from './useParentPortal'

type AnyRow = Record<string, unknown>

// ── useStudentPortalRealtime ───────────────────────────────────
// Every other role's data (messaging, notifications) updates live via a
// Supabase realtime channel — the student portal previously had none, so a
// bursar payment, a newly-published mark, an attendance entry, or a
// promotion (which changes class_id/stream_id) wouldn't show up until the
// query's 5-minute staleTime lapsed and the tab regained focus, or a hard
// refresh. Mirrors the exact channel/.on()/invalidate pattern already used
// in useMessaging.ts. Filters server-side by school_id (Supabase's realtime
// filter can't reference student_id from a subquery), then narrows client-side.
export function useStudentPortalRealtime(studentId: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user || user.role !== 'student' || !studentId) return

    const channel = supabase
      .channel(`student-portal:${user.schoolId}:${studentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = payload.new as AnyRow | undefined
          if (row?.id !== studentId) return
          void qc.invalidateQueries({ queryKey: ['my-student-record', user.schoolId, user.id] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (row?.student_id !== studentId) return
          void qc.invalidateQueries({ queryKey: ['my-fee-balance', user.schoolId, studentId] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_results', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (row?.student_id !== studentId) return
          void qc.invalidateQueries({ queryKey: ['my-exam-results', user.schoolId, studentId] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cards', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (row?.student_id !== studentId) return
          void qc.invalidateQueries({ queryKey: ['my-report-cards', user.schoolId, studentId] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (row?.student_id !== studentId) return
          void qc.invalidateQueries({ queryKey: ['attendance-summary', user.schoolId, studentId] })
          void qc.invalidateQueries({ queryKey: ['attendance-history', user.schoolId, studentId] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_slots', filter: `school_id=eq.${user.schoolId}` },
        () => {
          // A promotion or a DOS edit can change which slots apply — class/stream
          // filtering happens client-side in useTimetableSlots, so just invalidate
          // the whole family rather than trying to match this student's current class.
          void qc.invalidateQueries({ queryKey: ['timetable-slots', user.schoolId] })
        })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [user, studentId, qc])
}

// ── useMyStudentRecord ─────────────────────────────────────────
// Finds the student row linked to the logged-in student's auth account.
// Requires: students table has an auth_user_id column (set when IT Admin
// creates the student's login via an Edge Function).
export function useMyStudentRecord() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-student-record', user?.schoolId, user?.id],
    enabled:  !!user?.id && user?.role === 'student',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, admission_number, first_name, last_name, dob, gender, class_id, stream_id, photo_url, status, enrolled_at, student_type, classes(name)')
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
        studentType:    ((r.student_type as Student['studentType']) ?? null),
        previousSchool: null,
        photoUrl:       (r.photo_url as string) ?? null,
        medicalNotes:   null,
        status:         r.status as Student['status'],
        enrolledAt:     r.enrolled_at as string,
        createdBy:      null,
        // Extra field not in Student type — used for display only
        className:      ((r.classes as any)?.name as string) ?? null,
      } as Student & { className: string | null }
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
        .select('id, term, year, pdf_url, released_at, principal_remarks')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .eq('status',     'released')
        .order('year', { ascending: false })
        .order('term', { ascending: false })

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        id:         r.id as string,
        term:       r.term as string,
        year:       r.year as number,
        pdfUrl:           (r.pdf_url as string) ?? null,
        releasedAt:       (r.released_at as string) ?? null,
        principalRemarks: (r.principal_remarks as string) ?? null,
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
        .select('score, grade, term, year, exam_journal_id, is_absent')
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
        .eq('school_id', user!.schoolId)
        .eq('status', 'published')

      if (jErr) throw jErr

      const subjectIds = [...new Set(((journals ?? []) as AnyRow[]).map(j => j.subject_id as string))]
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', user!.schoolId)
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
          isAbsent:       (r.is_absent as boolean) ?? false,
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
        .select('id, amount_due, amount_paid, balance, payment_date, receipt_number, term, fee_structure_id')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .order('payment_date', { ascending: false, nullsFirst: false })
        .order('term', { ascending: false })

      if (error) throw error

      // Resolve fee structure names
      const feeStructureIds = [...new Set(((data ?? []) as AnyRow[]).map(r => r.fee_structure_id as string).filter(Boolean))]
      const feeNameMap = new Map<string, string>()
      if (feeStructureIds.length > 0) {
        const { data: feeStructures, error: fsError } = await supabase
          .from('fee_structure')
          .select('id, name')
          .eq('school_id', user!.schoolId)
          .in('id', feeStructureIds)
        if (fsError) throw fsError
        for (const fs of (feeStructures ?? []) as AnyRow[]) {
          feeNameMap.set(fs.id as string, fs.name as string)
        }
      }

      return ((data ?? []) as AnyRow[]).map(r => {
        const amtDue  = Number(r.amount_due)  || 0
        const amtPaid = Number(r.amount_paid) || 0
        const balance = r.balance != null ? Number(r.balance) : (amtDue - amtPaid)
        return {
          id:            r.id as string,
          termLabel:     `Term ${r.term}`,
          feeName:       feeNameMap.get(r.fee_structure_id as string) ?? 'Fee Payment',
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
// Submits student end-of-term survey response to student_surveys table.
export function useSubmitSurvey() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: {
      studentId:          string
      academicYearId:     string | null
      term:               string | null
      year:               number | null
      rating:             number
      hardestSubjectId?:  string | null
      favouriteSubjectId?: string | null
      teacherRating?:     number | null
      suggestions?:       string | null
    }) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('student_surveys')
        .insert({
          school_id:            user.schoolId,
          student_id:           payload.studentId,
          academic_year_id:     payload.academicYearId,
          term:                 payload.term,
          year:                 payload.year,
          rating:               payload.rating,
          hardest_subject_id:   payload.hardestSubjectId ?? null,
          favourite_subject_id: payload.favouriteSubjectId ?? null,
          teacher_rating:       payload.teacherRating ?? null,
          suggestions:          payload.suggestions ?? null,
          submitted_at:         new Date().toISOString(),
        })

      if (error) {
        if (error.code === '42P01') throw new Error('Survey temporarily unavailable')
        throw new Error(error.message)
      }
    },
  })
}

// ── useIsEndOfTermSurveyActive ────────────────────────────────
// Returns survey active flag plus the academic year context needed to submit.
export function useIsEndOfTermSurveyActive() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['survey-active', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, survey_active, term1_start, term1_end, term2_start, term2_end, term3_start, term3_end')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      if (!data) return { isActive: false, academicYearId: null, currentTerm: null, currentYear: null }

      const row = data as AnyRow
      const isActive = !!row.survey_active
      const academicYearId = row.id as string
      const today = new Date()
      const termDates = [
        { term: '1', start: row.term1_start as string | null, end: row.term1_end as string | null },
        { term: '2', start: row.term2_start as string | null, end: row.term2_end as string | null },
        { term: '3', start: row.term3_start as string | null, end: row.term3_end as string | null },
      ]
      let currentTerm: string | null = null
      for (const t of termDates) {
        if (!t.start || !t.end) continue
        if (today >= new Date(t.start) && today <= new Date(t.end)) {
          currentTerm = t.term
          break
        }
      }
      return { isActive, academicYearId, currentTerm, currentYear: today.getFullYear() }
    },
  })
}
