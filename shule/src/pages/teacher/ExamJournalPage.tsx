import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useExamJournals, useCreateJournal, useNextCALabel } from '../../hooks/useExamJournal'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { useAuth } from '../../store/AuthContext'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { AssessmentType, ExamJournal } from '../../types/app'
import type { JournalFilters } from '../../hooks/useExamJournal'

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

export const journalSchema = z.object({
  assessmentType:  z.enum(['aoi','dit','ca','beginning_of_term','mid_term','end_of_term','practical','class_test','assignment']),
  subjectId:       z.string().min(1, 'Subject is required'),
  classId:         z.string().min(1, 'Class is required'),
  streamId:        z.string().nullable(),
  term:            z.string().min(1, 'Term is required'),
  date:            z.string().min(1, 'Date is required'),
  totalMarks:      z.coerce.number().min(1, 'Total marks is required').max(100, 'Total marks cannot exceed 100').optional(),
  passMark:        z.coerce.number().min(0).optional(),
  notes:           z.string().nullable().optional(),
  learningArea:     z.string().nullable().optional(),
  competency:       z.string().nullable().optional(),
  integrationTheme: z.string().nullable().optional(),
  tradeArea:        z.string().nullable().optional(),
  ditModuleCode:    z.string().nullable().optional(),
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

const TYPE_COLORS: Record<AssessmentType, { bg: string; color: string }> = {
  aoi:               { bg: 'rgba(139,92,246,.12)', color: '#7c3aed' },
  dit:               { bg: 'rgba(245,158,11,.12)', color: '#b45309' },
  ca:                { bg: 'rgba(13,148,136,.12)', color: '#0f766e' },
  beginning_of_term: { bg: 'rgba(14,165,233,.12)', color: '#0369a1' },
  mid_term:          { bg: 'rgba(14,165,233,.12)', color: '#0369a1' },
  end_of_term:       { bg: 'rgba(244,63,94,.12)',  color: '#be123c' },
  practical:         { bg: 'rgba(16,185,129,.12)', color: '#065f46' },
  class_test:        { bg: 'rgba(148,163,184,.12)', color: '#475569' },
  assignment:        { bg: 'rgba(148,163,184,.12)', color: '#475569' },
}

const TYPE_LABELS: Record<AssessmentType, string> = {
  aoi: 'AOI', dit: 'DIT', ca: 'CA', beginning_of_term: 'BOT',
  mid_term: 'Mid-Term', end_of_term: 'End of Term', practical: 'Practical',
  class_test: 'Class Test', assignment: 'Assignment',
}

function TypeChip({ type }: { type: AssessmentType }) {
  const c = TYPE_COLORS[type]
  return (
    <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 800, background: c.bg, color: c.color, whiteSpace: 'nowrap', letterSpacing: .3 }}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function StatusDot({ status }: { status: ExamJournal['status'] }) {
  const published = status === 'published'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: published ? 'rgba(16,185,129,.12)' : 'rgba(148,163,184,.1)', color: published ? '#065f46' : 'var(--txt3)' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: published ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

const selectCls: React.CSSProperties = {
  width: '100%', padding: '9px 32px 9px 12px', fontSize: 13,
  background: 'var(--surface2)', border: '.5px solid var(--border)',
  borderRadius: 10, color: 'var(--txt)', appearance: 'none', outline: 'none',
}

const inputCls: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  background: 'var(--surface2)', border: '.5px solid var(--border)',
  borderRadius: 10, color: 'var(--txt)', outline: 'none', boxSizing: 'border-box',
}

function FieldWrap({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .6, fontFamily: 'var(--font2)' }}>{label}</label>
      <div style={{ position: 'relative' }}>{children}</div>
      {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

function SelectWrap({ label, value, onChange, options, disabled, error }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; error?: string }) {
  return (
    <FieldWrap label={label} error={error}>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...selectCls, opacity: disabled ? .5 : 1 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
    </FieldWrap>
  )
}

function CreateJournalModal({ onClose }: { onClose: () => void }) {
  const { user: _user }   = useAuth()
  const create     = useCreateJournal()
  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()

  const { control, register, watch, handleSubmit, formState: { errors } } =
    useForm<JournalFormValues>({
      resolver: zodResolver(journalSchema) as any,
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
      dateGiven:        values.date,
      totalMarks:       isCA ? 3 : (values.totalMarks ?? 100),
      passMark:         isCA ? 2 : (values.passMark ?? 50),
      term:             values.term,
      year:             CURRENT_YEAR,
      teacherNotes:     values.notes ?? null,
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

  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 580, maxHeight: '90dvh', overflowY: 'auto', background: 'var(--surface)', padding: '24px', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>Create Journal Entry</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--txt3)' }}>New assessment record</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, borderRadius: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Controller name="assessmentType" control={control} render={({ field }) => (
            <SelectWrap label="Assessment Type" value={field.value} onChange={field.onChange}
              error={errors.assessmentType?.message}
              options={ASSESSMENT_OPTIONS}
            />
          )} />

          {isCA && caLabel && (
            <div style={{ background: 'rgba(13,148,136,.08)', border: '.5px solid rgba(13,148,136,.25)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>
              This will be labelled <strong>{caLabel}</strong> (next CA for this subject this term)
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Controller name="subjectId" control={control} render={({ field }) => (
              <SelectWrap label="Subject ★" value={field.value ?? ''} onChange={field.onChange}
                error={errors.subjectId?.message}
                options={[{ value: '', label: 'Select subject' }, ...subjects.map(s => ({ value: s.id, label: s.name }))]}
              />
            )} />
            <Controller name="classId" control={control} render={({ field }) => (
              <SelectWrap label="Class ★" value={field.value ?? ''} onChange={field.onChange}
                error={errors.classId?.message}
                options={[{ value: '', label: 'Select class' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
              />
            )} />
            <Controller name="streamId" control={control} render={({ field }) => (
              <SelectWrap label="Stream" value={field.value ?? ''} onChange={v => field.onChange(v || null)}
                options={[{ value: '', label: 'All streams' }, ...streams.map(s => ({ value: s.id, label: s.name }))]}
                disabled={!classId}
              />
            )} />
            <Controller name="term" control={control} render={({ field }) => (
              <SelectWrap label="Term ★" value={field.value ?? ''} onChange={field.onChange}
                error={errors.term?.message}
                options={[{ value: '', label: 'Select term' }, ...TERM_OPTIONS]}
              />
            )} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FieldWrap label="Date ★" error={errors.date?.message}>
              <input type="date" {...register('date')} style={inputCls} />
            </FieldWrap>
            {!isCA && (
              <>
                <FieldWrap label="Total Marks ★" error={errors.totalMarks?.message}>
                  <input type="number" step="0.5" {...register('totalMarks')} style={inputCls} />
                </FieldWrap>
                <FieldWrap label="Pass Mark">
                  <input type="number" step="0.5" {...register('passMark')} style={inputCls} />
                </FieldWrap>
              </>
            )}
          </div>

          {isAOI && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12, border: '.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8 }}>Activity of Integration</div>
              <FieldWrap label="Learning Area"><input {...register('learningArea')} style={inputCls} placeholder="e.g. Sciences" /></FieldWrap>
              <FieldWrap label="Competency"><input {...register('competency')} style={inputCls} placeholder="e.g. Critical thinking" /></FieldWrap>
              <FieldWrap label="Integration Theme"><input {...register('integrationTheme')} style={inputCls} placeholder="e.g. Environmental sustainability" /></FieldWrap>
            </div>
          )}

          {isDIT && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12, border: '.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8 }}>DIT Assignment</div>
              <FieldWrap label="Trade / Vocational Area"><input {...register('tradeArea')} style={inputCls} placeholder="e.g. Carpentry" /></FieldWrap>
              <FieldWrap label="DIT Module Code"><input {...register('ditModuleCode')} style={inputCls} placeholder="e.g. CRP-001" /></FieldWrap>
            </div>
          )}

          {isCA && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12, border: '.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, gridColumn: '1/-1' }}>Continuous Assessment</div>
              <Controller name="caComponent" control={control} render={({ field }) => (
                <SelectWrap label="Component" value={field.value ?? ''} onChange={v => field.onChange(v || null)}
                  options={[
                    { value: '', label: 'Select component' },
                    { value: 'oral', label: 'Oral' },
                    { value: 'written', label: 'Written' },
                    { value: 'project', label: 'Project' },
                    { value: 'portfolio', label: 'Portfolio' },
                  ]}
                />
              )} />
              <FieldWrap label="Weighting %">
                <input type="number" min="0" max="100" {...register('caWeighting')} style={inputCls} />
              </FieldWrap>
            </div>
          )}

          <FieldWrap label="Teacher Notes">
            <input {...register('notes')} style={inputCls} placeholder="Optional notes about this assessment" />
          </FieldWrap>

          {create.isError && (
            <div style={{ color: 'var(--danger)', fontSize: 12, padding: '8px 12px', background: 'rgba(244,63,94,.08)', borderRadius: 10 }}>
              {(create.error as Error).message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button" onClick={() => void onSubmit()} disabled={create.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.35)' }}>
              {create.isPending ? 'Creating…' : 'Create Journal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

function FiltersBar({ filters, onChange }: { filters: JournalFilters; onChange: (f: JournalFilters) => void }) {
  const { data: subjects = [] } = useSubjects()
  const { data: classes  = [] } = useClasses()

  const sel: React.CSSProperties = { padding: '8px 32px 8px 12px', fontSize: 12.5, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, color: 'var(--txt)', appearance: 'none', outline: 'none' }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
      {[
        { label: 'Subject', value: filters.subjectId ?? '', opts: [{ value: '', label: 'All Subjects' }, ...subjects.map(s => ({ value: s.id, label: s.name }))], key: 'subjectId' },
        { label: 'Class',   value: filters.classId   ?? '', opts: [{ value: '', label: 'All Classes'  }, ...classes.map(c => ({ value: c.id, label: c.name }))],  key: 'classId'   },
        { label: 'Term',    value: filters.term       ?? '', opts: [{ value: '', label: 'All Terms'    }, ...TERM_OPTIONS],                                         key: 'term'      },
        { label: 'Type',    value: filters.assessmentType ?? '', opts: [{ value: '', label: 'All Types' }, ...ASSESSMENT_OPTIONS],                                  key: 'assessmentType' },
      ].map(f => (
        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .5, fontFamily: 'var(--font2)' }}>{f.label}</label>
          <div style={{ position: 'relative' }}>
            <select style={sel} value={f.value}
              onChange={e => onChange({ ...filters, [f.key]: e.target.value || undefined })}>
              {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ExamJournalPage() {
  const navigate   = useNavigate()
  const [creating, setCreating] = useState(false)
  const [filters,  setFilters]  = useState<JournalFilters>({})

  const { data: journals = [], isLoading } = useExamJournals(filters)
  const { data: subjects = [] } = useSubjects()
  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams()

  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))
  const classMap   = new Map(classes.map(c => [c.id, c.name]))
  const streamMap  = new Map(streams.map(s => [s.id, s.name]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Exam Journal</h1>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Create and manage assessment entries, then enter marks</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.4)', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Journal Entry
        </button>
      </div>

      <FiltersBar filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <LoadingSpinner size={28} />
        </div>
      ) : journals.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(145deg,rgba(13,148,136,.12),rgba(13,148,136,.04))', border: '.5px solid rgba(13,148,136,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>No journal entries yet</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 320, margin: '0 auto' }}>Create your first assessment entry to start entering marks.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          <div className="hscroll">
            <table style={{ borderCollapse: 'collapse', minWidth: 700, width: '100%' }}>
              <thead>
                <tr>
                  {['Type', 'Subject', 'Class', 'Stream', 'Term', 'Date', 'Marks', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', background: 'var(--surface2)', fontWeight: 700, fontSize: 11, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .7, borderBottom: '.5px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {journals.map((j, i) => (
                  <tr key={j.id} onClick={() => navigate(`/teacher/exams/${j.id}/marks`)}
                    style={{ borderBottom: i < journals.length - 1 ? '.5px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '12px 14px' }}><TypeChip type={j.assessmentType} /></td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--txt)', fontSize: 13 }}>
                      {subjectMap.get(j.subjectId) ?? j.subjectId}
                      {j.caLabel && <span style={{ marginLeft: 6, color: 'var(--brand)', fontSize: 11, fontWeight: 800 }}>{j.caLabel}</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13 }}>{classMap.get(j.classId) ?? j.classId}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--txt3)', fontSize: 12 }}>{j.streamId ? (streamMap.get(j.streamId) ?? '—') : 'All'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13 }}>T{j.term}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13, fontFamily: 'var(--font3)' }}>
                      {j.dateGiven ? new Date(j.dateGiven).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--txt2)', fontSize: 13, fontFamily: 'var(--font3)' }}>
                      {j.totalMarks}{j.passMark && <span style={{ color: 'var(--txt3)', fontSize: 11 }}> /p{j.passMark}</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusDot status={j.status} /></td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={e => { e.stopPropagation(); navigate(`/teacher/exams/${j.id}/marks`) }}
                        style={{ padding: '5px 12px', borderRadius: 8, border: '.5px solid var(--border)', background: 'transparent', color: 'var(--brand)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Marks →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && <CreateJournalModal onClose={() => setCreating(false)} />}
    </div>
  )
}
