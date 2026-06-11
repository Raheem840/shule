import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { DisciplineRecord, DisciplineNature, TimetablePeriod } from '../types/week9'
import type { AttendanceSummary } from '../types/app'

// ── useDeputyOverview ──────────────────────────────────────────────────────
// Returns per-class attendance summaries. Flags any class below 80%.
export function useDeputyOverview() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['deputy-overview', user?.schoolId],
    enabled: !!user,
    queryFn: async () => {
      const sid = user!.schoolId

      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
      const [classesRes, attendanceRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name, level')
          .eq('school_id', sid),
        supabase
          .from('attendance')
          .select('class_id, student_id, status')
          .eq('school_id', sid)
          .gte('date', yearStart),
      ])

      if (classesRes.error) throw new Error(classesRes.error.message)

      const classes    = classesRes.data ?? []
      const attendance = attendanceRes.data ?? []

      // Per-class attendance rates
      const classStats = classes.map((cls: any) => {
        const rows = attendance.filter((a: any) => a.class_id === cls.id)
        const total   = rows.length
        const present = rows.filter((a: any) => a.status === 'present' || a.status === 'late').length
        const rate    = total > 0 ? Math.round((present / total) * 100) : 0
        return {
          classId:       cls.id as string,
          className:     cls.name as string,
          level:         cls.level as string | null,
          attendanceRate: rate,
          isBelowThreshold: rate < 80 && total > 0,
        }
      })

      return classStats
    },
    staleTime: 5 * 60_000,
  })
}

// ── useDeputyKpis ──────────────────────────────────────────────────────────
// KPI counts for the Deputy dashboard.
export function useDeputyKpis() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['deputy-kpis', user?.schoolId],
    enabled: !!user,
    queryFn: async () => {
      const sid = user!.schoolId

      const [disciplineRes, streamsRes, attendanceRes] = await Promise.all([
        supabase
          .from('discipline_records')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', sid),
        supabase
          .from('streams')
          .select('class_teacher_id')
          .eq('school_id', sid)
          .not('class_teacher_id', 'is', null),
        supabase
          .from('attendance')
          .select('student_id, status')
          .eq('school_id', sid)
          .gte('date', new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)),
      ])

      const studentMap = new Map<string, { present: number; total: number }>()
      for (const row of attendanceRes.data ?? []) {
        const sId = row.student_id as string
        if (!studentMap.has(sId)) studentMap.set(sId, { present: 0, total: 0 })
        const c = studentMap.get(sId)!
        c.total++
        if (row.status === 'present' || row.status === 'late') c.present++
      }

      let below80 = 0
      for (const [, c] of studentMap) {
        if (c.total > 0 && c.present / c.total < 0.8) below80++
      }

      const classTeachers = new Set<string>()
      for (const s of streamsRes.data ?? []) {
        if (s.class_teacher_id) classTeachers.add(s.class_teacher_id as string)
      }

      return {
        disciplineIncidents: disciplineRes.count ?? 0,
        studentsBelowThreshold: below80,
        activeClassTeachers: classTeachers.size,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useRecentDiscipline ────────────────────────────────────────────────────
// Last 5 discipline records with student name, for the dashboard panel.
export function useRecentDiscipline() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['recent-discipline', user?.schoolId],
    enabled: !!user,
    queryFn: async () => {
      const sid = user!.schoolId

      const { data, error } = await supabase
        .from('discipline_records')
        .select('id, student_id, incident_date, nature, resolution')
        .eq('school_id', sid)
        .order('incident_date', { ascending: false })
        .limit(5)

      if (error) throw new Error(error.message)
      const rows = data ?? []

      const studentIds = [...new Set(rows.map((r: any) => r.student_id as string))]
      let nameMap = new Map<string, string>()
      if (studentIds.length > 0) {
        const { data: stus } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', studentIds)
        for (const s of stus ?? []) nameMap.set(s.id, `${s.first_name} ${s.last_name}`)
      }

      return rows.map((r: any) => ({
        id:           r.id as string,
        studentId:    r.student_id as string,
        studentName:  nameMap.get(r.student_id as string) ?? '—',
        incidentDate: r.incident_date as string,
        nature:       r.nature as DisciplineNature,
        resolution:   r.resolution as string,
      }))
    },
    staleTime: 60_000,
  })
}

