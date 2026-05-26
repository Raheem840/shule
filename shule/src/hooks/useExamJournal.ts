import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { ExamJournal, AssessmentType } from '../types/app'

const JOURNAL_COLS = [
  'id', 'school_id', 'teacher_id', 'subject_id', 'class_id', 'stream_id',
  'assessment_type', 'name', 'date', 'total_marks', 'pass_mark', 'term', 'year',
  'notes', 'status',
  'learning_area', 'competency', 'integration_theme',
  'trade_area', 'dit_module_code',
  'ca_component', 'ca_weighting', 'ca_label',
].join(', ')

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
    name:             r.name as string,
    date:             r.date as string,
    totalMarks:       r.total_marks as number,
    passMark:         r.pass_mark as number,
    term:             r.term as string,
    year:             r.year as number,
    notes:            (r.notes as string) ?? null,
    status:           ((r.status as string) ?? 'draft') as ExamJournal['status'],
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
      let q = supabase
        .from('exam_journal')
        .select(JOURNAL_COLS)
        .eq('school_id', user!.schoolId)
        .eq('teacher_id', user!.id)
        .order('date', { ascending: false })

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
    queryKey: ['exam-journal', journalId],
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
  date:            string
  totalMarks:      number
  passMark:        number
  term:            string
  year:            number
  notes:           string | null
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
      // CA journals always score 0–3 per competency; total_marks = 3
      const totalMarks = input.assessmentType === 'ca' ? 3 : input.totalMarks
      const passMark   = input.assessmentType === 'ca' ? 2 : input.passMark
      const name       = input.caLabel ?? ASSESSMENT_LABELS[input.assessmentType]

      const { data, error } = await supabase
        .from('exam_journal')
        .insert({
          school_id:         user!.schoolId,
          teacher_id:        user!.id,
          subject_id:        input.subjectId,
          class_id:          input.classId,
          stream_id:         input.streamId,
          assessment_type:   input.assessmentType,
          name,
          date:              input.date,
          total_marks:       totalMarks,
          pass_mark:         passMark,
          term:              input.term,
          year:              input.year,
          notes:             input.notes,
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
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-journals', user?.schoolId, user?.id] })
      qc.invalidateQueries({ queryKey: ['next-ca-label', user?.schoolId] })
    },
  })
}

// ── usePublishJournal ──────────────────────────────────────────
export function usePublishJournal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (journalId: string) => {
      const { error } = await supabase
        .from('exam_journal')
        .update({ status: 'published' })
        .eq('id', journalId)
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return journalId
    },
    onSuccess: id => {
      qc.invalidateQueries({ queryKey: ['exam-journals', user?.schoolId, user?.id] })
      qc.invalidateQueries({ queryKey: ['exam-journal', id] })
    },
  })
}
