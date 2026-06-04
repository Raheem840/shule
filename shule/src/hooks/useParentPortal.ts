import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calcFeeStatus } from './useFeePayments'
import type { Student } from '../types/app'

type AnyRow = Record<string, unknown>

// ── Shared portal types ───────────────────────────────────────
export type PortalReportCard = {
  id:              string
  term:            string | number
  year:            number
  pdfUrl:          string | null
  releasedAt:      string | null
  principalRemarks?: string | null
}

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

// ── useParentStudents ─────────────────────────────────────────
// Fetches all students linked to the parent's account via student_ids JWT claim.
export function useParentStudents() {
  const { user } = useAuth()
  const studentIds = user?.studentIds ?? []

  return useQuery({
    queryKey: ['parent-students', user?.schoolId, studentIds],
    enabled:  !!user?.schoolId && studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, admission_number, first_name, last_name, dob, gender, class_id, stream_id, photo_url, status, enrolled_at, student_type, nationality, religion, medical_notes, previous_school')
        .eq('school_id', user!.schoolId)
        .in('id', studentIds)
        .order('first_name')

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        id:             r.id as string,
        schoolId:       r.school_id as string,
        admissionNumber: r.admission_number as string,
        firstName:      r.first_name as string,
        lastName:       r.last_name as string,
        dob:            (r.dob as string) ?? null,
        gender:         (r.gender as Student['gender']) ?? null,
        nationality:    (r.nationality as string) ?? 'Ugandan',
        religion:       (r.religion as string) ?? null,
        classId:        (r.class_id as string) ?? null,
        streamId:       (r.stream_id as string) ?? null,
        studentType:    (r.student_type as Student['studentType']) ?? null,
        previousSchool: (r.previous_school as string) ?? null,
        photoUrl:       (r.photo_url as string) ?? null,
        medicalNotes:   (r.medical_notes as string) ?? null,
        status:         r.status as Student['status'],
        enrolledAt:     r.enrolled_at as string,
        createdBy:      null,
      } satisfies Student))
    },
  })
}

// ── useStudentReleasedReportCards ─────────────────────────────
export function useStudentReleasedReportCards(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-report-cards', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_cards')
        .select('id, term, year, pdf_url, released_at, principal_remarks')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .eq('status',     'released')
        .order('year',  { ascending: false })
        .order('term',  { ascending: false })

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        id:              r.id as string,
        term:            r.term as string,
        year:            r.year as number,
        pdfUrl:          (r.pdf_url as string) ?? null,
        releasedAt:      (r.released_at as string) ?? null,
        principalRemarks: (r.principal_remarks as string) ?? null,
      } satisfies PortalReportCard))
    },
  })
}

// ── useStudentExamSummary ─────────────────────────────────────
export function useStudentExamSummary(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-exam-summary', user?.schoolId, studentId],
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
export function useStudentFeeBalance(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-fee-balance', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_payments')
        .select('id, amount_due, amount_paid, balance, payment_date, receipt_number, term')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .order('payment_date', { ascending: false, nullsFirst: false })
        .order('term',         { ascending: false })

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => {
        const amtDue  = Number(r.amount_due)  || 0
        const amtPaid = Number(r.amount_paid) || 0
        const balance = Number(r.balance)     ?? (amtDue - amtPaid)
        return {
          id:            r.id as string,
          termLabel:     `Term ${r.term}`,
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

// ── useSchoolNotices ──────────────────────────────────────────
// Returns the last 20 school-wide announcements (messages marked is_announcement=true).
export function useSchoolNotices() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['school-notices', user?.schoolId],
    enabled:  !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, body, link, sent_at')
        .eq('school_id',     user!.schoolId)
        .eq('is_announcement', true)
        .order('sent_at', { ascending: false })
        .limit(20)

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        id:        r.id as string,
        body:      r.body as string,
        link:      (r.link as string) ?? null,
        createdAt: r.sent_at as string,
      }))
    },
  })
}

// ── useParentAccounts ─────────────────────────────────────────
export function useParentAccounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-accounts', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, school_id, email, full_name, phone, auth_user_id, temp_password, student_ids, created_by, created_at')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map(r => ({
        id:           r.id as string,
        schoolId:     r.school_id as string,
        email:        r.email as string,
        studentIds:   (r.student_ids as string[]) ?? [],
        createdBy:    r.created_by as string,
        createdAt:    r.created_at as string,
        fullName:     (r.full_name as string) ?? null,
        phone:        (r.phone as string) ?? null,
        authUserId:   (r.auth_user_id as string) ?? null,
        tempPassword: (r.temp_password as string) ?? null,
      }))
    },
  })
}

// ── useGenerateParentAccess ──────────────────────────────────
// Full flow:
//   1. Look up student's primary guardian (from student_guardians)
//   2. Use guardian's email if available; otherwise generate from admission number
//   3. Check if a parent_account with that email already exists
//      → If yes: add this student to student_ids (shared account across siblings)
//      → If no:  create new parent_account with guardian info
//   4. Call create-parent-auth-user Edge Function to create Supabase auth user
//      and set parent_accounts.auth_user_id (service role, server-side)
//   5. Return { email, tempPassword, isNew, guardianName }
export type GeneratedAccess = {
  email:        string
  tempPassword: string
  isNew:        boolean
  guardianName: string | null
}