// ── useDisciplineRecords ───────────────────────────────────────────────────
// Fetches all discipline records for the school, with student/class name join.
export function useDisciplineRecords(filters?: {
  classId?: string
  studentId?: string
  nature?: DisciplineNature
}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['discipline-records', user?.schoolId, filters],
    enabled: !!user,
    queryFn: async () => {
      const sid = user!.schoolId

      let q = supabase
        .from('discipline_records')
        .select(
          'id, school_id, student_id, class_id, incident_date,' +
          ' nature, resolution, notes, recorded_by, created_at'
        )
        .eq('school_id', sid)
        .order('incident_date', { ascending: false })

      if (filters?.classId)   q = q.eq('class_id', filters.classId)
      if (filters?.studentId) q = q.eq('student_id', filters.studentId)
      if (filters?.nature)    q = q.eq('nature', filters.nature)

      const [{ data, error }, classRes] = await Promise.all([
        q,
        supabase.from('classes').select('id, name').eq('school_id', sid),
      ])

      if (error) throw new Error(error.message)
      const rows = data ?? []

      const classMap = new Map<string, string>((classRes.data ?? []).map((c: any) => [c.id, c.name]))

      const studentIds = [...new Set(rows.map((r: any) => r.student_id as string))]
      let nameMap = new Map<string, string>()
      if (studentIds.length > 0) {
        const { data: stus } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', studentIds)
        for (const s of stus ?? []) nameMap.set(s.id, `${s.first_name} ${s.last_name}`)
      }

      return rows.map((r: any) => ({
        id:           r.id,
        schoolId:     r.school_id,
        studentId:    r.student_id,
        classId:      r.class_id,
        incidentDate: r.incident_date,
        nature:       r.nature as DisciplineNature,
        resolution:   r.resolution,
        notes:        r.notes,
        recordedBy:   r.recorded_by,
        createdAt:    r.created_at,
        studentName:  nameMap.get(r.student_id as string) ?? undefined,
        className:    r.class_id ? classMap.get(r.class_id as string) ?? undefined : undefined,
      } satisfies DisciplineRecord))
    },
    staleTime: 60_000,
  })
}

// ── useAddDisciplineRecord ─────────────────────────────────────────────────
export function useAddDisciplineRecord() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      studentId: string
      classId: string | null
      incidentDate: string
      nature: DisciplineNature
      resolution: string
      notes: string | null
    }) => {
      if (!user) throw new Error('Not authenticated')

      let staffId = user.staffId
      if (!staffId) {
        const { data: s } = await supabase
          .from('staff').select('id')
          .eq('auth_user_id', user.id).eq('school_id', user.schoolId).maybeSingle()
        staffId = (s as any)?.id
      }

      const { error } = await supabase
        .from('discipline_records')
        .insert({
          school_id:     user.schoolId,
          student_id:    input.studentId,
          class_id:      input.classId,
          incident_date: input.incidentDate,
          nature:        input.nature,
          resolution:    input.resolution,
          notes:         input.notes,
          recorded_by:   staffId ?? user.id,
        })

      if (error) throw new Error(error.message)

      // ── Notify parents ────────────────────────────────────────────────────
      // Find all parent accounts linked to this student
      const { data: parents } = await supabase
        .from('parent_accounts')
        .select('auth_user_id')
        .eq('school_id', user.schoolId)
        .contains('student_ids', [input.studentId])

      const parentIds = ((parents ?? []) as Array<{ auth_user_id: string | null }>)
        .map(p => p.auth_user_id)
        .filter((id): id is string => id != null)

      if (parentIds.length > 0) {
        const notifBody = `A disciplinary record has been filed for your child regarding: ${input.nature}. Please contact the school for details.`
        const msgBody   = `Dear Parent/Guardian, a disciplinary record has been filed for your child on ${input.incidentDate}. Nature: ${input.nature}. Resolution: ${input.resolution || 'Pending'}. Please visit the school or reply to this message for clarification.`
        const now = new Date().toISOString()

        // Insert notifications (fire-and-forget — does not block the mutation)
        void supabase.from('notifications').insert(
          parentIds.map(uid => ({
            school_id: user.schoolId,
            user_id:   uid,
            type:      'general',
            title:     'Disciplinary Notice',
            body:      notifBody,
            link:      '/parent',
            from_user: user.id,
          }))
        )

        // Insert messages (one per parent)
        void supabase.from('messages').insert(
          parentIds.map(uid => ({
            school_id:    user.schoolId,
            from_user_id: user.id,
            to_user_id:   uid,
            body:         msgBody,
            sent_at:      now,
          }))
        )
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discipline-records', user?.schoolId] })
    },
  })
}

