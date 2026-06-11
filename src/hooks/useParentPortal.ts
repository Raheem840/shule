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
  id:             string
  termLabel:      string
  feeName:        string
  amountDue:      number
  amountPaid:     number
  balance:        number
  paymentDate:    string | null
  receiptNumber:  string | null
  status:         'paid' | 'partial' | 'unpaid'
}

// ── useParentStudents ─────────────────────────────────────────
// Fetches all students linked to the parent's account.
// Primary source: student_ids JWT claim.
// Fallback: query parent_accounts directly if JWT claim is empty
// (happens when the account was linked after the current JWT was issued).
export function useParentStudents() {
  const { user } = useAuth()
  const jwtStudentIds = user?.studentIds ?? []

  // Fallback query — only fires when JWT has no student_ids.
  // Kept separate so it can't block the main loading indicator forever.
  const { data: fallbackIds = [], isLoading: idsLoading } = useQuery({
    queryKey: ['parent-account-ids', user?.id],
    enabled:  user?.role === 'parent' && !!user?.id && jwtStudentIds.length === 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('parent_accounts')
        .select('student_ids')
        .eq('school_id', user!.schoolId)
        .eq('auth_user_id', user!.id)
        .maybeSingle()
      return (data?.student_ids as string[]) ?? []
    },
  })

  const effectiveIds = jwtStudentIds.length > 0 ? jwtStudentIds : fallbackIds

  const studentsQuery = useQuery({
    queryKey: ['parent-students', user?.schoolId, effectiveIds],
    enabled:  !!user?.schoolId && effectiveIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, admission_number, first_name, last_name, dob, gender, class_id, stream_id, photo_url, status, enrolled_at, student_type, nationality, religion, medical_notes, previous_school')
        .eq('school_id', user!.schoolId)
        .in('id', effectiveIds)
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
        authUserId:     (r.auth_user_id as string) ?? null,
      } satisfies Student))
    },
  })

  // Combine loading: show skeleton while fetching account IDs OR student rows
  return {
    ...studentsQuery,
    isLoading: idsLoading || studentsQuery.isLoading,
  }
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
      const [paymentsRes, fsRes] = await Promise.all([
        supabase
          .from('fee_payments')
          .select('id, fee_structure_id, amount_due, amount_paid, balance, payment_date, receipt_number, term')
          .eq('school_id',  user!.schoolId)
          .eq('student_id', studentId!)
          .order('term',         { ascending: false })
          .order('payment_date', { ascending: false, nullsFirst: false }),
        supabase
          .from('fee_structure')
          .select('id, name')
          .eq('school_id', user!.schoolId),
      ])

      if (paymentsRes.error) throw paymentsRes.error

      const feeNames = new Map<string, string>()
      for (const f of (fsRes.data ?? []) as AnyRow[]) {
        feeNames.set(f.id as string, f.name as string)
      }

      return ((paymentsRes.data ?? []) as AnyRow[]).map(r => {
        const amtDue  = Number(r.amount_due)  || 0
        const amtPaid = Number(r.amount_paid) || 0
        const balance = Math.max(0, amtDue - amtPaid)
        const fsId    = r.fee_structure_id as string | null
        return {
          id:            r.id as string,
          termLabel:     `Term ${r.term}`,
          feeName:       fsId ? (feeNames.get(fsId) ?? 'Fee Payment') : 'Fee Payment',
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
// Returns the last 30 school events visible to parents, ordered by event_date DESC.
export type SchoolNotice = {
  id:        string
  title:     string
  body:      string | null
  link:      null
  createdAt: string
  eventType: string | null
}

export function useSchoolNotices() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['school-notices', user?.schoolId],
    enabled:  !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_events')
        .select('id, title, description, event_date, event_type')
        .eq('school_id',          user!.schoolId)
        .eq('visible_to_parents', true)
        .order('event_date', { ascending: false })
        .limit(30)

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        id:        r.id as string,
        title:     (r.title as string) ?? '',
        body:      (r.description as string) ?? null,
        link:      null,
        createdAt: r.event_date as string,
        eventType: (r.event_type as string) ?? null,
      } satisfies SchoolNotice))
    },
  })
}

