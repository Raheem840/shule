import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useExamJournals, useCreateJournal, useNextCALabel } from '../../hooks/useExamJournal'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { useAuth } from '../../store/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal, ModalCancelButton } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { AssessmentType, ExamJournal } from '../../types/app'
import type { JournalFilters } from '../../hooks/useExamJournal'

// ── Constants ──────────────────────────────────────────────────
const ASSESSMENT_OPTIONS: { value: AssessmentType; label: string }[] = [
  { value: 'aoi',               label: 'Activity of Integration' },
  { value: 'dit',               label: 'DIT Assignment' },
  { value: 'ca',                label: 'Continuous Assessment' },
  { value: 'beginning_of_term', label: 'Beginning of Term' },
  { value: 'mid_term',          label: 'Mid-Term Test' },
  { value: 'end_of_term',       label: 'End of Term Examination' },
  { value: 'practical',         label: 'Practical' },
  { value: 'class_test',        label: 'Class Test' },
  { value: 'assignment',        label: 'Assignment' },
]

const TERM_OPTIONS = [
  { value: '1', label: 'Term 1' },
  { value: '2', label: 'Term 2' },
  { value: '3', label: 'Term 3' },
]

const CURRENT_YEAR = new Date().getFullYear()

// ── Zod schema ─────────────────────────────────────────────────
const journalSchema = z.object({
  assessmentType:  z.enum(['aoi','dit','ca','beginning_of_term','mid_term','end_of_term','practical','class_test','assignment']),
  subjectId:       z.string().min(1, 'Subject is required'),
  classId:         z.string().min(1, 'Class is required'),
  streamId:        z.string().nullable(),
  term:            z.string().min(1, 'Term is required'),
  date:            z.string().min(1, 'Date is required'),
  totalMarks:      z.coerce.number().min(1).optional(),
  passMark:        z.coerce.number().min(0).optional(),
  notes:           z.string().nullable().optional(),
  // AOI
  learningArea:     z.string().nullable().optional(),
  competency:       z.string().nullable().optional(),
  integrationTheme: z.string().nullable().optional(),
  // DIT
  tradeArea:        z.string().nullable().optional(),
  ditModuleCode:    z.string().nullable().optional(),
  // CA
  caComponent: z.enum(['oral','written','project','portfolio']).nullable().optional(),
  caWeighting: z.coerce.number().min(0).max(100).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.assessmentType !== 'ca') {
    if (!data.totalMarks || data.totalMarks < 1) {
      ctx.addIssue({ code: 'custom', path: ['totalMarks'], message: 'Total marks is required' })
    }
  }
})

type JournalFormValues = z.infer<typeof journalSchema>

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: ExamJournal['status'] }) {
  return status === 'published'
    ? <Badge variant="green" dot>Published</Badge>
    : <Badge variant="muted" dot>Draft</Badge>
}

// ── Assessment type badge ──────────────────────────────────────
const TYPE_VARIANT: Record<AssessmentType, 'teal'|'violet'|'amber'|'blue'|'green'|'red'|'muted'> = {
  aoi:               'violet',
  dit:               'amber',
  ca:                'teal',
  beginning_of_term: 'blue',
  mid_term:          'blue',
  end_of_term:       'red',
  practical:         'green',
  class_test:        'muted',
  assignment:        'muted',
}

const TYPE_LABELS: Record<AssessmentType, string> = {
  aoi:               'AOI',
  dit:               'DIT',
  ca:                'CA',
  beginning_of_term: 'BOT',
  mid_term:          'Mid-Term',
  end_of_term:       'End of Term',
  practical:         'Practical',
  class_test:        'Class Test',
  assignment:        'Assignment',
}

function TypeBadge({ type }: { type: AssessmentType }) {
  return <Badge variant={TYPE_VARIANT[type]}>{TYPE_LABELS[type]}</Badge>
}

