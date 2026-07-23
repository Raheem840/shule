import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calcFeeStatus } from './useFeePayments'
import { generateTempPassword } from '../lib/passwords'
import { getFunctionErrorMessage } from '../lib/functionsError'
import { logPasswordResetWithReason } from '../lib/passwordResetAudit'
import type { Student } from '../types/app'

type AnyRow = Record<string, unknown>

// ── useParentPortalRealtime ───────────────────────────────────
// Mirrors useStudentPortalRealtime's channel/.on()/invalidate pattern so a
// bursar payment, a newly-published mark, or a released report card shows up
// for parents without a manual refresh. Scoped to ALL of the parent's linked
// children (studentIds), not just the currently selected one, since a parent
// with two children shouldn't have to switch tabs to see the other child's update.
export function useParentPortalRealtime(studentIds: string[]) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = studentIds.slice().sort().join(',')

  useEffect(() => {
    if (!user || user.role !== 'parent' || studentIds.length === 0) return
    const idSet = new Set(studentIds)

    const channel = supabase
      .channel(`parent-portal:${user.schoolId}:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (!row || !idSet.has(row.student_id as string)) return
          void qc.invalidateQueries({ queryKey: ['parent-fee-balance', user.schoolId, row.student_id] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_results', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (!row || !idSet.has(row.student_id as string)) return
          void qc.invalidateQueries({ queryKey: ['parent-exam-summary', user.schoolId, row.student_id] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cards', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (!row || !idSet.has(row.student_id as string)) return
          void qc.invalidateQueries({ queryKey: ['parent-report-cards', user.schoolId, row.student_id] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (!row || !idSet.has(row.student_id as string)) return
          void qc.invalidateQueries({ queryKey: ['attendance-summary', user.schoolId, row.student_id] })
          void qc.invalidateQueries({ queryKey: ['attendance-history', user.schoolId, row.student_id] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_remarks', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (!row || !idSet.has(row.student_id as string)) return
          void qc.invalidateQueries({ queryKey: ['parent-teacher-remarks', user.schoolId, row.student_id] })
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as AnyRow | undefined
          if (!row || !idSet.has(row.id as string)) return
          void qc.invalidateQueries({ queryKey: ['parent-students', user.schoolId] })
        })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key, qc])
}

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

// ── useOwnedStudentIds ─────────────────────────────────────────
// The single source of truth for "which student IDs does this parent
// legitimately own." Primary source: student_ids JWT claim. Fallback: query
// parent_accounts directly if the JWT claim is empty (happens when the
// account was linked to a child after the current JWT was issued). Every
// student-scoped hook's ownership guard uses this — checking the raw JWT
// claim directly (as this file used to) would incorrectly reject a
// legitimately-owned student whenever the JWT is stale, since useParentStudents
// itself already falls back in that exact case.
export function useOwnedStudentIds() {
  const { user } = useAuth()
  const jwtStudentIds = user?.studentIds ?? []

  // Fallback query — only fires when JWT has no student_ids.
  // Kept separate so it can't block the main loading indicator forever.
  const { data: fallbackIds = [], isLoading } = useQuery({
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

  return {
    ids:       jwtStudentIds.length > 0 ? jwtStudentIds : fallbackIds,
    isLoading: jwtStudentIds.length === 0 && isLoading,
  }
}

// ── useParentStudents ─────────────────────────────────────────
// Fetches all students linked to the parent's account.
export function useParentStudents() {
  const { user } = useAuth()
  const { ids: effectiveIds, isLoading: idsLoading } = useOwnedStudentIds()

  const studentsQuery = useQuery({
    queryKey: ['parent-students', user?.schoolId, effectiveIds],
    enabled:  user?.role === 'parent' && !!user?.schoolId && effectiveIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, admission_number, first_name, last_name, dob, gender, class_id, stream_id, photo_url, status, enrolled_at, student_type, nationality, religion, medical_notes, previous_school, auth_user_id')
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
  const { ids: ownedIds, isLoading: idsLoading } = useOwnedStudentIds()

  return useQuery({
    queryKey: ['parent-report-cards', user?.schoolId, studentId],
    enabled:  user?.role === 'parent' && !!studentId && !!user?.schoolId && !idsLoading,
    queryFn: async () => {
      if (studentId && !ownedIds.includes(studentId)) {
        throw new Error('Forbidden')
      }
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
  const { ids: ownedIds, isLoading: idsLoading } = useOwnedStudentIds()

  return useQuery({
    queryKey: ['parent-exam-summary', user?.schoolId, studentId],
    enabled:  user?.role === 'parent' && !!studentId && !!user?.schoolId && !idsLoading,
    queryFn: async () => {
      if (studentId && !ownedIds.includes(studentId)) {
        throw new Error('Forbidden')
      }
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

      return (data as AnyRow[])
        .filter(r => journalMap.has(r.exam_journal_id as string))
        .map(r => {
          const j = journalMap.get(r.exam_journal_id as string)!
          return {
            subjectName:    subjectMap.get(j.subject_id as string) ?? '—',
            assessmentType: (j.assessment_type as string) ?? '—',
            journalName:    (j.name as string) ?? '—',
            score:          (r.score as number) ?? null,
            grade:          (r.grade as string) ?? null,
            totalMarks:     (j.total_marks as number) ?? 0,
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
  const { ids: ownedIds, isLoading: idsLoading } = useOwnedStudentIds()

  return useQuery({
    queryKey: ['parent-fee-balance', user?.schoolId, studentId],
    enabled:  user?.role === 'parent' && !!studentId && !!user?.schoolId && !idsLoading,
    queryFn: async () => {
      if (user?.role !== 'parent') throw new Error('Forbidden')
      // Checks ownedIds (JWT studentIds, falling back to a live parent_accounts
      // lookup when the JWT is stale) — not the raw JWT claim alone, since a
      // parent linked to a child after their JWT was issued would otherwise
      // be wrongly rejected for a student they legitimately own.
      if (studentId && !ownedIds.includes(studentId)) {
        throw new Error('Forbidden')
      }
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
        const balance = Math.max(0, r.balance != null ? Number(r.balance) : (amtDue - amtPaid))
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


// ── StaffContact ───────────────────────────────────────────────
export type StaffContact = {
  authUserId:    string
  firstName:     string
  lastName:      string
  role:          string
  contextLabel?: string
}

// ── useClassTeachersForClasses ────────────────────────────────
// Resolves the class teacher for one or more classIds — stream
// class_teacher_id first, then staff with the class in their classes[]
// array. Batches all of a parent's children's classIds into one query pair
// instead of calling a hook per-child (which would require calling a hook
// inside a loop/map).
export function useClassTeachersForClasses(classIds: (string | null | undefined)[]) {
  const { user } = useAuth()
  const ids = [...new Set(classIds.filter((id): id is string => !!id))]
  const key = ids.slice().sort().join(',')

  return useQuery({
    queryKey: ['class-teachers-for-classes', user?.schoolId, key],
    enabled:  !!user?.schoolId && ids.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const map = new Map<string, StaffContact>()

      const { data: streamRows } = await supabase
        .from('streams')
        .select('class_id, class_teacher_id')
        .eq('school_id', user!.schoolId)
        .in('class_id', ids)
        .not('class_teacher_id', 'is', null)

      const teacherIdByClass = new Map<string, string>()
      for (const s of (streamRows ?? []) as AnyRow[]) {
        const cid = s.class_id as string
        if (!teacherIdByClass.has(cid)) teacherIdByClass.set(cid, s.class_teacher_id as string)
      }

      const staffIds = [...new Set(teacherIdByClass.values())]
      const staffByStaffId = new Map<string, AnyRow>()
      if (staffIds.length > 0) {
        const { data: staffRows } = await supabase
          .from('staff')
          .select('id, auth_user_id, first_name, last_name')
          .eq('school_id', user!.schoolId)
          .in('id', staffIds)
          .not('auth_user_id', 'is', null)
        for (const s of (staffRows ?? []) as AnyRow[]) staffByStaffId.set(s.id as string, s)
      }

      for (const [cid, staffId] of teacherIdByClass) {
        const s = staffByStaffId.get(staffId)
        if (s) {
          map.set(cid, {
            authUserId: s.auth_user_id as string,
            firstName:  s.first_name as string,
            lastName:   s.last_name as string,
            role:       'class_teacher',
          })
        }
      }

      // Fallback: staff with role class_teacher and this class in their classes[] array
      const remaining = ids.filter(id => !map.has(id))
      if (remaining.length > 0) {
        const { data: fallbackStaff } = await supabase
          .from('staff')
          .select('auth_user_id, first_name, last_name, classes')
          .eq('school_id', user!.schoolId)
          .eq('role', 'class_teacher')
          .not('auth_user_id', 'is', null)
          .overlaps('classes', remaining)

        for (const cid of remaining) {
          const match = ((fallbackStaff ?? []) as AnyRow[]).find(s => ((s.classes as string[]) ?? []).includes(cid))
          if (match) {
            map.set(cid, {
              authUserId: match.auth_user_id as string,
              firstName:  match.first_name as string,
              lastName:   match.last_name as string,
              role:       'class_teacher',
            })
          }
        }
      }

      return map
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
  const { ids: ownedIds, isLoading: idsLoading } = useOwnedStudentIds()

  return useQuery({
    queryKey: ['parent-teacher-remarks', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId && !idsLoading,
    queryFn: async () => {
      if (studentId && !ownedIds.includes(studentId)) {
        throw new Error('Not your child')
      }
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
    enabled:  !!user?.schoolId && ['secretary', 'principal', 'it_admin', 'bursar'].includes(user?.role ?? ''),
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
      if (!user) throw new Error('Not authenticated')
      if (!['secretary', 'principal', 'it_admin'].includes(user.role ?? '')) throw new Error('Forbidden')
      // ── 1. School short name for fallback email ──────────────
      const { data: school } = await supabase
        .from('school_profile')
        .select('short_name')
        .eq('id', user!.schoolId)
        .single()

      const shortName = ((school?.short_name as string) ?? 'school')
        .toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')

      const TEMP_PASSWORD = generateTempPassword()

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

        // Add this student to the existing account if not already there.
        // This alone is enough for the parent portal to pick up the new
        // child — custom_access_token_hook derives the JWT's student_ids
        // claim LIVE from this column on every token issuance (see
        // 20260607000001_hook_student_ids.sql), and useOwnedStudentIds()
        // falls back to querying this table directly whenever the JWT is
        // stale — so no auth-side "claims sync" call is actually needed.
        if (needsLink) {
          await supabase
            .from('parent_accounts')
            .update({ student_ids: [...currentIds, student.id] })
            .eq('id', existing.id as string)
            .eq('school_id', user!.schoolId)
        }

        const isActivated   = !!(existing.auth_user_id)
        const knownPassword = (existing.temp_password as string) || null

        if (!isActivated) {
          // Auth account was never created for this parent — create it now.
          const password = knownPassword || TEMP_PASSWORD
          const { error: fnError, data: fnData } = await supabase.functions.invoke('create-parent-auth-user', {
            body: {
              parentAccountId: existing.id as string,
              email:           loginEmail,
              schoolId:        user!.schoolId,
              password,
            },
          })
          if (fnError) {
            const detail = (fnData as { error?: string } | null)?.error ?? fnError.message
            throw new Error(`Failed to activate parent login: ${detail}`)
          }
          return { email: loginEmail, tempPassword: password, isNew: false, guardianName: guardianName ?? null }
        }

        // Already activated — do NOT call create-parent-auth-user here. That
        // edge function always resets the live Auth password to whatever is
        // passed, and if this parent self-reset via "Forgot password" (DB
        // temp_password is null in that case — see sync-self-password-reset),
        // this used to silently overwrite their real password with a brand
        // new one they were never shown, the next time any sibling got
        // linked. Return the last KNOWN password (StudentsPage.tsx already
        // handles the "no password to show, use Reset" case identically to
        // any other already-activated account).
        return {
          email:        loginEmail,
          tempPassword: knownPassword ?? '',
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
      const { error: fnError, data: fnData } = await supabase.functions.invoke('create-parent-auth-user', {
        body: {
          parentAccountId: (newAccount as AnyRow).id as string,
          email:           loginEmail,
          schoolId:        user!.schoolId,
          password:        TEMP_PASSWORD,
        },
      })
      if (fnError) {
        const detail = (fnData as { error?: string } | null)?.error ?? fnError.message
        throw new Error(`Failed to activate parent login: ${detail}`)
      }

      return {
        email:        loginEmail,
        tempPassword: TEMP_PASSWORD,
        isNew:        true,
        guardianName: guardianName ?? null,
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-accounts', user?.schoolId] })
    },
  })
}

// ── useResetParentPassword ────────────────────────────────────
// Actually rotates the parent's password (unlike useGenerateParentAccess's
// existing-account path, which just returns whatever password was last
// stored) — used when a Secretary/Principal/IT Admin needs to hand a parent
// a new password because the old one is no longer known (never persisted
// for re-display once the credentials modal is closed, by design). Requires
// a reason, which is recorded to audit_log and sent to every IT Admin.
export function useResetParentPassword() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      parentAccountId: string
      authUserId:      string
      email:           string
      guardianName:    string
      reason:          string
    }): Promise<{ email: string; tempPassword: string }> => {
      if (!user) throw new Error('Not authenticated')
      if (!params.reason.trim()) throw new Error('A reason is required to reset this password')

      const tempPassword = generateTempPassword()

      const { error: fnError } = await supabase.functions.invoke('reset-parent-password', {
        body: { userId: params.authUserId, newPassword: tempPassword, schoolId: user.schoolId },
      })
      if (fnError) throw new Error(`Password reset failed: ${await getFunctionErrorMessage(fnError)}`)

      await logPasswordResetWithReason({
        schoolId:    user.schoolId,
        actorUserId: user.id,
        actorRole:   user.role,
        targetTable: 'parent_accounts',
        targetId:    params.parentAccountId,
        targetName:  params.guardianName || params.email,
        reason:      params.reason.trim(),
      })

      return { email: params.email, tempPassword }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-accounts', user?.schoolId] })
    },
  })
}

// ── useStudentGuardians ──────────────────────────────────────
// Fetch guardians for a specific student (used in ParentCredentialsPage)
export function useStudentGuardians(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-guardians', user?.schoolId, studentId],
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
