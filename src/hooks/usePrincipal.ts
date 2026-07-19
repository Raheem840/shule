import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type {
  PrincipalKpis, TopClass, FeeSummary, AuditEntry, StaffFullProfile,
} from '../types/week9'

// ── usePrincipalKpis ───────────────────────────────────────────────────────
export function usePrincipalKpis() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['principal-kpis', user?.schoolId],
    enabled: !!user && user?.role === 'principal',
    queryFn: async (): Promise<PrincipalKpis> => {
      const sid = user!.schoolId
      const today = new Date().toISOString().slice(0, 10)
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekStartStr = weekStart.toISOString().slice(0, 10)

      // Fetch active year first — used to scope fee_payments and exam_journal
      const activeYearRes = await supabase
        .from('academic_years').select('id').eq('school_id', sid).eq('is_active', true).maybeSingle()
      if (activeYearRes.error) throw activeYearRes.error
      const activeYearId = activeYearRes.data?.id ?? null

      let feeQ = supabase.from('fee_payments').select('amount_paid, amount_due').eq('school_id', sid)
      if (activeYearId) feeQ = feeQ.eq('academic_year_id', activeYearId)

      // exam_journal scoped by academic_year_id (exam records store calendar year, not academic year
      // start year — using the FK is the only reliable cross-year-boundary filter)
      const journalQ = activeYearId
        ? supabase.from('exam_journal').select('id, pass_mark').eq('school_id', sid).eq('academic_year_id', activeYearId)
        : Promise.resolve({ data: [] as any[], error: null })

      const [studentsRes, staffRes, journalsRes, paymentsRes,
             attendanceRes, reportCardsRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'active'),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('is_active', true),
        journalQ,
        activeYearId ? feeQ : Promise.resolve({ data: [] as any[], error: null }),
        supabase.from('attendance').select('status, date').eq('school_id', sid)
          .gte('date', weekStartStr).lte('date', today),
        supabase.from('report_cards').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'ready'),
      ])
      if (studentsRes.error)    throw studentsRes.error
      if (staffRes.error)       throw staffRes.error
      if (journalsRes.error)    throw journalsRes.error
      if (paymentsRes.error)    throw paymentsRes.error
      if (attendanceRes.error)  throw attendanceRes.error
      if (reportCardsRes.error) throw reportCardsRes.error

      // Pass rate — exam_results filtered by journal IDs so scoping follows academic_year_id
      const journals    = journalsRes.data ?? []
      const passMarkMap = new Map<string, number>(journals.map((j: any) => [j.id, j.pass_mark]))
      const journalIds  = journals.map((j: any) => j.id as string)
      let overallPassRate: number | null = null
      if (journalIds.length > 0) {
        const resultsRes = await supabase
          .from('exam_results').select('score, exam_journal_id').eq('school_id', sid)
          .in('exam_journal_id', journalIds).limit(50000)
        if (resultsRes.error) throw resultsRes.error
        const graded = (resultsRes.data ?? []).filter((r: any) => r.score != null)
        const passed = graded.filter((r: any) => r.score >= (passMarkMap.get(r.exam_journal_id) ?? 50))
        if (graded.length > 0) overallPassRate = Math.round((passed.length / graded.length) * 100)
      }

      // Fee collection rate — server-side filtered to active year; null (not 0)
      // when there's no active year or no fee_payments rows at all yet, so a
      // newly onboarded school with no data isn't shown a false "0% collected,
      // crisis" tile — matches overallPassRate's null = "no data" convention.
      const feePayments = paymentsRes.data ?? []
      const totalExpected  = feePayments.reduce((s: number, r: any) => s + (r.amount_due  ?? 0), 0)
      const totalCollected = feePayments.reduce((s: number, r: any) => s + (r.amount_paid ?? 0), 0)
      const feeCollectionRate = (!activeYearId || feePayments.length === 0)
        ? null
        : (totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0)

      // Attendance this week
      const attRows = attendanceRes.data ?? []
      const attTotal   = attRows.length
      const attPresent = attRows.filter((r: any) => r.status === 'present' || r.status === 'late').length
      const attendanceRateThisWeek = attTotal > 0
        ? Math.round((attPresent / attTotal) * 100) : 0

      return {
        totalStudents:           studentsRes.count ?? 0,
        totalStaff:              staffRes.count ?? 0,
        overallPassRate,
        feeCollectionRate,
        attendanceRateThisWeek,
        pendingReportCards:      reportCardsRes.count ?? 0,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useTopClasses ──────────────────────────────────────────────────────────
export function useTopClasses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['top-classes', user?.schoolId],
    enabled: !!user && user.role === 'principal',
    queryFn: async (): Promise<TopClass[]> => {
      const sid = user!.schoolId

      // Use academic_year_id (same pattern as usePrincipalKpis) — calendar year
      // is unreliable across term/year boundaries (e.g. Term 1 exams stored in
      // year=2025 are missed if getFullYear() returns 2026 in January).
      const activeYearRes = await supabase
        .from('academic_years').select('id').eq('school_id', sid).eq('is_active', true).maybeSingle()
      if (activeYearRes.error) throw activeYearRes.error
      const activeYearId = activeYearRes.data?.id ?? null

      const journalQ = activeYearId
        ? supabase.from('exam_journal').select('id, pass_mark, class_id').eq('school_id', sid).eq('academic_year_id', activeYearId)
        : Promise.resolve({ data: [] as any[], error: null })

      const [classesRes, studentsRes, journalsRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', sid),
        supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active').limit(50000),
        journalQ,
      ])
      if (classesRes.error) throw classesRes.error
      if (studentsRes.error) throw studentsRes.error
      if (journalsRes.error) throw journalsRes.error

      const classes   = classesRes.data  ?? []
      const students  = studentsRes.data ?? []
      const journals  = journalsRes.data ?? []

      const passMarkMap = new Map<string, number>(journals.map((j: any) => [j.id, j.pass_mark ?? 50]))
      const journalIds  = journals.map((j: any) => j.id as string)

      // No journals in the active year → no pass-rate data yet
      if (journalIds.length === 0) return []

      const resultsRes = await supabase
        .from('exam_results').select('student_id, score, exam_journal_id')
        .eq('school_id', sid).in('exam_journal_id', journalIds).limit(50000)
      if (resultsRes.error) throw resultsRes.error
      const results = resultsRes.data ?? []

      return classes.map((cls: any) => {
        const classStudentIds = new Set(
          students.filter((s: any) => s.class_id === cls.id).map((s: any) => s.id)
        )
        const classResults = results.filter((r: any) =>
          classStudentIds.has(r.student_id) && r.score != null
        )
        const classPassed = classResults.filter((r: any) =>
          r.score >= (passMarkMap.get(r.exam_journal_id) ?? 50)
        )
        return {
          classId:      cls.id,
          className:    cls.name,
          passRate:     classResults.length > 0 ? Math.round((classPassed.length / classResults.length) * 100) : null,
          studentCount: classStudentIds.size,
        } satisfies TopClass
      })
        .sort((a, b) => (b.passRate ?? -1) - (a.passRate ?? -1))
        .slice(0, 5)
    },
    staleTime: 10 * 60_000,
  })
}