// ── useUpdateDisciplineRecord ──────────────────────────────────────────────
export function useUpdateDisciplineRecord() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      incidentDate: string
      nature: DisciplineNature
      resolution: string
      notes: string | null
    }) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('discipline_records')
        .update({
          incident_date: input.incidentDate,
          nature:        input.nature,
          resolution:    input.resolution,
          notes:         input.notes,
        })
        .eq('id', input.id)
        .eq('school_id', user.schoolId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discipline-records', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['recent-discipline', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['deputy-kpis', user?.schoolId] })
    },
  })
}

// ── useDeleteDisciplineRecord ──────────────────────────────────────────────
export function useDeleteDisciplineRecord() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('discipline_records')
        .delete()
        .eq('id', id)
        .eq('school_id', user.schoolId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discipline-records', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['recent-discipline', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['deputy-kpis', user?.schoolId] })
    },
  })
}

// ── useTimetable ───────────────────────────────────────────────────────────
// Returns timetable periods for the school (optionally filtered by class).
export function useTimetable(classId?: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['timetable', user?.schoolId, classId],
    enabled: !!user,
    queryFn: async (): Promise<TimetablePeriod[]> => {
      let q = supabase
        .from('timetable_slots')
        .select(
          'id, school_id, class_id, stream_id, subject_id, teacher_id,' +
          ' day_of_week, period_number, start_time, end_time, term, year, is_published'
        )
        .eq('school_id', user!.schoolId)
        .order('day_of_week', { ascending: true })
        .order('period_number', { ascending: true })

      if (classId) q = q.eq('class_id', classId)

      const { data, error } = await q
      if (error?.code === '42P01') return []
      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any) => ({
        id:           r.id,
        schoolId:     r.school_id,
        classId:      r.class_id,
        subjectId:    r.subject_id,
        teacherId:    r.teacher_id,
        dayOfWeek:    r.day_of_week as 1 | 2 | 3 | 4 | 5,
        periodNumber: r.period_number,
        startTime:    r.start_time,
        endTime:      r.end_time,
        term:         r.term,
        year:         r.year,
      }))
    },
    staleTime: 10 * 60_000,
  })
}

// ── useClassAttendanceSummaries ────────────────────────────────────────────
// Per-student attendance summaries for a class — used for deputy's attendance panel.
export function useClassAttendanceSummaries(classId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['class-attendance-summaries', user?.schoolId, classId],
    enabled: !!user && !!classId,
    queryFn: async (): Promise<AttendanceSummary[]> => {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', user!.schoolId)
        .eq('class_id', classId!)

      if (error) throw new Error(error.message)

      // Group by student
      const studentMap = new Map<string, { p: number; a: number; l: number; e: number }>()
      for (const row of (data ?? [])) {
        const s = row.student_id as string
        if (!studentMap.has(s)) studentMap.set(s, { p: 0, a: 0, l: 0, e: 0 })
        const c = studentMap.get(s)!
        if (row.status === 'present')       c.p++
        else if (row.status === 'absent')   c.a++
        else if (row.status === 'late')     c.l++
        else if (row.status === 'excused')  c.e++
      }

      return [...studentMap.entries()].map(([studentId, c]) => {
        const total = c.p + c.a + c.l + c.e
        const rate  = total > 0 ? Math.round(((c.p + c.l) / total) * 100) : 0
        return {
          studentId,
          totalDays:        total,
          presentDays:      c.p,
          absentDays:       c.a,
          lateDays:         c.l,
          excusedDays:      c.e,
          rate,
          isBelowThreshold: rate < 80 && total > 0,
        }
      })
    },
    staleTime: 60_000,
  })
}
