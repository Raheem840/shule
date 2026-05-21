import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { TeacherRemark } from '../types/app'

const REMARK_COLS = [
  'id', 'school_id', 'student_id', 'teacher_id',
  'class_id', 'stream_id', 'term', 'year', 'remarks', 'created_at',
].join(', ')

type AnyRow = Record<string, unknown>

function toRemark(r: AnyRow): TeacherRemark {
  return {
    id:        r.id as string,
    schoolId:  r.school_id as string,
    studentId: r.student_id as string,
    teacherId: r.teacher_id as string,
    classId:   r.class_id as string,
    streamId:  (r.stream_id as string) ?? null,
    term:      r.term as string,
    year:      r.year as number,
    remarks:   r.remarks as string,
    createdAt: r.created_at as string,
  }
}

// ── useTeacherRemarks ──────────────────────────────────────────
// Returns all remarks saved by this teacher for a class+stream+term+year.
// Keyed by studentId so the page can do O(1) lookups.
export function useTeacherRemarks(params: {
  term:     string | null | undefined
  classId:  string | null | undefined
  streamId: string | null | undefined
  year:     number | null | undefined
}) {
  const { user } = useAuth()
  const { term, classId, streamId, year } = params

  return useQuery({
    queryKey: ['teacher-remarks', user?.schoolId, user?.id, term, classId, streamId, year],
    enabled:  !!user && !!term && !!classId && !!year,
    queryFn:  async () => {
      let q = supabase
        .from('teacher_remarks')
        .select(REMARK_COLS)
        .eq('school_id', user!.schoolId)
        .eq('teacher_id', user!.id)
        .eq('term',       term!)
        .eq('year',       year!)
        .eq('class_id',   classId!)

      if (streamId) q = q.eq('stream_id', streamId)

      const { data, error } = await q
      if (error) throw error

      // Return as a Map<studentId, TeacherRemark> for O(1) access
      const map = new Map<string, TeacherRemark>()
      for (const r of (data ?? [])) {
        const remark = toRemark(r as AnyRow)
        map.set(remark.studentId, remark)
      }
      return map
    },
  })
}

// ── RemarkRow ──────────────────────────────────────────────────
export type RemarkRow = {
  studentId: string
  remarks:   string
}

// ── useSaveRemarks ─────────────────────────────────────────────
// Upserts all remarks. Conflict key: (school_id, student_id, term, year).
export function useSaveRemarks() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      term,
      year,
      classId,
      streamId,
      rows,
    }: {
      term:     string
      year:     number
      classId:  string
      streamId: string | null
      rows:     RemarkRow[]
    }) => {
      const records = rows.map(r => ({
        school_id:  user!.schoolId,
        student_id: r.studentId,
        teacher_id: user!.id,
        class_id:   classId,
        stream_id:  streamId,
        term,
        year,
        remarks:    r.remarks,
      }))

      const BATCH = 100
      for (let i = 0; i < records.length; i += BATCH) {
        const { error } = await supabase
          .from('teacher_remarks')
          .upsert(records.slice(i, i + BATCH), {
            onConflict: 'school_id,student_id,term,year',
          })
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['teacher-remarks', user?.schoolId, user?.id, vars.term, vars.classId, vars.streamId, vars.year],
      })
    },
  })
}