// ── useSchoolFeeSummary ────────────────────────────────────────────────────
// term is optional — PrincipalDashboard wants a whole-year summary, but
// PrincipalAnalyticsPage's Finance tab has its own term filter that this
// previously ignored entirely, leaving the KPI cards frozen on the same
// all-terms numbers no matter what term was selected (while the "Fees by
// Class" chart below, driven by useFeeCollectionByClass, filtered correctly).
export function useSchoolFeeSummary(term?: number | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['fee-summary', user?.schoolId, term ?? null],
    enabled: !!user && ['bursar', 'principal'].includes(user?.role ?? ''),
    queryFn: async (): Promise<FeeSummary> => {
      const sid = user!.schoolId

      const { data: activeYear } = await supabase
        .from('academic_years').select('id').eq('school_id', sid).eq('is_active', true).maybeSingle()

      let feeQ = supabase
        .from('fee_payments')
        .select('amount_paid, amount_due, balance')
        .eq('school_id', sid)
      if (activeYear?.id) feeQ = feeQ.eq('academic_year_id', activeYear.id)
      if (term != null)   feeQ = feeQ.eq('term', term)

      const { data: payments } = await feeQ
      const rows = payments ?? []
      const totalCollected = rows.reduce((s: number, r: any) => s + (r.amount_paid ?? 0), 0)
      const totalExpected  = rows.reduce((s: number, r: any) => s + (r.amount_due  ?? 0), 0)
      const outstanding    = rows.reduce((s: number, r: any) => s + Math.max(0, Number(r.balance) || 0), 0)
      const overdueCount   = rows.filter((r: any) => (r.balance ?? 0) > 0).length

      return {
        totalExpected,
        totalCollected,
        outstanding,
        overdueCount,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useAuditLog ────────────────────────────────────────────────────────────
export function useAuditLog(params?: {
  limit?: number
  role?: string
  action?: string
  dateFrom?: string
  dateTo?: string
}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['audit-log', user?.schoolId, params],
    enabled: !!user && user.role === 'principal',
    queryFn: async (): Promise<AuditEntry[]> => {
      let q = supabase
        .from('audit_log')
        .select('id, action, table_name, entity_name, user_id, role, old_value, new_value, created_at')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false })
        .limit(params?.limit ?? 50)

      if (params?.role)     q = q.eq('role', params.role)
      if (params?.action)   q = q.eq('action', params.action)
      if (params?.dateFrom) q = q.gte('created_at', params.dateFrom)
      // Append end-of-day so the "To" date is inclusive — otherwise Postgres
      // casts the plain date to midnight and silently drops every entry
      // recorded later that same day (matches useMessageLog's existing fix).
      if (params?.dateTo)   q = q.lte('created_at', params.dateTo + 'T23:59:59')

      const { data, error } = await q

      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') return []
        throw new Error(error.message)
      }

      return (data ?? []).map((r: any) => ({
        id:         r.id,
        action:     r.action,
        tableName:  r.table_name,
        entityName: r.entity_name ?? null,
        userId:     r.user_id,
        userRole:   r.role,
        oldData:    r.old_value,
        newData:    r.new_value,
        createdAt:  r.created_at,
      } satisfies AuditEntry))
    },
    staleTime: 60_000,
  })
}