// ── Create Journal Modal ───────────────────────────────────────
function CreateJournalModal({ onClose }: { onClose: () => void }) {
  const { user }   = useAuth()
  const create     = useCreateJournal()
  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()

  const { control, register, watch, handleSubmit, formState: { errors } } =
    useForm<JournalFormValues>({
      resolver: zodResolver(journalSchema),
      defaultValues: {
        assessmentType: 'ca',
        streamId: null,
        date: new Date().toISOString().slice(0, 10),
        totalMarks: 100,
        passMark: 50,
        notes: null,
      },
    })

  const assessmentType = watch('assessmentType')
  const subjectId      = watch('subjectId')
  const classId        = watch('classId')
  const term           = watch('term')

  const { data: streams = [] } = useStreams(classId || null)
  const { data: caLabel }      = useNextCALabel(
    subjectId   || null,
    classId     || null,
    term        || null,
    CURRENT_YEAR,
  )

  const isCA  = assessmentType === 'ca'
  const isAOI = assessmentType === 'aoi'
  const isDIT = assessmentType === 'dit'

  const onSubmit = handleSubmit(async values => {
    await create.mutateAsync({
      subjectId:        values.subjectId,
      classId:          values.classId,
      streamId:         values.streamId ?? null,
      assessmentType:   values.assessmentType,
      date:             values.date,
      totalMarks:       isCA ? 3 : (values.totalMarks ?? 100),
      passMark:         isCA ? 2 : (values.passMark ?? 50),
      term:             values.term,
      year:             CURRENT_YEAR,
      notes:            values.notes ?? null,
      learningArea:     isAOI ? (values.learningArea ?? null) : null,
      competency:       isAOI ? (values.competency ?? null) : null,
      integrationTheme: isAOI ? (values.integrationTheme ?? null) : null,
      tradeArea:        isDIT ? (values.tradeArea ?? null) : null,
      ditModuleCode:    isDIT ? (values.ditModuleCode ?? null) : null,
      caComponent:      isCA  ? (values.caComponent ?? null) : null,
      caWeighting:      isCA  ? (values.caWeighting ?? null) : null,
      caLabel:          isCA  ? (caLabel ?? 'C1') : undefined,
    })
    onClose()
  })

  return (
    <Modal open onClose={onClose} title="Create Journal Entry" size="lg"
      footer={
        <>
          <ModalCancelButton onClose={onClose} />
          <Button variant="primary" loading={create.isPending} onClick={onSubmit}>
            Create Journal
          </Button>
        </>
      }
    >
      <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Assessment type */}
        <Controller name="assessmentType" control={control} render={({ field }) => (
          <Select label="Assessment Type" value={field.value} onChange={field.onChange}
            error={errors.assessmentType?.message}
            options={ASSESSMENT_OPTIONS}
          />
        )} />

        {isCA && caLabel && (
          <div style={{
            background: 'var(--brand-light)', border: '1px solid rgba(13,148,136,0.2)',
            borderRadius: 8, padding: '8px 12px',
            fontSize: 12, color: 'var(--brand)', fontWeight: 700,
          }}>
            This will be labelled <strong>{caLabel}</strong> (next CA for this subject this term)
          </div>
        )}

        {/* Core fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Controller name="subjectId" control={control} render={({ field }) => (
            <Select label="Subject ★" value={field.value ?? ''} onChange={field.onChange}
              error={errors.subjectId?.message}
              options={subjects.map(s => ({ value: s.id, label: s.name }))}
              placeholder="Select subject"
            />
          )} />
          <Controller name="classId" control={control} render={({ field }) => (
            <Select label="Class ★" value={field.value ?? ''} onChange={field.onChange}
              error={errors.classId?.message}
              options={classes.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Select class"
            />
          )} />
          <Controller name="streamId" control={control} render={({ field }) => (
            <Select label="Stream" value={field.value ?? ''} onChange={v => field.onChange(v || null)}
              options={[{ value: '', label: 'All streams' }, ...streams.map(s => ({ value: s.id, label: s.name }))]}
              disabled={!classId}
            />
          )} />
          <Controller name="term" control={control} render={({ field }) => (
            <Select label="Term ★" value={field.value ?? ''} onChange={field.onChange}
              error={errors.term?.message}
              options={TERM_OPTIONS}
              placeholder="Select term"
            />
          )} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input label="Date ★" type="date" {...register('date')} error={errors.date?.message} />
          {!isCA && (
            <>
              <Input label="Total Marks ★" type="number" step="0.5"
                {...register('totalMarks')} error={errors.totalMarks?.message} />
              <Input label="Pass Mark" type="number" step="0.5"
                {...register('passMark')} error={errors.passMark?.message} />
            </>
          )}
        </div>

        {/* AOI conditional fields */}
        {isAOI && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: 1 }}>Activity of Integration</div>
            <Input label="Learning Area" {...register('learningArea')} placeholder="e.g. Sciences" />
            <Input label="Competency" {...register('competency')} placeholder="e.g. Critical thinking" />
            <Input label="Integration Theme" {...register('integrationTheme')} placeholder="e.g. Environmental sustainability" />
          </div>
        )}

        {/* DIT conditional fields */}
        {isDIT && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: 1 }}>DIT Assignment</div>
            <Input label="Trade / Vocational Area" {...register('tradeArea')} placeholder="e.g. Carpentry" />
            <Input label="DIT Module Code" {...register('ditModuleCode')} placeholder="e.g. CRP-001" />
          </div>
        )}

        {/* CA conditional fields */}
        {isCA && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: 1, gridColumn: '1/-1' }}>Continuous Assessment</div>
            <Controller name="caComponent" control={control} render={({ field }) => (
              <Select label="Component" value={field.value ?? ''} onChange={v => field.onChange(v || null)}
                options={[
                  { value: '', label: 'Select component' },
                  { value: 'oral',      label: 'Oral' },
                  { value: 'written',   label: 'Written' },
                  { value: 'project',   label: 'Project' },
                  { value: 'portfolio', label: 'Portfolio' },
                ]}
              />
            )} />
            <Input label="Weighting %" type="number" min="0" max="100" {...register('caWeighting')} />
          </div>
        )}

        <Input label="Teacher Notes" {...register('notes')} placeholder="Optional notes about this assessment" />

        {create.isError && (
          <div style={{ color: 'var(--danger)', fontSize: 12, padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 8 }}>
            {(create.error as Error).message}
          </div>
        )}
      </form>
    </Modal>
  )
}