export function useGenerateParentAccess() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (student: { id: string; admissionNumber: string }): Promise<GeneratedAccess> => {
      // ── 1. School short name for fallback email ──────────────
      const { data: school } = await supabase
        .from('school_profile')
        .select('short_name')
        .eq('id', user!.schoolId)
        .single()

      const shortName = ((school?.short_name as string) ?? 'school')
        .toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')

      // Generate a real random password so the IT admin credentials page shows a working one
      function generateParentPassword(): string {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
        const arr = new Uint8Array(12)
        crypto.getRandomValues(arr)
        return Array.from(arr, b => chars[b % chars.length]).join('')
      }
      const TEMP_PASSWORD = generateParentPassword()

      // ── 2. Fetch student's guardians ─────────────────────────
      const { data: guardianRows } = await supabase
        .from('student_guardians')
        .select('id, full_name, email, phone, is_primary, relationship, do_not_contact')
        .eq('school_id', user!.schoolId)
        .eq('student_id', student.id)
        .order('is_primary', { ascending: false })  // primary first

      const guardians = guardianRows ?? []
      const primaryGuardian = guardians[0] ?? null

      // ── 3. Decide login email ────────────────────────────────
      // Use guardian email if available, else generate from admission number
      const guardianEmail = (primaryGuardian as AnyRow)?.email as string | null | undefined
      const guardianName  = (primaryGuardian as AnyRow)?.full_name as string | null | undefined

      const loginEmail = guardianEmail?.trim()
        ? guardianEmail.trim().toLowerCase()
        : `parent.${student.admissionNumber.toLowerCase().replace(/\//g, '-').replace(/[^a-z0-9-]/g, '')}@${shortName}.ug`

      // ── 4. Check if parent account already exists for this email ──
      const { data: existingByEmail } = await supabase
        .from('parent_accounts')
        .select('id, email, student_ids, auth_user_id, temp_password')
        .eq('school_id', user!.schoolId)
        .eq('email', loginEmail)
        .maybeSingle()

      if (existingByEmail) {
        const existing = existingByEmail as AnyRow
        const currentIds = (existing.student_ids as string[]) ?? []

        // Add this student to the existing account if not already there
        if (!currentIds.includes(student.id)) {
          await supabase
            .from('parent_accounts')
            .update({ student_ids: [...currentIds, student.id] })
            .eq('id', existing.id as string)
        }

        // Try to create auth user if not already done
        if (!existing.auth_user_id) {
          await supabase.functions.invoke('create-parent-auth-user', {
            body: {
              parentAccountId: existing.id as string,
              email:           loginEmail,
              schoolId:        user!.schoolId,
              password:        TEMP_PASSWORD,
            },
          }).catch(() => { /* Edge Function not deployed yet — auth_user_id stays null */ })
        }

        return {
          email:        loginEmail,
          tempPassword: (existing.temp_password as string) ?? TEMP_PASSWORD,
          isNew:        false,
          guardianName: guardianName ?? null,
        }
      }

      // ── 5. Also check if this student already has an account ─
      const { data: existingByStudent } = await supabase
        .from('parent_accounts')
        .select('id, email, student_ids, auth_user_id, temp_password')
        .eq('school_id', user!.schoolId)
        .contains('student_ids', [student.id])
        .maybeSingle()

      if (existingByStudent) {
        const existing = existingByStudent as AnyRow
        return {
          email:        (existing.email as string),
          tempPassword: (existing.temp_password as string) ?? TEMP_PASSWORD,
          isNew:        false,
          guardianName: guardianName ?? null,
        }
      }

      // ── 6. Create new parent account ─────────────────────────
      const { data: newAccount, error: insertError } = await supabase
        .from('parent_accounts')
        .insert({
          school_id:     user!.schoolId,
          email:         loginEmail,
          full_name:     guardianName ?? null,
          phone:         (primaryGuardian as AnyRow)?.phone as string ?? null,
          temp_password: TEMP_PASSWORD,
          student_ids:   [student.id],
          created_by:    user!.id,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // ── 7. Create Supabase auth user via Edge Function ───────
      await supabase.functions.invoke('create-parent-auth-user', {
        body: {
          parentAccountId: (newAccount as AnyRow).id as string,
          email:           loginEmail,
          schoolId:        user!.schoolId,
          password:        TEMP_PASSWORD,
        },
      }).catch(() => { /* Edge Function not deployed — auth_user_id stays null for now */ })

      return {
        email:        loginEmail,
        tempPassword: TEMP_PASSWORD,
        isNew:        true,
        guardianName: guardianName ?? null,
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-accounts'] })
    },
  })
}

// ── useStudentGuardians ──────────────────────────────────────
// Fetch guardians for a specific student (used in ParentCredentialsPage)
export function useStudentGuardians(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-guardians', studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_guardians')
        .select('id, full_name, relationship, phone, email, is_primary, do_not_contact')
        .eq('school_id', user!.schoolId)
        .eq('student_id', studentId!)
        .order('is_primary', { ascending: false })

      if (error) throw error
      return (data ?? []).map(r => ({
        id:           r.id as string,
        fullName:     (r.full_name as string) ?? '',
        relationship: (r.relationship as string) ?? '',
        phone:        (r.phone as string) ?? null,
        email:        (r.email as string) ?? null,
        isPrimary:    (r.is_primary as boolean) ?? false,
        doNotContact: (r.do_not_contact as boolean) ?? false,
      }))
    },
  })
}