// ── useFindBursar ─────────────────────────────────────────────
// Finds the school bursar's auth user id, name.
export type BursarInfo = {
  authUserId: string
  firstName:  string
  lastName:   string
}

export function useFindBursar() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['find-bursar', user?.schoolId],
    enabled:  !!user?.schoolId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('auth_user_id, first_name, last_name')
        .eq('school_id', user!.schoolId)
        .eq('role',      'bursar')
        .not('auth_user_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const r = data as AnyRow
      return {
        authUserId: r.auth_user_id as string,
        firstName:  r.first_name as string,
        lastName:   r.last_name as string,
      } satisfies BursarInfo
    },
  })
}

// ── Message type ──────────────────────────────────────────────
export type PortalMessage = {
  id:         string
  fromUserId: string
  toUserId:   string
  body:       string
  sentAt:     string
}

// ── useParentMessagesWithBursar ───────────────────────────────
// Fetches messages between the current parent and the school bursar.
export function useParentMessagesWithBursar(bursarAuthUserId: string | null | undefined) {
  const { user } = useAuth()
  const me      = user?.id ?? ''
  const bursar  = bursarAuthUserId ?? ''

  return useQuery({
    queryKey: ['parent-bursar-messages', user?.schoolId, me, bursar],
    enabled:  !!user?.schoolId && !!me && !!bursar,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, from_user_id, to_user_id, body, sent_at')
        .eq('school_id', user!.schoolId)
        .eq('is_announcement', false)
        .or(`and(from_user_id.eq.${me},to_user_id.eq.${bursar}),and(from_user_id.eq.${bursar},to_user_id.eq.${me})`)
        .order('sent_at', { ascending: true })

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        id:         r.id as string,
        fromUserId: r.from_user_id as string,
        toUserId:   r.to_user_id as string,
        body:       r.body as string,
        sentAt:     r.sent_at as string,
      } satisfies PortalMessage))
    },
  })
}

// ── useSendMessageToBursar ────────────────────────────────────
export function useSendMessageToBursar() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ bursarAuthUserId, body }: { bursarAuthUserId: string; body: string }) => {
      const { error } = await supabase
        .from('messages')
        .insert({
          school_id:      user!.schoolId,
          from_user_id:   user!.id,
          to_user_id:     bursarAuthUserId,
          body,
          is_announcement: false,
        })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-bursar-messages', user?.schoolId, user?.id] })
    },
  })
}

// ── useFindClassTeacher ───────────────────────────────────────
// Finds the class teacher for a student's class (stream class_teacher_id first,
// then staff with class in their classes array).
export type StaffContact = {
  authUserId: string
  firstName:  string
  lastName:   string
  role:       string
}

export function useFindClassTeacher(classId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['find-class-teacher', user?.schoolId, classId],
    enabled:  !!user?.schoolId && !!classId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Try streams first for a class_teacher_id link
      const { data: streamData } = await supabase
        .from('streams')
        .select('class_teacher_id')
        .eq('school_id', user!.schoolId)
        .eq('class_id',  classId!)
        .not('class_teacher_id', 'is', null)
        .limit(1)
        .maybeSingle()

      const teacherStaffId = (streamData as AnyRow | null)?.class_teacher_id as string | null

      if (teacherStaffId) {
        const { data } = await supabase
          .from('staff')
          .select('auth_user_id, first_name, last_name, role')
          .eq('id', teacherStaffId)
          .not('auth_user_id', 'is', null)
          .maybeSingle()
        if (data) {
          const r = data as AnyRow
          return { authUserId: r.auth_user_id as string, firstName: r.first_name as string, lastName: r.last_name as string, role: 'class_teacher' } satisfies StaffContact
        }
      }

      // Fallback: staff with this class in their classes array and role class_teacher
      const { data: fallback } = await supabase
        .from('staff')
        .select('auth_user_id, first_name, last_name, role')
        .eq('school_id', user!.schoolId)
        .eq('role', 'class_teacher')
        .contains('classes', [classId!])
        .not('auth_user_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (!fallback) return null
      const r = fallback as AnyRow
      return { authUserId: r.auth_user_id as string, firstName: r.first_name as string, lastName: r.last_name as string, role: 'class_teacher' } satisfies StaffContact
    },
  })
}

