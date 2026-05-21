import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calculateCBCGrade } from '../types/app'
import type { ExamResult } from '../types/app'

const RESULT_COLS = [
  'id', 'school_id', 'exam_journal_id', 'student_id', 'subject_id',
  'score', 'grade', 'is_absent', 'term', 'year', 'teacher_id',
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
    queryKey: ['exam-results', journalId],
    enabled:  !!journalId && !!user,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select(RESULT_COLS)
        .eq('exam_journal_id', journalId!)
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return (data ?? []).map(r => toResult(r as AnyRow))
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
          teacher_id:      user!.id,
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
      qc.invalidateQueries({ queryKey: ['exam-results', journalId] })
    },
  })
}

// ── useAllStudentResults ───────────────────────────────────────
// Used by the report card generator: fetches all results for a set of students
// for a given term/year, with exam_journal details joined.
// Returns a flat array — group by student_id and subject_id in the caller.
export type ResultWithJournal = {
  studentId:      string
  subjectId:      string
  score:          number | null
  isAbsent:       boolean
  assessmentType: string
  journalName:    string
  caLabel:        string | null
  totalMarks:     number
}

export function useAllStudentResults(params: {
  studentIds: string[]
  term:       string
  year:       number
}) {
  const { user } = useAuth()
  const { studentIds, term, year } = params

  return useQuery({
    queryKey: ['all-student-results', user?.schoolId, studentIds, term, year],
    enabled:  !!user && studentIds.length > 0,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          student_id, subject_id, score, is_absent,
          exam_journal!inner(
            id, assessment_type, name, ca_label, total_marks
          )
        `)
        .eq('school_id', user!.schoolId)
        .in('student_id', studentIds)
        .eq('term', term)
        .eq('year', year)

      if (error) throw error

      return (data ?? []).map(r => {
        const row  = r as AnyRow
        const ej   = row.exam_journal as AnyRow
        return {
          studentId:      row.student_id as string,
          subjectId:      row.subject_id as string,
          score:          (row.score as number) ?? null,
          isAbsent:       (row.is_absent as boolean) ?? false,
          assessmentType: ej.assessment_type as string,
          journalName:    ej.name as string,
          caLabel:        (ej.ca_label as string) ?? null,
          totalMarks:     ej.total_marks as number,
        } satisfies ResultWithJournal
      })
    },
  })
}
