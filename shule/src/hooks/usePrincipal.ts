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
    enabled: !!user,
    queryFn: async (): Promise<PrincipalKpis> => {
      const sid = user!.schoolId
      const today = new Date().toISOString().slice(0, 10)
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekStartStr = weekStart.toISOString().slice(0, 10)

      const [studentsRes, staffRes, resultsRes, journalsRes, paymentsRes,
             feeStructureRes, attendanceRes, reportCardsRes] = await Promise.all([
        supabase.from('students').select('id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('staff').select('id').eq('school_id', sid).eq('is_active', true),
        supabase.from('exam_results').select('score, exam_journal_id').eq('school_id', sid),
        supabase.from('exam_journal').select('id, pass_mark').eq('school_id', sid),
        supabase.from('fee_payments').select('amount_paid').eq('school_id', sid),
        supabase.from('fee_structure').select('amount').eq('school_id', sid),
        supabase.from('attendance').select('status, date').eq('school_id', sid)
          .gte('date', weekStartStr).lte('date', today),
        supabase.from('report_cards').select('id').eq('school_id', sid).eq('status', 'ready'),
      ])

      // Pass rate
      const passMarkMap = new Map<string, number>(
        (journalsRes.data ?? []).map((j: any) => [j.id, j.pass_mark])
      )
      const graded = (resultsRes.data ?? []).filter((r: any) => r.score != null)
      const passed = graded.filter((r: any) => r.score >= (passMarkMap.get(r.exam_journal_id) ?? 50))
      const overallPassRate = graded.length > 0
        ? Math.round((passed.length / graded.length) * 100) : 0

      // Fee collection rate
      const totalExpected  = (feeStructureRes.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
      const totalCollected = (paymentsRes.data ?? []).reduce((s: number, r: any) => s + (r.amount_paid ?? 0), 0)
      const feeCollectionRate = totalExpected > 0
        ? Math.round((totalCollected / totalExpected) * 100) : 0

      // Attendance this week
      const attRows = attendanceRes.data ?? []
      const attTotal   = attRows.length
      const attPresent = attRows.filter((r: any) => r.status === 'present' || r.status === 'late').length
      const attendanceRateThisWeek = attTotal > 0
        ? Math.round((attPresent / attTotal) * 100) : 0

      return {
        totalStudents:           (studentsRes.data ?? []).length,
        totalStaff:              (staffRes.data ?? []).length,
        overallPassRate,
        feeCollectionRate,
        attendanceRateThisWeek,
        pendingReportCards:      (reportCardsRes.data ?? []).length,
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
    enabled: !!user,
    queryFn: async (): Promise<TopClass[]> => {
      const sid = user!.schoolId

      const [classesRes, studentsRes, resultsRes, journalsRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', sid),
        supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('exam_results').select('student_id, score, exam_journal_id').eq('school_id', sid),
        supabase.from('exam_journal').select('id, pass_mark, class_id').eq('school_id', sid),
      ])

      const classes   = classesRes.data ?? []
      const students  = studentsRes.data ?? []
      const results   = resultsRes.data ?? []
      const journals  = journalsRes.data ?? []

      const passMarkMap = new Map<string, number>(journals.map((j: any) => [j.id, j.pass_mark]))

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
          passRate:     classResults.length > 0 ? Math.round((classPassed.length / classResults.length) * 100) : 0,
          studentCount: classStudentIds.size,
        } satisfies TopClass
      })
        .sort((a, b) => b.passRate - a.passRate)
        .slice(0, 5)
    },
    staleTime: 10 * 60_000,
  })
}

