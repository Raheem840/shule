import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calculateCBCGrade } from '../types/app'
import type { ExamResult } from '../types/app'

const RESULT_COLS = [
  'id', 'school_id', 'exam_journal_id', 'student_id', 'subject_id',
  'score', 'grade', 'is_absent', 'remarks', 'term', 'year', 'teacher_id',
].join(', ')

type AnyRow = Record<string, unknown>

function toResult(r: AnyRow): ExamResult {
  return {
    id:            r.id as string,
    schoolId:      r.school_id as string,
    examJournalId: r.exam_journal_id as string,
    studentId:     r.student_id as string,
    subjectId:     r.subject_id as string,
    score:         (r.score as number) ?? null,
    grade:         (r.grade as ExamResult['grade']) ?? null,
    isAbsent:      (r.is_absent as boolean) ?? false,
    remarks:       (r.remarks as string) ?? null,
    term:          r.term as string,
    year:          r.year as number,
    teacherId:     r.teacher_id as string,
  }
}

// ── useExamResults ─────────────────────────────────────────────
// All saved results for a single exam journal entry.
export function useExamResults(journalId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['exam-results', user?.schoolId, journalId],
    enabled:  !!journalId && !!user,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select(RESULT_COLS)
        .eq('exam_journal_id', journalId!)
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return (data ?? []).map(r => toResult(r as unknown as AnyRow))
    },
  })
}

// ── MarkRow ────────────────────────────────────────────────────
// One row of mark data to upsert — mirrors what the mark entry UI collects.
export type MarkRow = {
  studentId: string
  score:     number | null   // null if absent or not entered
  isAbsent:  boolean
}

// ── useSaveMarks ───────────────────────────────────────────────
// Upserts all mark rows for a journal. Batches in 100-row chunks.
// Conflict key: (exam_journal_id, student_id) — unique per student per journal.
export function useSaveMarks() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      journalId,
      subjectId,
      assessmentType,
      totalMarks,
      term,
      year,
      marks,
    }: {
      journalId:      string
      subjectId:      string
      assessmentType: string
      totalMarks:     number
      term:           string
      year:           number
      marks:          MarkRow[]
    }) => {
      const rows = marks.map(m => {
        // Grade: null for end_of_term (needs CA to combine), calculated for all others
        let grade: ExamResult['grade'] = null
        if (!m.isAbsent && m.score !== null && assessmentType !== 'end_of_term') {
          const pct = assessmentType === 'ca'
            ? (m.score / 3) * 100
            : (m.score / totalMarks) * 100
          grade = calculateCBCGrade(pct)
        }

        return {
          school_id:       user!.schoolId,
          exam_journal_id: journalId,
          student_id:      m.studentId,
          subject_id:      subjectId,
          teacher_id:      user!.staffId ?? user!.id,
          score:           m.isAbsent ? null : m.score,
          grade,
          is_absent:       m.isAbsent,
          term,
          year,
        }
      })

      const BATCH = 100
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase
          .from('exam_results')
          .upsert(rows.slice(i, i + BATCH), {
            onConflict: 'exam_journal_id,student_id',
          })
        if (error) throw error
      }

      return journalId
    },
    onSuccess: journalId => {
      qc.invalidateQueries({ queryKey: ['exam-results', user?.schoolId, journalId] })
      qc.invalidateQueries({ queryKey: ['dos-overview',       user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['dos-class-perf',     user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['principal-kpis',     user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['secretary-briefing', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['term-progress',      user?.schoolId] })
    },
  })
}

