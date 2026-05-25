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

      const [classesRes, attendanceRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name, level')
          .eq('school_id', sid),
        supabase
          .from('attendance')
          .select('class_id, student_id, status')
          .eq('school_id', sid),
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

// ── useDisciplineRecords ───────────────────────────────────────────────────
// Fetches all discipline records for the school, with student name join.
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
      let q = supabase
        .from('discipline_records')
        .select(
          'id, school_id, student_id, class_id, incident_date,' +
          ' nature, resolution, notes, recorded_by, created_at'
        )
        .eq('school_id', user!.schoolId)
        .order('incident_date', { ascending: false })

      if (filters?.classId)   q = q.eq('class_id', filters.classId)
      if (filters?.studentId) q = q.eq('student_id', filters.studentId)
      if (filters?.nature)    q = q.eq('nature', filters.nature)

      const { data, error } = await q

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any) => ({
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
          recorded_by:   user.id,
        })

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discipline-records', user?.schoolId] })
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
        .from('timetable')
        .select(
          'id, school_id, class_id, subject_id, teacher_id,' +
          ' day_of_week, period_number, start_time, end_time, term, year'
        )
        .eq('school_id', user!.schoolId)
        .order('day_of_week', { ascending: true })
        .order('period_number', { ascending: true })

      if (classId) q = q.eq('class_id', classId)

      const { data, error } = await q
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