// ── useSchoolFeeSummary ────────────────────────────────────────────────────
export function useSchoolFeeSummary() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['fee-summary', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<FeeSummary> => {
      const sid = user!.schoolId

      const [paymentsRes, structureRes] = await Promise.all([
        supabase.from('fee_payments').select('amount_paid, balance').eq('school_id', sid),
        supabase.from('fee_structure').select('amount').eq('school_id', sid),
      ])

      const totalCollected = (paymentsRes.data ?? []).reduce((s: number, r: any) => s + (r.amount_paid ?? 0), 0)
      const totalExpected  = (structureRes.data ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
      const overdueCount   = (paymentsRes.data ?? []).filter((r: any) => (r.balance ?? 0) > 0).length

      return {
        totalExpected,
        totalCollected,
        outstanding: Math.max(0, totalExpected - totalCollected),
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
    enabled: !!user,
    queryFn: async (): Promise<AuditEntry[]> => {
      let q = supabase
        .from('audit_log')
        .select('id, action, table_name, user_id, role, old_value, new_value, created_at')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false })
        .limit(params?.limit ?? 50)

      if (params?.role)     q = q.eq('role', params.role)
      if (params?.action)   q = q.eq('action', params.action)
      if (params?.dateFrom) q = q.gte('created_at', params.dateFrom)
      if (params?.dateTo)   q = q.lte('created_at', params.dateTo)

      const { data, error } = await q

      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') return []
        throw new Error(error.message)
      }

      return (data ?? []).map((r: any) => ({
        id:        r.id,
        action:    r.action,
        tableName: r.table_name,
        userId:    r.user_id,
        userRole:  r.role,
        oldData:   r.old_value,
        newData:   r.new_value,
        createdAt: r.created_at,
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

      const [studentRes, resultsRes, attendanceRes, disciplineRes, feeRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, first_name, last_name, admission_number, dob, gender, status, class_id, stream_id, photo_url')
          .eq('school_id', sid)
          .eq('id', studentId!)
          .single(),
        supabase
          .from('exam_results')
          .select('subject_id, score, grade, term, year, exam_journal_id')
          .eq('school_id', sid)
          .eq('student_id', studentId!),
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
        supabase
          .from('fee_payments')
          .select('amount_paid')
          .eq('school_id', sid)
          .eq('student_id', studentId!),
      ])

      if (studentRes.error) throw new Error(studentRes.error.message)

      const stu = studentRes.data
      const att = attendanceRes.data ?? []
      const totalDays    = att.length
      const presentDays  = att.filter((a: any) => a.status === 'present' || a.status === 'late').length
      const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

      let className = ''
      if (stu.class_id) {
        const { data: cls } = await supabase
          .from('classes').select('name').eq('id', stu.class_id).maybeSingle()
        className = cls?.name ?? ''
      }

      const payments = (feeRes.data ?? []) as any[]
      const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0)

      return {
        id:             stu.id,
        firstName:      stu.first_name,
        lastName:       stu.last_name,
        admissionNumber: stu.admission_number,
        dob:            stu.dob,
        gender:         stu.gender,
        status:         stu.status,
        photoUrl:       stu.photo_url,
        className,
        attendanceRate,
        totalDays,
        presentDays,
        disciplineCount: (disciplineRes.data ?? []).length,
        recentDiscipline: disciplineRes.data ?? [],
        examResults:    resultsRes.data ?? [],
        feeSummary: {
          totalPaid,
        },
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
          ' staff_number, photo_url, is_active, salary_band, join_date'
        )
        .eq('school_id', user!.schoolId)
        .eq('id', staffId!)
        .single()

      if (error) throw new Error(error.message)

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
        salaryBand:         d.salary_band,
        joinDate:           d.join_date,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useSuspendStudent ──────────────────────────────────────────────────────
export function useSuspendStudent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: 'active' | 'suspended' | 'expelled' }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('students')
        .update({ status })
        .eq('id', studentId)
        .eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['student-full-profile', user?.schoolId, vars.studentId] })
      void qc.invalidateQueries({ queryKey: ['principal-kpis'] })
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
      const { error } = await supabase
        .from('staff')
        .update({ is_active: isActive })
        .eq('id', staffId)
        .eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['staff-full-profile', user?.schoolId, vars.staffId] })
      void qc.invalidateQueries({ queryKey: ['principal-kpis'] })
      void qc.invalidateQueries({ queryKey: ['user-management'] })
    },
  })
}

// ── useUpdateSalaryBand ────────────────────────────────────────────────────
export function useUpdateSalaryBand() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, salaryBand }: { staffId: string; salaryBand: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('staff')
        .update({ salary_band: salaryBand })
        .eq('id', staffId)
        .eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['staff-full-profile', user?.schoolId, vars.staffId] })
    },
  })
}
