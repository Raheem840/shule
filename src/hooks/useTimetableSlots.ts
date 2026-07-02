import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { TimetableSlot } from '../types/week9'

// ── useTimetableSlots ──────────────────────────────────────────────────────
// Fetches from timetable_slots table with optional filters.
// Resolves subject + teacher names via joins.
export function useTimetableSlots(params: {
  classId?: string | null
  streamId?: string | null
  term?: string | null
  year?: number | null
  published?: boolean  // if true, only published slots
}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['timetable-slots', user?.schoolId, params.classId, params.streamId, params.term, params.year, params.published ?? false],
    enabled: !!user?.schoolId,
    queryFn: async (): Promise<TimetableSlot[]> => {
      const sid = user!.schoolId
      let q = supabase
        .from('timetable_slots')
        .select(
          'id, school_id, class_id, stream_id, subject_id, teacher_id,' +
          ' day_of_week, period_number, start_time, end_time, term, year, is_published'
        )
        .eq('school_id', sid)
        .order('day_of_week', { ascending: true })
        .order('period_number', { ascending: true })

      if (params.classId)  q = q.eq('class_id', params.classId)
      if (params.streamId) q = q.eq('stream_id', params.streamId)
      if (params.term)     q = q.eq('term', params.term)
      if (params.year)     q = q.eq('year', params.year)
      if (params.published) q = q.eq('is_published', true)

      const { data, error } = await q
      if (error?.code === '42P01') return []
      if (error) throw new Error(error.message)

      const slots = (data ?? []).map((r: any) => ({
        id:           r.id,
        schoolId:     r.school_id,
        classId:      r.class_id,
        streamId:     r.stream_id,
        subjectId:    r.subject_id,
        teacherId:    r.teacher_id,
        dayOfWeek:    r.day_of_week as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        periodNumber: r.period_number,
        startTime:    r.start_time,
        endTime:      r.end_time,
        term:         r.term,
        year:         r.year,
        isPublished:  r.is_published,
      } satisfies TimetableSlot))

      // Resolve names in bulk
      const subjectIds = [...new Set(slots.map(s => s.subjectId))]
      const teacherIds = [...new Set(slots.map(s => s.teacherId))]

      const [subjectsRes, teachersRes] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name').eq('school_id', sid).in('id', subjectIds)
          : { data: [], error: null },
        teacherIds.length > 0
          ? supabase.from('staff').select('id, first_name, last_name').eq('school_id', sid).in('id', teacherIds)
          : { data: [], error: null },
      ])

      const subjectMap = new Map<string, string>(
        (subjectsRes.data ?? []).map((s: any) => [s.id, s.name])
      )
      const teacherMap = new Map<string, string>(
        (teachersRes.data ?? []).map((t: any) => [t.id, `${t.first_name} ${t.last_name}`])
      )

      return slots.map(s => ({
        ...s,
        subjectName: subjectMap.get(s.subjectId),
        teacherName: teacherMap.get(s.teacherId),
      }))
    },
    staleTime: 5 * 60_000,
  })
}

// ── useTeacherTimetable ────────────────────────────────────────────────────
// Returns only the slots assigned to the current user (teacher/class_teacher).
export function useTeacherTimetable(params: {
  term?: string | null
  year?: number | null
}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['teacher-timetable', user?.schoolId, user?.id, params],
    enabled: !!user,
    queryFn: async (): Promise<TimetableSlot[]> => {
      const sid = user!.schoolId

      // Find this user's staff row to get staffId
      const { data: staffRow, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', sid)
        .eq('auth_user_id', user!.id)
        .maybeSingle()

      if (staffErr || !staffRow) return []

      let q = supabase
        .from('timetable_slots')
        .select(
          'id, school_id, class_id, stream_id, subject_id, teacher_id,' +
          ' day_of_week, period_number, start_time, end_time, term, year, is_published'
        )
        .eq('school_id', sid)
        .eq('teacher_id', staffRow.id)
        .eq('is_published', true)
        .order('day_of_week')
        .order('period_number')

      if (params.term)  q = q.eq('term', params.term)
      if (params.year)  q = q.eq('year', params.year)

      const { data, error } = await q
      if (error?.code === '42P01') return []
      if (error) throw new Error(error.message)

      const slots = (data ?? []).map((r: any) => ({
        id:           r.id,
        schoolId:     r.school_id,
        classId:      r.class_id,
        streamId:     r.stream_id,
        subjectId:    r.subject_id,
        teacherId:    r.teacher_id,
        dayOfWeek:    r.day_of_week as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        periodNumber: r.period_number,
        startTime:    r.start_time,
        endTime:      r.end_time,
        term:         r.term,
        year:         r.year,
        isPublished:  r.is_published,
      } satisfies TimetableSlot))

      // Resolve subject + class names
      const subjectIds = [...new Set(slots.map(s => s.subjectId))]
      const classIds   = [...new Set(slots.map(s => s.classId))]

      const [subjectsRes, classesRes] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name').eq('school_id', sid).in('id', subjectIds)
          : { data: [], error: null },
        classIds.length > 0
          ? supabase.from('classes').select('id, name').eq('school_id', sid).in('id', classIds)
          : { data: [], error: null },
      ])

      const subjectMap = new Map<string, string>(
        (subjectsRes.data ?? []).map((s: any) => [s.id, s.name])
      )
      const classMap = new Map<string, string>(
        (classesRes.data ?? []).map((c: any) => [c.id, c.name])
      )

      return slots.map(s => ({
        ...s,
        subjectName: subjectMap.get(s.subjectId),
        className:   classMap.get(s.classId),
      }))
    },
    staleTime: 5 * 60_000,
  })
}

