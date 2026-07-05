import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { ExamJournal, AssessmentType } from '../types/app'

const JOURNAL_COLS = [
  'id', 'school_id', 'teacher_id', 'subject_id', 'class_id', 'stream_id', 'academic_year_id',
  'assessment_type', 'name', 'date_given', 'total_marks', 'pass_mark', 'term', 'year',
  'teacher_notes', 'status', 'published_at',
  'learning_area', 'competency', 'integration_theme',
  'trade_area', 'dit_module_code',
  'ca_component', 'ca_weighting', 'ca_label',
].join(', ')

// A published journal's marks stay freely editable for this many days after
// publish (the "provisional" window) — after that, editing requires an
// override reason, logged to audit_log. Journals published before this
// column existed have published_at=null and are treated as never-locked.
export const MARKS_GRACE_PERIOD_DAYS = 30

export function isJournalLocked(journal: Pick<ExamJournal, 'status' | 'publishedAt'>): boolean {
  if (journal.status !== 'published' || !journal.publishedAt) return false
  const lockAt = new Date(journal.publishedAt).getTime() + MARKS_GRACE_PERIOD_DAYS * 86_400_000
  return Date.now() > lockAt
}

type AnyRow = Record<string, unknown>

function toJournal(r: AnyRow): ExamJournal {
  return {
    id:               r.id as string,
    schoolId:         r.school_id as string,
    teacherId:        r.teacher_id as string,
    subjectId:        r.subject_id as string,
    classId:          r.class_id as string,
    streamId:         (r.stream_id as string) ?? null,
    assessmentType:   r.assessment_type as AssessmentType,
    academicYearId:   (r.academic_year_id as string) ?? null,
    name:             r.name as string,
    dateGiven:        (r.date_given as string) ?? null,
    totalMarks:       r.total_marks as number,
    passMark:         r.pass_mark as number,
    term:             r.term as string,
    year:             r.year as number,
    teacherNotes:     (r.teacher_notes as string) ?? null,
    status:           ((r.status as string) ?? 'draft') as ExamJournal['status'],
    publishedAt:      (r.published_at as string) ?? null,
    learningArea:     (r.learning_area as string) ?? null,
    competency:       (r.competency as string) ?? null,
    integrationTheme: (r.integration_theme as string) ?? null,
    tradeArea:        (r.trade_area as string) ?? null,
    ditModuleCode:    (r.dit_module_code as string) ?? null,
    caComponent:      (r.ca_component as ExamJournal['caComponent']) ?? null,
    caWeighting:      (r.ca_weighting as number) ?? null,
    caLabel:          (r.ca_label as string) ?? null,
  }
}

export type JournalFilters = {
  subjectId?:      string
  classId?:        string
  term?:           string
  assessmentType?: AssessmentType
}

// ── useExamJournals ────────────────────────────────────────────
// Returns all exam journals for the logged-in teacher.
export function useExamJournals(filters: JournalFilters = {}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['exam-journals', user?.schoolId, user?.id, filters],
    enabled:  !!user,
    queryFn:  async () => {
      // RLS handles teacher scoping (teacher sees only their own via staff.id match)
      let q = supabase
        .from('exam_journal')
        .select(JOURNAL_COLS)
        .eq('school_id', user!.schoolId)
        .order('date_given', { ascending: false })

      if (filters.subjectId)      q = q.eq('subject_id',     filters.subjectId)
      if (filters.classId)        q = q.eq('class_id',        filters.classId)
      if (filters.term)           q = q.eq('term',            filters.term)
      if (filters.assessmentType) q = q.eq('assessment_type', filters.assessmentType)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map(r => toJournal(r as unknown as AnyRow))
    },
  })
}

// ── useExamJournalById ─────────────────────────────────────────
export function useExamJournalById(journalId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['exam-journal', user?.schoolId, journalId],
    enabled:  !!journalId && !!user,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('exam_journal')
        .select(JOURNAL_COLS)
        .eq('id', journalId!)
        .eq('school_id', user!.schoolId)
        .single()

      if (error) throw error
      return toJournal(data as unknown as AnyRow)
    },
  })
}

// ── useNextCALabel ─────────────────────────────────────────────
// Counts existing CA entries for subject+class+term+year to auto-label
// the next one as "C1", "C2", "C3", etc.
export function useNextCALabel(
  subjectId: string | null | undefined,
  classId:   string | null | undefined,
  term:      string | null | undefined,
  year:      number | null | undefined,
) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['next-ca-label', user?.schoolId, subjectId, classId, term, year],
    enabled:  !!user && !!subjectId && !!classId && !!term && !!year,
    staleTime: 0,
    queryFn:  async () => {
      const { count, error } = await supabase
        .from('exam_journal')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user!.schoolId)
        .eq('subject_id', subjectId!)
        .eq('class_id',   classId!)
        .eq('term',       term!)
        .eq('year',       year!)
        .eq('assessment_type', 'ca')

      if (error) throw error
      return `C${(count ?? 0) + 1}`
    },
  })
}

