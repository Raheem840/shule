import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { AttendanceStatus, AttendanceSummary } from '../types/app'

type AnyRow = Record<string, unknown>

// ── useAttendance ──────────────────────────────────────────────
// Returns Map<studentId, AttendanceStatus> for a class on a given date.
// RLS: teacher sees only their own class; principal/dos/deputy see all.
export function useAttendance(classId: string | null, date: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['attendance', user?.schoolId, classId, date],
    enabled:  !!classId && !!date && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', user!.schoolId)
        .eq('class_id',  classId!)
        .eq('date',      date)

      if (error) throw error

      const map = new Map<string, AttendanceStatus>()
      for (const r of (data ?? []) as AnyRow[]) {
        map.set(r.student_id as string, r.status as AttendanceStatus)
      }
      return map
    },
  })
}

// ── daysPerWeekForClass ────────────────────────────────────────
// S.4 (final O-level year) has 6 study days Mon-Sat.
// S.1, S.2, S.3 have 5 study days Mon-Fri.
export function daysPerWeekForClass(className: string): 5 | 6 {
  const n = className.toLowerCase().replace(/\s+/g, '').replace(/\./g, '').replace(/^senior/, 's').replace(/^form/, 's')
  return n.endsWith('4') ? 6 : 5
}

// ── useClassTermAttendance ─────────────────────────────────────
// Per-student attendance rates for a class for the current calendar year.
// Uses the set of unique dates the teacher took the roll as the expected-days
// denominator — more accurate than counting per-student records because it
// handles absences correctly (student not there = still a school day).
export type StudentAttendanceRate = {
  studentId:        string
  rate:             number
  isBelowThreshold: boolean
  totalDays:        number     // unique school days the teacher recorded roll
  presentDays:      number
  daysPerWeek:      5 | 6     // expected study days/week for this class level
}

export function useClassTermAttendance(classId: string | null, className?: string) {
  const { user } = useAuth()
  const dpw: 5 | 6 = className ? daysPerWeekForClass(className) : 5

  return useQuery({
    queryKey: ['attendance-class-term', user?.schoolId, classId],
    enabled:  !!classId && !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const yearStart = `${new Date().getFullYear()}-01-01`

      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status, date')
        .eq('school_id', user!.schoolId)
        .eq('class_id',  classId!)
        .gte('date',     yearStart)

      if (error) throw error

      const rows = (data ?? []) as AnyRow[]

      // Count unique dates the teacher took the roll for this class
      const uniqueDates = new Set(rows.map(r => r.date as string))
      const expectedDays = Math.max(uniqueDates.size, 1)

      // Per-student present count
      const present = new Map<string, number>()
      for (const r of rows) {
        const sid = r.student_id as string
        if (r.status === 'present') present.set(sid, (present.get(sid) ?? 0) + 1)
      }
      // All students who appear in any record
      const allStudents = new Set(rows.map(r => r.student_id as string))

      const result: StudentAttendanceRate[] = []
      for (const sid of allStudents) {
        const presentDays = present.get(sid) ?? 0
        const rate = Math.round((presentDays / expectedDays) * 100)
        result.push({
          studentId:        sid,
          rate,
          isBelowThreshold: rate < 80,
          totalDays:        expectedDays,
          presentDays,
          daysPerWeek:      dpw,
        })
      }
      return result
    },
  })
}

// ── useAttendanceSummary ──────────────────────────────────────
// Per-student summary for portals. Counts records for the current year.
export function useAttendanceSummary(studentId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['attendance-summary', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const yearStart = `${new Date().getFullYear()}-01-01`

      const { data, error } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('school_id', user!.schoolId)
        .eq('student_id', studentId!)
        .gte('date', yearStart)
        .order('date', { ascending: false })

      if (error) throw error

      const records = (data ?? []) as { date: string; status: string }[]
      const total   = records.length
      const present = records.filter(r => r.status === 'present').length
      const absent  = records.filter(r => r.status === 'absent').length
      const late    = records.filter(r => r.status === 'late').length
      const excused = records.filter(r => r.status === 'excused').length
      const rate    = total > 0 ? Math.round((present / total) * 100) : 0

      return {
        studentId:        studentId!,
        totalDays:        total,
        presentDays:      present,
        absentDays:       absent,
        lateDays:         late,
        excusedDays:      excused,
        rate,
        isBelowThreshold: rate < 80 && total > 0,
      } satisfies AttendanceSummary
    },
  })
}

// ── useStudentAttendanceHistory ──────────────────────────────
// Returns the last 90 days of individual attendance records for a student.
// Used in the portal attendance tab to show a day-by-day history.
export type AttendanceDay = {
  date:   string
  status: AttendanceStatus
}

export function useStudentAttendanceHistory(studentId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['attendance-history', user?.schoolId, studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 90)
      const from = cutoff.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('school_id',  user!.schoolId)
        .eq('student_id', studentId!)
        .gte('date', from)
        .order('date', { ascending: false })

      if (error) throw error

      return ((data ?? []) as AnyRow[]).map(r => ({
        date:   r.date as string,
        status: r.status as AttendanceStatus,
      } satisfies AttendanceDay))
    },
  })
}

// ── useSaveAttendance ─────────────────────────────────────────
export type AttendanceInput = {
  classId: string
  date:    string
  records: { studentId: string; status: AttendanceStatus }[]
}

export function useSaveAttendance() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: AttendanceInput) => {
      // Delete existing records for this class+date then re-insert.
      const { error: delErr } = await supabase
        .from('attendance')
        .delete()
        .eq('school_id', user!.schoolId)
        .eq('class_id',  input.classId)
        .eq('date',      input.date)

      if (delErr) throw delErr

      if (input.records.length === 0) return

      // recorded_by FK references staff.id — look up if staffId not in JWT yet
      let staffId = user!.staffId
      if (!staffId) {
        const { data: s } = await supabase
          .from('staff').select('id')
          .eq('auth_user_id', user!.id).eq('school_id', user!.schoolId).maybeSingle()
        staffId = (s as any)?.id
      }
      if (!staffId) throw new Error('Staff record not found for this user.')

      const { error: insErr } = await supabase
        .from('attendance')
        .insert(
          input.records.map(r => ({
            school_id:   user!.schoolId,
            student_id:  r.studentId,
            class_id:    input.classId,
            date:        input.date,
            status:      r.status,
            recorded_by: staffId!,
          }))
        )

      if (insErr) throw insErr
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['attendance',          user?.schoolId, input.classId, input.date] })
      qc.invalidateQueries({ queryKey: ['attendance-class-term', user?.schoolId, input.classId] })
      qc.invalidateQueries({ queryKey: ['attendance-summary',  user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['attendance-history',  user?.schoolId] })
    },
  })
}