// ── useStudentFullProfile ──────────────────────────────────────────────────
export function useStudentFullProfile(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-full-profile', user?.schoolId, studentId],
    enabled: !!user && !!studentId,
    queryFn: async () => {
      const sid = user!.schoolId

      const [studentRes, resultsRes, publishedJournalsRes, attendanceRes, disciplineRes, disciplineCountRes, feeRes] = await Promise.all([
        supabase
          .from('students')
          .select(
            'id, first_name, last_name, admission_number, dob, gender, status,' +
            ' class_id, stream_id, photo_url, nationality, religion, medical_notes,' +
            ' student_type, previous_school, enrolled_at'
          )
          .eq('school_id', sid)
          .eq('id', studentId!)
          .maybeSingle(),
        supabase
          .from('exam_results')
          .select('subject_id, score, grade, term, year, exam_journal_id')
          .eq('school_id', sid)
          .eq('student_id', studentId!)
          .order('year', { ascending: false })
          .order('term', { ascending: false }),
        supabase
          .from('exam_journal')
          .select('id')
          .eq('school_id', sid)
          .eq('status', 'published'),
        supabase
          .from('attendance')
          .select('status')
          .eq('school_id', sid)
          .eq('student_id', studentId!),
        supabase
          .from('discipline_records')
          .select('id, incident_date, nature, resolution')
          .eq('school_id', sid)
          .eq('student_id', studentId!)
          .order('incident_date', { ascending: false })
          .limit(10),
        // Separate exact-count query — the row above is capped at 10 for the
        // preview list, so using its .length as "the total" undercounted any
        // student with more than 10 discipline records.
        supabase
          .from('discipline_records')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', sid)
          .eq('student_id', studentId!),
        supabase
          .from('fee_payments')
          .select('amount_paid, amount_due')
          .eq('school_id', sid)
          .eq('student_id', studentId!),
      ])

      if (studentRes.error) throw new Error(studentRes.error.message)
      if (!studentRes.data) throw new Error('Student not found.')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stu = studentRes.data as any
      const att = attendanceRes.data ?? []
      const totalDays    = att.length
      const presentDays  = att.filter((a: any) => a.status === 'present' || a.status === 'late').length
      const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

      // Resolve class + stream names in parallel
      const [classRes, streamRes] = await Promise.all([
        stu.class_id
          ? supabase.from('classes').select('name').eq('id', stu.class_id).eq('school_id', sid).maybeSingle()
          : Promise.resolve({ data: null }),
        stu.stream_id
          ? supabase.from('streams').select('name').eq('id', stu.stream_id).eq('school_id', sid).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      const className  = (classRes as any).data?.name  ?? ''
      const streamName = (streamRes as any).data?.name ?? ''

      // Filter exam results to published journals only
      const publishedIds = new Set((publishedJournalsRes.data ?? []).map((j: any) => j.id as string))
      const rawResults = (resultsRes.data ?? []).filter((r: any) => publishedIds.has(r.exam_journal_id))
      const subjectIds = [...new Set(rawResults.map((r: any) => r.subject_id).filter(Boolean))]
      let subjectMap: Record<string, string> = {}
      if (subjectIds.length > 0) {
        const { data: subs } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('school_id', sid)
          .in('id', subjectIds as string[])
        subjectMap = Object.fromEntries((subs ?? []).map((s: any) => [s.id, s.name]))
      }

      const payments = (feeRes.data ?? []) as any[]
      const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0)
      const totalDue  = payments.reduce((s: number, p: any) => s + (p.amount_due  ?? 0), 0)

      return {
        id:              stu.id,
        firstName:       stu.first_name,
        lastName:        stu.last_name,
        admissionNumber: stu.admission_number,
        dob:             stu.dob,
        gender:          stu.gender,
        status:          stu.status,
        photoUrl:        stu.photo_url,
        nationality:     stu.nationality,
        religion:        stu.religion,
        medicalNotes:    stu.medical_notes,
        studentType:     stu.student_type,
        previousSchool:  stu.previous_school,
        enrolledAt:      stu.enrolled_at,
        className,
        streamName,
        attendanceRate,
        totalDays,
        presentDays,
        disciplineCount:  disciplineCountRes.count ?? 0,
        recentDiscipline: disciplineRes.data ?? [],
        examResults: rawResults.map((r: any) => ({
          ...r,
          subjectName: subjectMap[r.subject_id] ?? '—',
        })),
        feeSummary: { totalPaid, totalDue },
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useStaffFullProfile ────────────────────────────────────────────────────
export function useStaffFullProfile(staffId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['staff-full-profile', user?.schoolId, staffId],
    enabled: !!user && !!staffId,
    queryFn: async (): Promise<StaffFullProfile> => {
      const { data, error } = await supabase
        .from('staff')
        .select(
          'id, auth_user_id, first_name, last_name, role, email, phone,' +
          ' department_id, qualification_level, employment_type,' +
          ' staff_number, photo_url, is_active, join_date'
        )
        .eq('school_id', user!.schoolId)
        .eq('id', staffId!)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) throw new Error('Staff member not found.')

      const d = data as any
      return {
        id:                 d.id,
        authUserId:         d.auth_user_id,
        firstName:          d.first_name,
        lastName:           d.last_name,
        role:               d.role,
        email:              d.email,
        phone:              d.phone,
        departmentId:       d.department_id,
        qualificationLevel: d.qualification_level,
        employmentType:     d.employment_type,
        staffNumber:        d.staff_number,
        photoUrl:           d.photo_url,
        isActive:           d.is_active,
        joinDate:           d.join_date,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useSuspendStudent ──────────────────────────────────────────────────────
// Suspend/expel authority belongs to the Deputy — the Principal is read-only here.
export function useSuspendStudent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: 'active' | 'suspended' | 'expelled' }) => {
      if (!user) throw new Error('Not authenticated')
      if (user.role !== 'deputy') throw new Error('Forbidden')

      // Fetch auth_user_id before updating status
      const { data: stu } = await supabase
        .from('students')
        .select('auth_user_id')
        .eq('id', studentId)
        .eq('school_id', user.schoolId)
        .maybeSingle()

      const { error } = await supabase
        .from('students')
        .update({ status })
        .eq('id', studentId)
        .eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)

      // Disable/enable the auth account in Supabase
      if (stu?.auth_user_id) {
        await supabase.functions.invoke('set-user-disabled', {
          body: { authUserId: stu.auth_user_id, disabled: status !== 'active' },
        })
      }
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['student-full-profile', user?.schoolId, vars.studentId] })
      void qc.invalidateQueries({ queryKey: ['principal-kpis', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['my-student-record', vars.studentId] })
      void qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
    },
  })
}

