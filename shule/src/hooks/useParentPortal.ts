import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calcFeeStatus } from './useFeePayments'
import type { Student } from '../types/app'

type AnyRow = Record<string, unknown>

const STUDENT_COLS = [
  'id', 'school_id', 'admission_number', 'first_name', 'last_name',
  'dob', 'gender', 'class_id', 'stream_id', 'student_type',
  'photo_url', 'status', 'enrolled_at',
].join(', ')

function toStudent(r: AnyRow): Student {
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
    studentType:    (r.student_type as Student['studentType']) ?? null,
    previousSchool: null,
    photoUrl:       (r.photo_url as string) ?? null,
    medicalNotes:   null,
    status:         r.status as Student['status'],
    enrolledAt:     r.enrolled_at as string,
    createdBy:      null,
  }
}

// ── useParentStudents ─────────────────────────────────────────
// Loads every child linked to this parent's account via JWT student_ids[].
export function useParentStudents() {
  const { user } = useAuth()
  const ids = user?.studentIds ?? []

  return useQuery({
    queryKey: ['parent-students', ids],
    enabled:  ids.length > 0 && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select(STUDENT_COLS)
        .in('id', ids)
        .eq('school_id', user!.schoolId)
        .order('first_name', { ascending: true })

      if (error) throw error
      return ((data ?? []) as AnyRow[]).map(toStudent)
    },
  })
}

// ── useStudentReleasedReportCards ─────────────────────────────
// Returns released report cards (with PDF URLs) for a child.
// RLS must allow parents to SELECT report_cards where student_id ∈ student_ids[].
export type PortalReportCard = {
  id:         string
  term:       number
  year:       number
  pdfUrl:     string | null
  releasedAt: string | null
}

export function useStudentReleasedReportCards(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['portal-report-cards', user?.schoolId, studentId],
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

// ── useStudentExamSummary ─────────────────────────────────────
// Returns published exam results for a student grouped by term/year.
export type ExamResultRow = {
  subjectName:    string
  assessmentType: string
  journalName:    string
  score:          number | null
  grade:          string | null
  totalMarks:     number
  term:           string
  year:           number
  isAbsent:       boolean
}

export function useStudentExamSummary(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['portal-exam-summary', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select('score, grade, is_absent, term, year, exam_journal_id')
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
          isAbsent:       (r.is_absent as boolean) ?? false,
        } satisfies ExamResultRow
      })
    },
  })
}

// ── useStudentFeeBalance ──────────────────────────────────────
// Returns fee payment history for a student — no salary data.
// RLS must allow parent/student SELECT on fee_payments for their own student_id.
export type StudentFeeRecord = {
  id:            string
  termLabel:     string
  amountDue:     number
  amountPaid:    number
  balance:       number
  paymentDate:   string | null
  receiptNumber: string | null
  status:        'paid' | 'partial' | 'unpaid'
}

export function useStudentFeeBalance(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['portal-fee-balance', user?.schoolId, studentId],
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

// ── useGenerateParentAccess ──────────────────────────────────
// Secretary one-click: auto-generate email + set temp password for a student's parent.
// Email format: parent.[admission_number_sanitised]@[school_shortname].ug
// If an account already exists for this student, returns existing credentials.
export type GeneratedAccess = {
  email:        string
  tempPassword: string
  isNew:        boolean
}

export function useGenerateParentAccess() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (student: { id: string; admissionNumber: string }): Promise<GeneratedAccess> => {
      const { data: school } = await supabase
        .from('school_profile')
        .select('short_name')
        .eq('id', user!.schoolId)
        .single()

      const shortName = ((school?.short_name as string) ?? 'school').toLowerCase().replace(/\s+/g, '')
      const admNo     = student.admissionNumber.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '')
      const email     = `parent.${admNo}@${shortName}.ug`
      const tempPw    = 'Parent@2025'

      // Check for existing account linked to this student
      const { data: existing } = await supabase
        .from('parent_accounts')
        .select('id, email, temp_password')
        .eq('school_id', user!.schoolId)
        .contains('student_ids', [student.id])
        .maybeSingle()

      if (existing) {
        return {
          email:        (existing as AnyRow).email as string,
          tempPassword: ((existing as AnyRow).temp_password as string) ?? tempPw,
          isNew:        false,
        }
      }

      const { error } = await supabase
        .from('parent_accounts')
        .insert({
          school_id:     user!.schoolId,
          full_name:     'Parent / Guardian',
          email,
          phone:         null,
          student_ids:   [student.id],
          temp_password: tempPw,
          created_by:    user!.id,
        })

      if (error) throw error
      return { email, tempPassword: tempPw, isNew: true }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-accounts'] })
    },
  })
}
