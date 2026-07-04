import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { TeacherRemark } from '../types/app'

// class_id, stream_id, created_at are NOT in DB schema for teacher_remarks
const REMARK_COLS = [
  'id', 'school_id', 'student_id', 'teacher_id',
  'term', 'year', 'remarks',
].join(', ')

type AnyRow = Record<string, unknown>

function toRemark(r: AnyRow): TeacherRemark {
  return {
    id:        r.id as string,
    schoolId:  r.school_id as string,
    studentId: r.student_id as string,
    teacherId: r.teacher_id as string,
    classId:   null,
    streamId:  null,
    term:      r.term as string,
    year:      r.year as number,
    remarks:   r.remarks as string,
    createdAt: null,
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
    enabled:  !!user && !!user.staffId && !!term && !!classId && !!year,
    queryFn:  async () => {
      // class_id / stream_id not in DB — load all remarks for this teacher + term + year
      const { data, error } = await supabase
        .from('teacher_remarks')
        .select(REMARK_COLS)
        .eq('school_id', user!.schoolId)
        .eq('teacher_id', user!.staffId ?? user!.id)
        .eq('term',       term!)
        .eq('year',       year!)
      if (error) throw error

      // Return as a Map<studentId, TeacherRemark> for O(1) access
      const map = new Map<string, TeacherRemark>()
      for (const r of (data ?? [])) {
        const remark = toRemark(r as unknown as AnyRow)
        map.set(remark.studentId, remark)
      }
      return map
    },
  })
}

// ── useAllTeacherRemarks ───────────────────────────────────────
// Read-only hook for principal / deputy / dos — fetches ALL teacher
// remarks for a given term+year, optionally filtered by student list.
// Returns a Map<studentId, TeacherRemark[]> (multiple teachers may have
// written for the same student, so we keep them all).
export function useAllTeacherRemarks(params: {
  term:  string | null | undefined
  year:  number | null | undefined
}) {
  const { user } = useAuth()
  const { term, year } = params

  return useQuery({
    queryKey: ['all-teacher-remarks', user?.schoolId, term, year],
    enabled:  !!user && !!term && !!year,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('teacher_remarks')
        .select(REMARK_COLS)
        .eq('school_id', user!.schoolId)
        .eq('term',       term!)
        .eq('year',       year!)
        .order('student_id')
      if (error) throw error

      const map = new Map<string, TeacherRemark[]>()
      for (const r of (data ?? [])) {
        const remark = toRemark(r as unknown as AnyRow)
        const list = map.get(remark.studentId) ?? []
        list.push(remark)
        map.set(remark.studentId, list)
      }
      return map
    },
  })
}

// ── Performance bands (Uganda NCDC CBC 4-tier) ─────────────────
// Basic 0-49, Elementary 50-64, Moderate 65-79, Distinction 80-100.
export type PerformanceBand = 'basic' | 'elementary' | 'moderate' | 'distinction'

export const PERFORMANCE_BANDS: { value: PerformanceBand; label: string; min: number; max: number }[] = [
  { value: 'distinction', label: 'Distinction', min: 80, max: 100 },
  { value: 'moderate',    label: 'Moderate',     min: 65, max: 79 },
  { value: 'elementary',  label: 'Elementary',   min: 50, max: 64 },
  { value: 'basic',       label: 'Basic',        min: 0,  max: 49 },
]

export function bandForScore(avg: number): PerformanceBand {
  if (avg >= 80) return 'distinction'
  if (avg >= 65) return 'moderate'
  if (avg >= 50) return 'elementary'
  return 'basic'
}

// Default remark templates per band — teacher can edit before applying.
export const BAND_REMARK_TEMPLATES: Record<PerformanceBand, string> = {
  distinction: 'An excellent term — consistently strong performance across subjects. Keep up the outstanding work.',
  moderate:    'A solid term overall, with room to push further in a few areas. Keep working steadily.',
  elementary:  'Making progress this term. More consistent revision and practice will help raise performance.',
  basic:       'This term was challenging academically. Extra support and consistent follow-up are recommended.',
}