// ── useSuspendStaff ────────────────────────────────────────────────────────
export function useSuspendStaff() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, isActive }: { staffId: string; isActive: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      if (user.role !== 'principal') throw new Error('Forbidden')

      // Fetch auth_user_id before updating status
      const { data: stf } = await supabase
        .from('staff')
        .select('auth_user_id')
        .eq('id', staffId)
        .eq('school_id', user.schoolId)
        .maybeSingle()

      const { error } = await supabase
        .from('staff')
        .update({ is_active: isActive })
        .eq('id', staffId)
        .eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)

      // Disable/enable the auth account so a suspended staff member's existing
      // session is actually revoked, not just left to expire naturally.
      if (stf?.auth_user_id) {
        await supabase.functions.invoke('set-user-disabled', {
          body: { authUserId: stf.auth_user_id, disabled: !isActive },
        })
      }
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['staff-full-profile', user?.schoolId, vars.staffId] })
      void qc.invalidateQueries({ queryKey: ['principal-kpis',    user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['user-management',   user?.schoolId] })
      // Also invalidate the staff-directory list/single-record keys used by
      // useStaff() — PrincipalStaffPage's directory now uses this mutation
      // (in place of the removed, buggy useSetStaffActive) and needs its
      // grid to refresh immediately, not just the full-profile view.
      void qc.invalidateQueries({ queryKey: ['staff',        user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['staff-member', user?.schoolId, vars.staffId] })
    },
  })
}