// ── Filters bar ────────────────────────────────────────────────
function FiltersBar({ filters, onChange }: {
  filters:  JournalFilters
  onChange: (f: JournalFilters) => void
}) {
  const { data: subjects = [] } = useSubjects()
  const { data: classes  = [] } = useClasses()

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Select
        value={filters.subjectId ?? ''}
        onChange={v => onChange({ ...filters, subjectId: v || undefined })}
        options={[{ value: '', label: 'All Subjects' }, ...subjects.map(s => ({ value: s.id, label: s.name }))]}
        style={{ minWidth: 150 }}
      />
      <Select
        value={filters.classId ?? ''}
        onChange={v => onChange({ ...filters, classId: v || undefined })}
        options={[{ value: '', label: 'All Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
        style={{ minWidth: 120 }}
      />
      <Select
        value={filters.term ?? ''}
        onChange={v => onChange({ ...filters, term: v || undefined })}
        options={[{ value: '', label: 'All Terms' }, ...TERM_OPTIONS]}
        style={{ minWidth: 110 }}
      />
      <Select
        value={filters.assessmentType ?? ''}
        onChange={v => onChange({ ...filters, assessmentType: (v as AssessmentType) || undefined })}
        options={[{ value: '', label: 'All Types' }, ...ASSESSMENT_OPTIONS]}
        style={{ minWidth: 160 }}
      />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export function ExamJournalPage() {
  const navigate   = useNavigate()
  const [creating, setCreating] = useState(false)
  const [filters,  setFilters]  = useState<JournalFilters>({})

  const { data: journals = [], isLoading } = useExamJournals(filters)
  const { data: subjects = [] } = useSubjects()
  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams()   // no classId → all school streams

  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))
  const classMap   = new Map(classes.map(c => [c.id, c.name]))
  const streamMap  = new Map(streams.map(s => [s.id, s.name]))

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Exam Journal"
        subtitle="Create and manage assessment entries, then enter marks."
        action={
          <Button variant="primary" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          } onClick={() => setCreating(true)}>
            Create Journal Entry
          </Button>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <FiltersBar filters={filters} onChange={setFilters} />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <LoadingSpinner size={28} />
        </div>
      ) : journals.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          color: 'var(--txt3)', fontFamily: 'var(--font2)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>No journal entries yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Create your first assessment entry to get started.</div>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Type', 'Subject', 'Class', 'Stream', 'Term', 'Date', 'Marks', 'Status', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    fontFamily: 'var(--font2)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journals.map((j, i) => (
                <tr
                  key={j.id}
                  onClick={() => navigate(`/teacher/exams/${j.id}/marks`)}
                  className="sui-tr"
                  style={{
                    borderBottom: i < journals.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <TypeBadge type={j.assessmentType} />
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--txt)', fontSize: 13 }}>
                    {subjectMap.get(j.subjectId) ?? j.subjectId}
                    {j.caLabel && (
                      <span style={{ marginLeft: 6, color: 'var(--brand)', fontSize: 11, fontWeight: 800 }}>
                        {j.caLabel}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13 }}>
                    {classMap.get(j.classId) ?? j.classId}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--txt3)', fontSize: 12 }}>
                    {j.streamId ? (streamMap.get(j.streamId) ?? '—') : <span style={{ color: 'var(--txt3)' }}>All</span>}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13 }}>
                    Term {j.term}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13, fontFamily: 'var(--mono)' }}>
                    {new Date(j.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13, fontFamily: 'var(--mono)' }}>
                    {j.totalMarks}
                    {j.passMark && <span style={{ color: 'var(--txt3)' }}> / pass {j.passMark}</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge status={j.status} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); navigate(`/teacher/exams/${j.id}/marks`) }}>
                      Enter Marks →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateJournalModal onClose={() => setCreating(false)} />}
    </div>
  )
}