// ── CreateJournalInput ─────────────────────────────────────────
export type CreateJournalInput = {
  subjectId:       string
  classId:         string
  streamId:        string | null
  assessmentType:  AssessmentType
  dateGiven:       string
  totalMarks:      number
  passMark:        number
  term:            string
  year:            number
  teacherNotes:    string | null
  learningArea?:     string | null
  competency?:       string | null
  integrationTheme?: string | null
  tradeArea?:        string | null
  ditModuleCode?:    string | null
  caComponent?:      ExamJournal['caComponent']
  caWeighting?:      number | null
  caLabel?:          string  // auto-supplied by the form (e.g. "C2")
}

const ASSESSMENT_LABELS: Record<AssessmentType, string> = {
  aoi:               'Activity of Integration',
  dit:               'DIT Assignment',
  ca:                'Continuous Assessment',
  beginning_of_term: 'Beginning of Term',
  mid_term:          'Mid-Term Test',
  end_of_term:       'End of Term Examination',
  practical:         'Practical',
  class_test:        'Class Test',
  assignment:        'Assignment',
}

// ── useCreateJournal ───────────────────────────────────────────
export function useCreateJournal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateJournalInput) => {
      // teacher_id FK references staff.id — resolve from JWT claim or DB lookup
      let staffId = user!.staffId
      if (!staffId) {
        const { data: s } = await supabase
          .from('staff').select('id')
          .eq('auth_user_id', user!.id).eq('school_id', user!.schoolId).maybeSingle()
        staffId = (s as any)?.id
      }
      if (!staffId) throw new Error('Staff record not found for this user.')

      // CA journals always score 0–3 per competency; total_marks = 3
      const totalMarks = input.assessmentType === 'ca' ? 3 : input.totalMarks
      const passMark   = input.assessmentType === 'ca' ? 2 : input.passMark
      const name       = input.caLabel ?? ASSESSMENT_LABELS[input.assessmentType]

      const { data, error } = await supabase
        .from('exam_journal')
        .insert({
          school_id:         user!.schoolId,
          teacher_id:        staffId,
          subject_id:        input.subjectId,
          class_id:          input.classId,
          stream_id:         input.streamId,
          assessment_type:   input.assessmentType,
          name,
          date_given:        input.dateGiven,
          total_marks:       totalMarks,
          pass_mark:         passMark,
          term:              input.term,
          year:              input.year,
          teacher_notes:     input.teacherNotes,
          status:            'draft',
          learning_area:     input.learningArea ?? null,
          competency:        input.competency ?? null,
          integration_theme: input.integrationTheme ?? null,
          trade_area:        input.tradeArea ?? null,
          dit_module_code:   input.ditModuleCode ?? null,
          ca_component:      input.caComponent ?? null,
          ca_weighting:      input.caWeighting ?? null,
          ca_label:          input.caLabel ?? null,
        })
        .select('id')
        .single()

      if (error) throw error
      const journalId = data.id as string

      // Auto-create a school_events entry so all roles see this exam on the calendar
      await supabase.from('school_events').insert({
          school_id:   user!.schoolId,
          title:       name,
          event_type:  input.assessmentType,
          subject_id:  input.subjectId,
          class_id:    input.classId,
          stream_id:   input.streamId ?? null,
          event_date:  input.dateGiven,
          total_marks: totalMarks,
          pass_mark:   passMark,
          description: input.teacherNotes ?? null,
          term:        input.term,
          year:        input.year,
          created_by:  staffId,
          journaled:   true,
          journal_id:  journalId,
        })

      return journalId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-journals', user?.schoolId, user?.id] })
      qc.invalidateQueries({ queryKey: ['next-ca-label', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['school-events-all'] })
      qc.invalidateQueries({ queryKey: ['teacher-events'] })
      qc.invalidateQueries({ queryKey: ['term-progress'] })
    },
  })
}

// ── usePublishJournal ──────────────────────────────────────────
export function usePublishJournal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (journalId: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('exam_journal')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', journalId)
        .eq('school_id', user.schoolId)

      if (error) throw error
      return journalId
    },
    onSuccess: id => {
      qc.invalidateQueries({ queryKey: ['exam-journals', user?.schoolId, user?.id] })
      qc.invalidateQueries({ queryKey: ['exam-journal', id] })
    },
  })
}