// ── useAllClassPerformance ─────────────────────────────────────────────────
// All classes with pass rate, avg score, student count — sorted alphabetically.
// Scoped to the active academic year (same pattern as usePrincipalKpis).
export function useAllClassPerformance() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['class-performance', user?.schoolId],
    enabled:  !!user && user.role === 'principal',
    queryFn: async () => {
      const sid = user!.schoolId

      const activeYearRes = await supabase
        .from('academic_years').select('id').eq('school_id', sid).eq('is_active', true).maybeSingle()
      if (activeYearRes.error) throw activeYearRes.error
      const activeYearId = activeYearRes.data?.id ?? null

      const journalQ = activeYearId
        ? supabase.from('exam_journal').select('id, pass_mark, total_marks, assessment_type').eq('school_id', sid).eq('academic_year_id', activeYearId)
        : Promise.resolve({ data: [] as any[], error: null })

      const [classesRes, studentsRes, journalsRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', sid),
        supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active').limit(50000),
        journalQ,
      ])
      if (classesRes.error) throw classesRes.error
      if (studentsRes.error) throw studentsRes.error
      if (journalsRes.error) throw journalsRes.error

      const classes  = classesRes.data  ?? []
      const students = studentsRes.data ?? []
      const journals = journalsRes.data ?? []

      const passMarkMap = new Map<string, number>(journals.map((j: any) => [j.id, j.pass_mark ?? 50]))
      const journalMetaMap = new Map<string, { totalMarks: number; isCA: boolean }>(
        journals.map((j: any) => [j.id, { totalMarks: j.total_marks as number, isCA: j.assessment_type === 'ca' }])
      )
      const journalIds  = journals.map((j: any) => j.id as string)

      let results: any[] = []
      if (journalIds.length > 0) {
        const resultsRes = await supabase
          .from('exam_results').select('student_id, score, exam_journal_id')
          .eq('school_id', sid).in('exam_journal_id', journalIds).limit(50000)
        if (resultsRes.error) throw resultsRes.error
        results = resultsRes.data ?? []
      }

      // CA journals score 0-3 per competency, not out of total_marks —
      // averaging a raw CA score next to an 80/100-scale score drags the
      // class average toward zero. Convert to a percentage before averaging;
      // pass/fail vs. that journal's own pass_mark stays on the raw scale.
      const toPct = (r: any): number => {
        const meta = journalMetaMap.get(r.exam_journal_id as string)
        const denom = meta?.isCA ? 3 : (meta?.totalMarks || 100)
        return (Number(r.score) / denom) * 100
      }

      return classes.map((cls: any) => {
        const classStudentIds = new Set(
          students.filter((s: any) => s.class_id === cls.id).map((s: any) => s.id)
        )
        const classResults = results.filter((r: any) =>
          classStudentIds.has(r.student_id) && r.score != null
        )
        const passed   = classResults.filter((r: any) => r.score >= (passMarkMap.get(r.exam_journal_id) ?? 50))
        const avgScore = classResults.length > 0
          ? Math.round(classResults.reduce((s: number, r: any) => s + toPct(r), 0) / classResults.length)
          : null

        return {
          classId:      cls.id as string,
          className:    cls.name as string,
          passRate:     classResults.length > 0 ? Math.round((passed.length / classResults.length) * 100) : null as number | null,
          avgScore:     avgScore as number | null,
          studentCount: classStudentIds.size,
          resultCount:  classResults.length,
        }
      }).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }))
    },
    staleTime: 10 * 60_000,
  })
}