// ── useCheckCollision ──────────────────────────────────────────────────────
// Returns existing slots that would conflict with the given parameters.
// A conflict is:
//   - Same class + stream + day + period (class already booked)
//   - Same teacher + day + period (teacher double-booked)
export function useCheckCollision() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (params: {
      classId: string
      streamId: string | null
      teacherId: string
      dayOfWeek: number
      periodNumber: number
      term: string
      year: number
      excludeSlotId?: string  // for editing an existing slot
    }): Promise<{ classConflict: TimetableSlot | null; teacherConflict: TimetableSlot | null }> => {
      if (!user) throw new Error('Not authenticated')
      const sid = user!.schoolId
      const { classId, streamId, teacherId, dayOfWeek, periodNumber, term, year, excludeSlotId } = params

      let classQ = supabase
        .from('timetable_slots')
        .select('id, class_id, stream_id, teacher_id, subject_id, day_of_week, period_number, term, year, is_published')
        .eq('school_id', sid)
        .eq('class_id', classId)
        .eq('day_of_week', dayOfWeek)
        .eq('period_number', periodNumber)
        .eq('term', term)
        .eq('year', year)

      // Scope class conflict to the same stream so S4A doesn't block S4B
      if (streamId) {
        classQ = classQ.eq('stream_id', streamId)
      } else {
        classQ = classQ.is('stream_id', null)
      }

      const [classRes, teacherRes] = await Promise.all([
        classQ,
        supabase
          .from('timetable_slots')
          .select('id, class_id, stream_id, teacher_id, subject_id, day_of_week, period_number, term, year, is_published')
          .eq('school_id', sid)
          .eq('teacher_id', teacherId)
          .eq('day_of_week', dayOfWeek)
          .eq('period_number', periodNumber)
          .eq('term', term)
          .eq('year', year),
      ])

      const toSlot = (r: any): TimetableSlot => ({
        id: r.id, schoolId: sid, classId: r.class_id, streamId: r.stream_id,
        subjectId: r.subject_id, teacherId: r.teacher_id,
        dayOfWeek: r.day_of_week, periodNumber: r.period_number,
        startTime: null, endTime: null, term: r.term, year: r.year,
        isPublished: r.is_published,
      })

      if (classRes.error?.code === '42P01' || teacherRes.error?.code === '42P01') {
        return { classConflict: null, teacherConflict: null }
      }

      const classHits   = (classRes.data ?? []).filter((r: any) => r.id !== excludeSlotId)
      const teacherHits = (teacherRes.data ?? []).filter((r: any) => r.id !== excludeSlotId)

      return {
        classConflict:   classHits.length   > 0 ? toSlot(classHits[0])   : null,
        teacherConflict: teacherHits.length > 0 ? toSlot(teacherHits[0]) : null,
      }
    },
  })
}

// ── useCreateTimetableSlot ─────────────────────────────────────────────────
export function useCreateTimetableSlot() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      classId: string
      streamId: string | null
      subjectId: string
      teacherId: string
      dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7
      periodNumber: number
      startTime?: string | null
      endTime?: string | null
      term: string
      year: number
    }) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('timetable_slots')
        .upsert({
          school_id:     user.schoolId,
          class_id:      input.classId,
          stream_id:     input.streamId,
          subject_id:    input.subjectId,
          teacher_id:    input.teacherId,
          day_of_week:   input.dayOfWeek,
          period_number: input.periodNumber,
          start_time:    input.startTime ?? null,
          end_time:      input.endTime ?? null,
          term:          input.term,
          year:          input.year,
          is_published:  false,
        }, {
          onConflict: 'school_id,class_id,stream_id,day_of_week,period_number,term,year',
        })

      if (error?.code === '42P01') return  // table not yet created
      if (error?.code === '23505' && error.message.includes('teacher_no_double_booking')) {
        // Belt-and-braces DB constraint — the UI's useCheckCollision should
        // normally catch this first, but a race between two concurrent
        // sessions can still hit it here.
        throw new Error('This teacher is already scheduled for another class at that day/period.')
      }
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['timetable-slots', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['teacher-timetable', user?.schoolId] })
    },
  })
}

// ── useDeleteTimetableSlot ─────────────────────────────────────────────────
export function useDeleteTimetableSlot() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (slotId: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('id', slotId)
        .eq('school_id', user.schoolId)
      if (error?.code === '42P01') return  // table not yet created
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['timetable-slots', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['teacher-timetable', user?.schoolId] })
    },
  })
}

// ── usePublishTimetable ────────────────────────────────────────────────────
// Marks all slots for a class/stream/term/year as published.
// streamId: null means "slots with no stream" (class has no streams);
// pass a specific UUID to publish only that stream's slots.
export function usePublishTimetable() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      classId: string
      streamId?: string | null
      term: string
      year: number
    }) => {
      if (!user) throw new Error('Not authenticated')
      let q = supabase
        .from('timetable_slots')
        .update({ is_published: true })
        .eq('school_id', user.schoolId)
        .eq('class_id', params.classId)
        .eq('term', params.term)
        .eq('year', params.year)

      if (params.streamId) {
        q = q.eq('stream_id', params.streamId)
      } else {
        q = q.is('stream_id', null)
      }

      const { error } = await q
      if (error?.code === '42P01') return  // table not yet created
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['timetable-slots', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['teacher-timetable', user?.schoolId] })
    },
  })
}
