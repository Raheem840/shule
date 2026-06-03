import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { SchoolEvent } from '../types/week9'

const EVENT_SELECT =
  'id, school_id, title, event_date, event_type, description,' +
  ' subject_id, class_id, stream_id, total_marks, pass_mark,' +
  ' journaled, journal_id, created_by, term, year, created_at,' +
  ' subjects(name), classes(name), streams(name)'

// ── Mapper ─────────────────────────────────────────────────────────────────
function mapRow(r: any): SchoolEvent {
  return {
    id:          r.id,
    schoolId:    r.school_id,
    title:       r.title,
    eventDate:   r.event_date,
    eventType:   r.event_type ?? 'general',
    description: r.description,
    subjectId:   r.subject_id,
    subjectName: r.subjects?.name ?? null,
    classId:     r.class_id,
    className:   r.classes?.name ?? null,
    streamId:    r.stream_id,
    streamName:  r.streams?.name ?? null,
    totalMarks:  r.total_marks,
    passMark:    r.pass_mark,
    journaled:   r.journaled ?? false,
    journalId:   r.journal_id,
    createdBy:   r.created_by,
    term:        r.term,
    year:        r.year,
    createdAt:   r.created_at,
  }
}

// ── useTeacherEvents ───────────────────────────────────────────────────────
// Returns events created by this teacher (their own) for their classes.
export function useTeacherEvents() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['teacher-events', user?.schoolId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SchoolEvent[]> => {
      const sid = user!.schoolId

      // Get this teacher's staff row
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', sid)
        .eq('auth_user_id', user!.id)
        .maybeSingle()

      if (!staffRow) return []

      const { data, error } = await supabase
        .from('school_events')
        .select(EVENT_SELECT)
        .eq('school_id', sid)
        .eq('created_by', staffRow.id)
        .order('event_date', { ascending: true })

      if (error?.code === '42P01') return []
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapRow)
    },
    staleTime: 2 * 60_000,
  })
}

// ── useAllSchoolEvents ─────────────────────────────────────────────────────
// All school events (for TermProgressTimeline dots).
export function useAllSchoolEvents() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['school-events-all', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<SchoolEvent[]> => {
      const { data, error } = await supabase
        .from('school_events')
        .select(EVENT_SELECT)
        .eq('school_id', user!.schoolId)
        .order('event_date', { ascending: true })

      if (error?.code === '42P01') return []
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapRow)
    },
    staleTime: 2 * 60_000,
  })
}

// ── useCreateEvent ─────────────────────────────────────────────────────────
export function useCreateEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      title: string
      eventType: string
      subjectId: string | null
      classId: string | null
      streamId: string | null
      eventDate: string
      totalMarks: number | null
      passMark: number | null
      description: string | null
      term: string | null
      year: number | null
    }) => {
      if (!user) throw new Error('Not authenticated')

      // Get this user's staff row
      const { data: staffRow, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (staffErr || !staffRow) throw new Error('Staff record not found')

      const { error } = await supabase
        .from('school_events')
        .insert({
          school_id:   user.schoolId,
          title:       input.title,
          event_type:  input.eventType,
          subject_id:  input.subjectId,
          class_id:    input.classId,
          stream_id:   input.streamId,
          event_date:  input.eventDate,
          total_marks: input.totalMarks,
          pass_mark:   input.passMark,
          description: input.description,
          term:        input.term,
          year:        input.year,
          created_by:  staffRow.id,
          journaled:   false,
        })

      if (error?.code === '42P01') throw new Error('Events table not yet created on this server')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher-events'] })
      void qc.invalidateQueries({ queryKey: ['school-events-all'] })
      void qc.invalidateQueries({ queryKey: ['term-progress'] })
    },
  })
}

// ── useUpdateEvent ─────────────────────────────────────────────────────────
export function useUpdateEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      title: string
      eventType: string
      subjectId: string | null
      classId: string | null
      streamId: string | null
      eventDate: string
      totalMarks: number | null
      passMark: number | null
      description: string | null
      term: string | null
      year: number | null
    }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('school_events')
        .update({
          title:       input.title,
          event_type:  input.eventType,
          subject_id:  input.subjectId,
          class_id:    input.classId,
          stream_id:   input.streamId,
          event_date:  input.eventDate,
          total_marks: input.totalMarks,
          pass_mark:   input.passMark,
          description: input.description,
          term:        input.term,
          year:        input.year,
        })
        .eq('id', input.id)
        .eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher-events'] })
      void qc.invalidateQueries({ queryKey: ['school-events-all'] })
      void qc.invalidateQueries({ queryKey: ['term-progress'] })
    },
  })
}

// ── useDeleteEvent ─────────────────────────────────────────────────────────
export function useDeleteEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('school_events').delete()
        .eq('id', id).eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-events-all'] })
      void qc.invalidateQueries({ queryKey: ['teacher-events'] })
      void qc.invalidateQueries({ queryKey: ['term-progress'] })
    },
  })
}

// ── useJournalEvent ────────────────────────────────────────────────────────
// Marks an event as journaled and links it to an exam_journal entry.
export function useJournalEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, journalId }: { eventId: string; journalId: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('school_events')
        .update({ journaled: true, journal_id: journalId })
        .eq('id', eventId)
        .eq('school_id', user.schoolId)
      if (error?.code === '42P01') return  // table not yet created
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher-events'] })
    },
  })
}