// ── useParentMessagesWithContact ──────────────────────────────
// Messages between the parent and ONE specific contact (bursar or teacher).
export function useParentMessagesWithContact(contactAuthUserId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-contact-messages', user?.schoolId, user?.id, contactAuthUserId],
    enabled:  !!user?.schoolId && !!user?.id && !!contactAuthUserId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const me      = user!.id
      const contact = contactAuthUserId!
      const { data, error } = await supabase
        .from('messages')
        .select('id, from_user_id, to_user_id, body, sent_at')
        .eq('school_id', user!.schoolId)
        .eq('is_announcement', false)
        .or(`and(from_user_id.eq.${me},to_user_id.eq.${contact}),and(from_user_id.eq.${contact},to_user_id.eq.${me})`)
        .order('sent_at', { ascending: true })
      if (error) throw error
      return ((data ?? []) as AnyRow[]).map(r => ({
        id:         r.id as string,
        fromUserId: r.from_user_id as string,
        toUserId:   r.to_user_id as string,
        body:       r.body as string,
        sentAt:     r.sent_at as string,
      } satisfies PortalMessage))
    },
  })
}

// ── useSendMessageToContact ───────────────────────────────────
export function useSendMessageToContact() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactAuthUserId, body }: { contactAuthUserId: string; body: string }) => {
      const { error } = await supabase
        .from('messages')
        .insert({
          school_id:       user!.schoolId,
          from_user_id:    user!.id,
          to_user_id:      contactAuthUserId,
          body,
          is_announcement: false,
        })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['parent-contact-messages', user?.schoolId, user?.id, vars.contactAuthUserId] })
    },
  })
}

// ── useParentTeacherRemarks ───────────────────────────────────
// Teacher remarks saved for a specific student — visible to parents.
export type ParentRemark = {
  id:          string
  teacherName: string
  term:        string
  year:        number
  remarks:     string
  createdAt:   string
}

export function useParentTeacherRemarks(studentId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-teacher-remarks', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_remarks')
        .select('id, teacher_id, term, year, remarks, created_at')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .order('year',       { ascending: false })
        .order('term',       { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error

      const rows = (data ?? []) as AnyRow[]
      if (rows.length === 0) return []

      // Resolve teacher names
      const teacherIds = [...new Set(rows.map(r => r.teacher_id as string).filter(Boolean))]
      const { data: staffRows } = await supabase
        .from('staff')
        .select('auth_user_id, id, first_name, last_name')
        .eq('school_id', user!.schoolId)
        .or(teacherIds.map(id => `auth_user_id.eq.${id},id.eq.${id}`).join(','))

      const teacherMap = new Map<string, string>()
      for (const s of (staffRows ?? []) as AnyRow[]) {
        const name = `${s.first_name} ${s.last_name}`
        if (s.auth_user_id) teacherMap.set(s.auth_user_id as string, name)
        if (s.id) teacherMap.set(s.id as string, name)
      }

      return rows.map(r => ({
        id:          r.id as string,
        teacherName: teacherMap.get(r.teacher_id as string) ?? 'Teacher',
        term:        r.term as string,
        year:        r.year as number,
        remarks:     r.remarks as string,
        createdAt:   r.created_at as string,
      } satisfies ParentRemark))
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
        const needsLink  = !currentIds.includes(student.id)

        // Add this student to the existing account if not already there
        if (needsLink) {
          await supabase
            .from('parent_accounts')
            .update({ student_ids: [...currentIds, student.id] })
            .eq('id', existing.id as string)
            .eq('school_id', user!.schoolId)
        }

        // Always sync auth claims so the JWT has up-to-date student_ids.
        // Use stored temp_password (no credential change if they already have an account).
        const password = (existing.temp_password as string) || TEMP_PASSWORD
        await supabase.functions.invoke('create-parent-auth-user', {
          body: {
            parentAccountId: existing.id as string,
            email:           loginEmail,
            schoolId:        user!.schoolId,
            password,
          },
        }).catch(() => { /* Edge Function not deployed — auth_user_id stays null */ })

        return {
          email:        loginEmail,
          tempPassword: password,
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
          created_by:    user!.staffId ?? user!.id,
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