// ── useAttendanceByClass ───────────────────────────────────────────────────
// Attendance rate per class over the last 30 days.
export function useAttendanceByClass() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance-by-class', user?.schoolId],
    enabled:  !!user && user.role === 'principal',
    queryFn: async () => {
      const sid  = user!.schoolId
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const sinceStr = since.toISOString().slice(0, 10)

      const [classesRes, attRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', sid),
        supabase.from('attendance').select('class_id, status')
          .eq('school_id', sid).gte('date', sinceStr),
      ])

      const classes = classesRes.data ?? []
      const att     = attRes.data     ?? []

      const countMap = new Map<string, { present: number; total: number }>()
      for (const row of att as any[]) {
        if (!row.class_id) continue
        const cur = countMap.get(row.class_id) ?? { present: 0, total: 0 }
        cur.total++
        if (row.status === 'present' || row.status === 'late') cur.present++
        countMap.set(row.class_id, cur)
      }

      return classes
        .map((cls: any) => {
          const c = countMap.get(cls.id)
          return {
            classId:   cls.id as string,
            className: cls.name as string,
            rate:      c && c.total > 0 ? Math.round((c.present / c.total) * 100) : null as number | null,
            present:   c?.present ?? 0,
            total:     c?.total   ?? 0,
          }
        })
        .filter(c => c.total > 0)
        .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }))
    },
    staleTime: 5 * 60_000,
  })
}

// ── useGenderEnrollment ────────────────────────────────────────────────────
export function useGenderEnrollment() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['gender-enrollment', user?.schoolId],
    enabled:  !!user && user.role === 'principal',
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('gender')
        .eq('school_id', user!.schoolId)
        .eq('status', 'active')

      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as any[]) {
        const g = (row.gender as string | null) ?? 'unknown'
        counts[g] = (counts[g] ?? 0) + 1
      }
      return Object.entries(counts).map(([gender, count]) => ({
        gender: gender.charAt(0).toUpperCase() + gender.slice(1),
        count,
      }))
    },
    staleTime: 10 * 60_000,
  })
}

// ── useStaffRoleBreakdown ──────────────────────────────────────────────────
export function useStaffRoleBreakdown() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['staff-role-breakdown', user?.schoolId],
    enabled:  !!user && user.role === 'principal',
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('role')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)

      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as any[]) {
        const r = (row.role as string) ?? 'unknown'
        counts[r] = (counts[r] ?? 0) + 1
      }
      return Object.entries(counts).map(([role, count]) => ({ role, count }))
    },
    staleTime: 10 * 60_000,
  })
}

// ── useMonthlyDiscipline ───────────────────────────────────────────────────
// Discipline incident count for the last 6 calendar months.
export function useMonthlyDiscipline() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['monthly-discipline', user?.schoolId],
    enabled:  !!user && user.role === 'principal',
    queryFn: async () => {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)

      const { data } = await supabase
        .from('discipline_records')
        .select('incident_date')
        .eq('school_id', user!.schoolId)
        .gte('incident_date', sixMonthsAgo.toISOString().slice(0, 10))

      // Build 6 month buckets
      const months: { label: string; isoKey: string }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push({
          label:  d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
          isoKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        })
      }

      const buckets: Record<string, number> = Object.fromEntries(months.map(m => [m.isoKey, 0]))
      for (const row of (data ?? []) as any[]) {
        const key = (row.incident_date as string)?.slice(0, 7)
        if (key && key in buckets) buckets[key]++
      }

      return months.map(m => ({ month: m.label, count: buckets[m.isoKey] }))
    },
    staleTime: 5 * 60_000,
  })
}