// ── useStudentPerformanceBands ──────────────────────────────────
// For a given set of students, computes each one's average score from
// PUBLISHED exam_results for the term+year, and buckets them into a CBC
// performance band — used to bulk-apply one remark to everyone in a band.
export function useStudentPerformanceBands(studentIds: string[], term: string | null, year: number | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-performance-bands', user?.schoolId, studentIds.join(','), term, year],
    enabled:  !!user?.schoolId && studentIds.length > 0 && !!term && !!year,
    staleTime: 3 * 60_000,
    queryFn: async (): Promise<Map<string, { avg: number; band: PerformanceBand }>> => {
      const sid = user!.schoolId

      const [journalRes, resultsRes] = await Promise.all([
        supabase.from('exam_journal').select('id').eq('school_id', sid).eq('status', 'published').eq('term', term!).eq('year', year!),
        supabase.from('exam_results').select('student_id, score, exam_journal_id').eq('school_id', sid).eq('term', term!).eq('year', year!).in('student_id', studentIds).not('score', 'is', null),
      ])

      const publishedIds = new Set((journalRes.data ?? []).map((j: any) => j.id as string))
      const perStudent = new Map<string, number[]>()
      for (const r of (resultsRes.data ?? []) as any[]) {
        if (!publishedIds.has(r.exam_journal_id)) continue
        const sid2 = r.student_id as string
        if (!perStudent.has(sid2)) perStudent.set(sid2, [])
        perStudent.get(sid2)!.push(Number(r.score))
      }

      const map = new Map<string, { avg: number; band: PerformanceBand }>()
      for (const [studId, scores] of perStudent) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        map.set(studId, { avg, band: bandForScore(avg) })
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
// Upserts all remarks. Conflict key: (school_id, student_id, teacher_id, term, year).
export function useSaveRemarks() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      term,
      year,
      classId:  _classId,
      streamId: _streamId,
      rows,
    }: {
      term:     string
      year:     number
      classId:  string
      streamId: string | null
      rows:     RemarkRow[]
    }) => {
      if (!user) throw new Error('Not authenticated')
      const records = rows.map(r => ({
        school_id:  user!.schoolId,
        student_id: r.studentId,
        teacher_id: user!.staffId ?? user!.id,
        term,
        year,
        remarks:    r.remarks,
      }))

      const BATCH = 100
      for (let i = 0; i < records.length; i += BATCH) {
        const { error } = await supabase
          .from('teacher_remarks')
          .upsert(records.slice(i, i + BATCH), {
            onConflict: 'school_id,student_id,teacher_id,term,year',
          })
        if (error) throw error
      }

      // Notify parents of students who received remarks
      const studentIds = rows.map(r => r.studentId)
      if (studentIds.length > 0) {
        const teacherName = user!.name ?? 'Your child\'s teacher'
        // Find parent accounts linked to these students
        const { data: parentAccounts } = await supabase
          .from('parent_accounts')
          .select('auth_user_id, student_ids')
          .eq('school_id', user!.schoolId)
          .not('auth_user_id', 'is', null)
        for (const pa of (parentAccounts ?? [])) {
          const linked = ((pa as Record<string, unknown>).student_ids as string[]) ?? []
          if (linked.some(sid => studentIds.includes(sid))) {
            const parentUserId = (pa as Record<string, unknown>).auth_user_id as string
            const notifBody = `A new remark has been added for Term ${term}, ${year}. Tap to view.`
            void supabase.from('notifications').insert({
              school_id:   user!.schoolId,
              user_id:     parentUserId,
              type:        'message',
              title:       teacherName,
              body:        notifBody,
              from_user:   user!.id,
              target_role: 'parent',
              read:        false,
              read_at:     null,
            })
            // Also fire background push so parent sees it even when app is closed
            void supabase.functions.invoke('send-push', {
              body: { userId: parentUserId, schoolId: user!.schoolId, title: teacherName, body: notifBody, url: '/parent/portal' },
            })
          }
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['teacher-remarks', user?.schoolId, user?.id, vars.term, vars.classId, vars.streamId, vars.year],
      })
    },
  })
}
