import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { calculateCBCGrade, calculateALevelGrade, calculatePLEGrade } from '../types/app'
import { classifyClassName } from '../lib/educationStage'
import { isJournalLocked } from './useExamJournal'
import { sendNotifications } from '../lib/notifications'
import type { ExamResult, ExamJournal } from '../types/app'

export type GradeFn = (pct: number) => 'A' | 'B' | 'C' | 'D' | 'E' | ReturnType<typeof calculatePLEGrade>

// Which grade scale a journal's class should use — decided by the school's
// education_level first (Primary always uses PLE's D1-F9, regardless of
// class name), then within a Secondary school by the journal's own class
// (S5/S6 = A-level). Shared by useSaveMarks (the actual save path) and
// useJournalGradeFn (used for live UI previews) so the two can never diverge.
async function resolveGradeFn(schoolId: string, journalClassId: string | null): Promise<GradeFn> {
  const { data: schoolRow } = await supabase
    .from('school_profile')
    .select('education_level')
    .eq('id', schoolId)
    .maybeSingle()
  const educationLevel = (schoolRow as { education_level?: string } | null)?.education_level ?? 'secondary'

  if (educationLevel === 'primary') return calculatePLEGrade

  if (journalClassId) {
    const { data: classRow } = await supabase
      .from('classes')
      .select('name')
      .eq('id', journalClassId)
      .eq('school_id', schoolId)
      .maybeSingle()
    const className = (classRow as { name?: string } | null)?.name
    if (className && classifyClassName(className).stage === 'alevel') return calculateALevelGrade
  }

  return calculateCBCGrade
}

// ── useJournalGradeFn ─────────────────────────────────────────
// Resolves the correct grade function (CBC/A-Level/PLE) for a journal's
// class + the school's education_level — for live UI previews (grade
// badges, tabs, performance bands) so they match what useSaveMarks will
// actually persist, instead of assuming CBC A-E everywhere.
export function useJournalGradeFn(journal: { classId?: string | null } | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['journal-grade-fn', user?.schoolId, journal?.classId],
    enabled:  !!user?.schoolId,
    staleTime: 5 * 60_000,
    queryFn: () => resolveGradeFn(user!.schoolId, journal?.classId ?? null),
  })
}

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

// ── useExamResultsForJournals ───────────────────────────────────
// All saved results across MULTIPLE exam journals — for pages needing every
// subject's marks for a class/term (e.g. a report preview), where using
// useExamResults with a single journal id would silently show only one
// subject's results.
export function useExamResultsForJournals(journalIds: string[]) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['exam-results-multi', user?.schoolId, [...journalIds].sort()],
    enabled:  journalIds.length > 0 && !!user,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select(RESULT_COLS)
        .in('exam_journal_id', journalIds)
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
// Re-checks the journal's lock state against the live DB row (not whatever
// the calling page has cached) — a published journal past its grace period
// requires overrideReason, which gets logged to audit_log.
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
      overrideReason,
    }: {
      journalId:      string
      subjectId:      string
      assessmentType: string
      totalMarks:     number
      term:           string
      year:           number
      marks:          MarkRow[]
      overrideReason?: string
    }) => {
      if (!user) throw new Error('Not authenticated')
      if (!user.staffId) throw new Error('Staff profile not found — please sign out and sign in again')

      const { data: journalRow, error: jErr } = await supabase
        .from('exam_journal')
        .select('status, published_at, class_id')
        .eq('id', journalId)
        .eq('school_id', user.schoolId)
        .single()
      if (jErr) throw jErr

      const locked = isJournalLocked({
        status:      (journalRow as { status: ExamJournal['status'] }).status,
        publishedAt: (journalRow as { published_at: string | null }).published_at,
      })
      if (locked && !overrideReason?.trim()) {
        throw new Error('These results are locked. Provide a reason to make a correction.')
      }

      // Which grade scale to use — kept as its own named function independent
      // of O-level's calculateCBCGrade even though A-Level's underlying
      // formula is deliberately mirrored for now — see calculateALevelGrade's
      // doc-comment in types/app.ts — so it can be corrected the moment UNEB
      // publishes real A-Level numbers without touching O-level. Shared with
      // useJournalGradeFn (live UI previews) so they can never diverge.
      const journalClassId = (journalRow as { class_id: string | null }).class_id
      const gradeFn = await resolveGradeFn(user.schoolId, journalClassId)

      const rows = marks.map(m => {
        // Grade: null for end_of_term (needs CA to combine), calculated for all others
        let grade: ExamResult['grade'] = null
        if (!m.isAbsent && m.score !== null && assessmentType !== 'end_of_term' && totalMarks > 0) {
          // CA rubric is 0-3 points per indicator; use /3 not /totalMarks
          const pct = assessmentType === 'ca' ? (m.score / 3) * 100 : (m.score / totalMarks) * 100
          grade = gradeFn(pct)
        }

        return {
          school_id:       user!.schoolId,
          exam_journal_id: journalId,
          student_id:      m.studentId,
          subject_id:      subjectId,
          teacher_id:      user!.staffId,
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

      if (locked && overrideReason) {
        // The marks are already saved at this point — an audit-log failure
        // must not be swallowed silently, since the whole point of this
        // override flow is guaranteeing a compliance record exists. Surface
        // it as an error so the teacher (and whoever handles the resulting
        // support ticket) knows the correction landed but wasn't logged.
        const { error: auditErr } = await supabase.from('audit_log').insert({
          school_id:   user.schoolId,
          user_id:     user.id,
          role:        user.role,
          action:      'MARKS_EDITED_AFTER_LOCK',
          table_name:  'exam_results',
          record_id:   journalId,
          entity_name: `Exam journal ${journalId}`,
          new_value:   { reason: overrideReason.trim(), studentsAffected: rows.length },
        })
        if (auditErr) {
          throw new Error(`Marks were saved, but the audit record failed: ${auditErr.message}`)
        }

        // Notify the DoS — a locked-marks override is an academic-integrity
        // signal they should see without having to trawl the audit log.
        // Best-effort: no DoS account, or the notification failing, must not
        // block the (already-saved, already-audited) correction itself.
        try {
          const { data: dosStaff } = await supabase.from('staff').select('auth_user_id')
            .eq('school_id', user.schoolId).eq('role', 'dos').maybeSingle()
          const dosAuthId = (dosStaff as { auth_user_id: string | null } | null)?.auth_user_id
          if (dosAuthId) {
            await sendNotifications({
              schoolId: user.schoolId,
              userIds:  [dosAuthId],
              type:     'academic',
              title:    'Locked Marks Edited',
              body:     `${user.name} corrected ${rows.length} result${rows.length !== 1 ? 's' : ''} on a locked journal. Reason: ${overrideReason.trim()}`,
              link:     '/dos/dashboard?tab=academic-issues',
            })
          }
        } catch (_e) {
          // Non-fatal — the audit_log row above is the source of truth.
        }
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

