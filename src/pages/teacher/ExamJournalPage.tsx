import { useSubjects, useStreams, useMyAssignedClasses, useMyAssignedSubjects } from '../../hooks/useClasses'
import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useExamJournals, useCreateJournal, useNextCALabel } from '../../hooks/useExamJournal'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { calculateCBCGrade } from '../../types/app'
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

// ── Assessment type visual config ─────────────────────────────
const TYPE_COLORS: Record<AssessmentType, { bg: string; color: string; border: string }> = {
  aoi:               { bg: 'rgba(139,92,246,.13)', color: '#7c3aed', border: 'rgba(139,92,246,.3)' },
  dit:               { bg: 'rgba(245,158,11,.13)',  color: '#b45309', border: 'rgba(245,158,11,.3)' },
  ca:                { bg: 'rgba(13,148,136,.13)',  color: '#0f766e', border: 'rgba(13,148,136,.3)' },
  beginning_of_term: { bg: 'rgba(14,165,233,.13)',  color: '#0369a1', border: 'rgba(14,165,233,.3)' },
  mid_term:          { bg: 'rgba(99,102,241,.13)',   color: '#4338ca', border: 'rgba(99,102,241,.3)' },
  end_of_term:       { bg: 'rgba(244,63,94,.13)',    color: '#be123c', border: 'rgba(244,63,94,.3)'  },
  practical:         { bg: 'rgba(245,158,11,.13)',   color: '#92400e', border: 'rgba(245,158,11,.3)' },
  class_test:        { bg: 'rgba(16,185,129,.13)',   color: '#065f46', border: 'rgba(16,185,129,.3)' },
  assignment:        { bg: 'rgba(148,163,184,.13)',  color: '#475569', border: 'rgba(148,163,184,.3)' },
}

const TYPE_LABELS: Record<AssessmentType, string> = {
  aoi: 'AOI', dit: 'DIT', ca: 'CA', beginning_of_term: 'BOT',
  mid_term: 'Mid-Term', end_of_term: 'End of Term', practical: 'Practical',
  class_test: 'Class Test', assignment: 'Assignment',
}

function TypeChip({ type }: { type: AssessmentType }) {
  const c = TYPE_COLORS[type]
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 800,
      background: c.bg, color: c.color, whiteSpace: 'nowrap', letterSpacing: .4,
      border: `.5px solid ${c.border}`, fontFamily: 'var(--font2)',
    }}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function StatusBadge({ status }: { status: ExamJournal['status'] }) {
  const published = status === 'published'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
      background: published ? 'rgba(16,185,129,.12)' : 'rgba(148,163,184,.1)',
      color: published ? '#065f46' : 'var(--txt3)',
      border: `.5px solid ${published ? 'rgba(16,185,129,.3)' : 'var(--border)'}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: published ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

// ── Skeleton card ──────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="shule-skeleton" style={{ width: 72, height: 22, borderRadius: 6 }} />
        <div className="shule-skeleton" style={{ width: 64, height: 20, borderRadius: 20 }} />
      </div>
      <div className="shule-skeleton" style={{ width: '65%', height: 18, borderRadius: 6 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="shule-skeleton" style={{ width: 80, height: 14, borderRadius: 4 }} />
        <div className="shule-skeleton" style={{ width: 60, height: 14, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div className="shule-skeleton" style={{ flex: 1, height: 32, borderRadius: 8 }} />
        <div className="shule-skeleton" style={{ flex: 1, height: 32, borderRadius: 8 }} />
      </div>
    </div>
  )
}

// ── Form field helpers ─────────────────────────────────────────
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

function SelectWrap({ label, value, onChange, options, disabled, error }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; error?: string
}) {
  return (
    <FieldWrap label={label} error={error}>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...selectCls, opacity: disabled ? .5 : 1 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </FieldWrap>
  )
}

// ── Create Journal Modal ───────────────────────────────────────
function CreateJournalModal({ onClose }: { onClose: () => void }) {
  const { user: _user }  = useAuth()
  const navigate         = useNavigate()
  const create           = useCreateJournal()
  const classes          = useMyAssignedClasses()
  const subjects         = useMyAssignedSubjects()

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
    const journalId = await create.mutateAsync({
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
    // Go straight to mark entry after creation — user picks manual entry or import there
    navigate(`/teacher/exams/${journalId}/marks`)
  })

  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
      <div role="dialog" aria-modal="true" data-testid="journal-create-modal" style={{ width: '100%', maxWidth: 580, maxHeight: '90dvh', overflowY: 'auto', background: 'var(--surface)', padding: '24px', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(145deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
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
            <div style={{ background: 'rgba(99,102,241,.08)', border: '.5px solid rgba(99,102,241,.25)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#4f46e5', fontWeight: 700 }}>
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
            <button type="button" onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button" onClick={() => void onSubmit()} disabled={create.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,.35)' }}>
              {create.isPending ? 'Creating…' : 'Create Journal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

// ── Filters bar ────────────────────────────────────────────────
function FiltersBar({ filters, onChange }: { filters: JournalFilters; onChange: (f: JournalFilters) => void }) {
  const { data: subjects = [] } = useSubjects()
  const classes                 = useMyAssignedClasses()

  const sel: React.CSSProperties = {
    padding: '7px 32px 7px 12px', fontSize: 12.5,
    background: 'var(--surface2)', border: '.5px solid var(--border)',
    borderRadius: 10, color: 'var(--txt)', appearance: 'none', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 16px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14 }}>
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Journal Card ───────────────────────────────────────────────
function JournalCard({
  journal, subjectName, className, streamName, onEnterMarks, onImportMarks,
}: {
  journal:       ExamJournal
  subjectName:   string
  className:     string
  streamName:    string
  onEnterMarks:  () => void
  onImportMarks: () => void
}) {
  const c = TYPE_COLORS[journal.assessmentType]

  return (
    <div style={{
      background: 'var(--surface)',
      border: '.5px solid var(--border)',
      borderRadius: 18,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      boxShadow: '0 1px 8px rgba(0,0,0,.05)',
      transition: 'box-shadow .15s, transform .15s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${c.color}, ${c.color}88)`, borderRadius: '18px 18px 0 0' }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4 }}>
        <TypeChip type={journal.assessmentType} />
        <StatusBadge status={journal.status} />
      </div>

      {/* Subject + CA label */}
      <div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15.5, color: 'var(--txt)', letterSpacing: -.3, display: 'flex', alignItems: 'center', gap: 7 }}>
          {subjectName}
          {journal.caLabel && (
            <span style={{ fontSize: 11, fontWeight: 900, color: c.color, background: c.bg, border: `.5px solid ${c.border}`, padding: '1px 7px', borderRadius: 5 }}>
              {journal.caLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--txt3)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{className}</span>
          {streamName && streamName !== 'All' && (
            <>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span>{streamName}</span>
            </>
          )}
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>Term {journal.term} {journal.year}</span>
        </div>
      </div>

      {/* Meta chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {journal.dateGiven && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--txt2)', background: 'var(--surface2)', padding: '3px 9px', borderRadius: 6, border: '.5px solid var(--border)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {new Date(journal.dateGiven).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--txt2)', background: 'var(--surface2)', padding: '3px 9px', borderRadius: 6, border: '.5px solid var(--border)', fontFamily: 'var(--font3)' }}>
          /{journal.totalMarks} marks
        </div>
        {journal.passMark != null && (
          <div style={{ fontSize: 11.5, color: 'var(--txt3)', background: 'var(--surface2)', padding: '3px 9px', borderRadius: 6, border: '.5px solid var(--border)' }}>
            Pass: {journal.passMark}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          onClick={onEnterMarks}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(99,102,241,.3)', fontFamily: 'var(--font2)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Enter Marks
        </button>
        <button
          onClick={onImportMarks}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 10,
            border: '.5px solid var(--border)',
            background: 'var(--surface2)', color: 'var(--txt2)',
            fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            fontFamily: 'var(--font2)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
          </svg>
          Import Marks
        </button>
      </div>
    </div>
  )
}

// ── Teacher analytics types ────────────────────────────────────
type TeacherResultRow = {
  studentId: string; studentName: string; admissionNumber: string
  score: number | null; isAbsent: boolean; term: string; year: number
  subjectId: string; examJournalId: string; grade: string | null
}

type TeacherAnalyticsFilter = 'all' | 'top10' | 'proficient' | 'can_improve' | 'needs_help'

const GRADE_COLOR_MAP: Record<string, string> = {
  A: '#10b981', B: '#0d9488', C: '#0ea5e9', D: '#f59e0b', E: '#f43f5e',
}

function AnalyticsPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   active ? 'var(--brand)'   : 'var(--surface)',
        color:        active ? '#fff'            : 'var(--txt2)',
        border:       active ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
        borderRadius: 99, padding: '6px 18px',
        fontWeight: 800, fontSize: 12, fontFamily: 'var(--font2)',
        cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'all .15s',
      }}
    >
      {label}
    </button>
  )
}

function TeacherChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.stroke || p.fill || 'var(--brand)' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// Hook: fetch all results for the current teacher's journals
function useMyResults(journalIds: string[]) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-results-analytics', user?.schoolId, journalIds.sort().join(',')],
    enabled: !!user && journalIds.length > 0,
    queryFn: async (): Promise<TeacherResultRow[]> => {
      const [resultsRes, studentsRes] = await Promise.all([
        supabase.from('exam_results')
          .select('id, exam_journal_id, student_id, subject_id, score, is_absent, term, year, grade')
          .eq('school_id', user!.schoolId)
          .in('exam_journal_id', journalIds),
        supabase.from('students')
          .select('id, first_name, last_name, admission_number')
          .eq('school_id', user!.schoolId),
      ])
      if (resultsRes.error) throw new Error(resultsRes.error.message)
      const studMap = new Map<string, { name: string; admNo: string }>(
        (studentsRes.data ?? []).map((s: any) => [
          s.id as string,
          { name: `${s.first_name} ${s.last_name}`, admNo: s.admission_number ?? '—' },
        ])
      )
      return (resultsRes.data ?? []).map((r: any): TeacherResultRow => {
        const stu   = studMap.get(r.student_id as string)
        const score = r.score as number | null
        const gradeVal = (r.grade as string | null) ?? (score != null ? calculateCBCGrade(score) : null)
        return {
          studentId:      r.student_id as string,
          studentName:    stu?.name ?? '—',
          admissionNumber: stu?.admNo ?? '—',
          score, isAbsent: (r.is_absent as boolean) ?? false,
          term: r.term as string, year: r.year as number,
          subjectId:      r.subject_id as string,
          examJournalId:  r.exam_journal_id as string,
          grade: gradeVal,
        }
      })
    },
    staleTime: 2 * 60_000,
  })
}

// My Analytics panel — placed below the journal card grid
function MyAnalyticsPanel({
  journals, subjects, classes,
}: {
  journals: ExamJournal[]
  subjects: { id: string; name: string }[]
  classes:  { id: string; name: string }[]
}) {
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects])
  const classMap   = useMemo(() => new Map(classes.map(c  => [c.id, c.name])), [classes])

  const [bandFilter,  setBandFilter]  = useState<TeacherAnalyticsFilter>('all')
  const [subjFilter,  setSubjFilter]  = useState('')
  const [classFilter, setClassFilter] = useState('')

  const journalIds    = useMemo(() => journals.map(j => j.id), [journals])
  const { data: allResults = [], isLoading } = useMyResults(journalIds)

  const journalMeta = useMemo(() => {
    const m = new Map<string, ExamJournal>()
    for (const j of journals) m.set(j.id, j)
    return m
  }, [journals])

  // Base results filtered by subject/class dropdowns
  const baseResults = useMemo(() => {
    return allResults.filter(r => {
      const j = journalMeta.get(r.examJournalId)
      if (!j) return false
      if (subjFilter  && j.subjectId !== subjFilter)  return false
      if (classFilter && j.classId   !== classFilter) return false
      return true
    })
  }, [allResults, journalMeta, subjFilter, classFilter])

  // Apply band (pill) filter
  const filteredResults = useMemo(() => {
    if (bandFilter === 'all') return baseResults
    if (bandFilter === 'top10') {
      const scoreMap = new Map<string, number[]>()
      for (const r of baseResults) {
        if (r.score == null) continue
        const arr = scoreMap.get(r.studentId) ?? []
        arr.push(r.score)
        scoreMap.set(r.studentId, arr)
      }
      const topIds = new Set(
        [...scoreMap.entries()]
          .map(([id, sc]) => ({ id, avg: sc.reduce((a, b) => a + b, 0) / sc.length }))
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 10)
          .map(a => a.id)
      )
      return baseResults.filter(r => topIds.has(r.studentId))
    }
    return baseResults.filter(r => {
      if (r.score == null) return false
      const g = calculateCBCGrade(r.score)
      if (bandFilter === 'proficient')  return g === 'A' || g === 'B'
      if (bandFilter === 'can_improve') return g === 'C' || g === 'D'
      if (bandFilter === 'needs_help')  return g === 'E'
      return true
    })
  }, [baseResults, bandFilter])

  // Grade distribution
  const gradeData = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    for (const r of filteredResults) {
      if (r.isAbsent || r.score == null) continue
      counts[calculateCBCGrade(r.score)]++
    }
    return Object.entries(counts).map(([grade, count]) => ({ grade, count, fill: GRADE_COLOR_MAP[grade] }))
  }, [filteredResults])

  // Score trend: average per term
  const trendData = useMemo(() => {
    const termBucket = new Map<string, number[]>()
    for (const r of filteredResults) {
      if (r.score == null || r.isAbsent) continue
      const key = `T${r.term} ${r.year}`
      const arr = termBucket.get(key) ?? []
      arr.push(r.score)
      termBucket.set(key, arr)
    }
    return [...termBucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, sc]) => ({ label, avg: +(sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1) }))
  }, [filteredResults])

  // Student improvement: compare first vs last score per student across terms
  const improvementData = useMemo(() => {
    const studentTerms = new Map<string, { name: string; scores: { key: string; score: number }[] }>()
    for (const r of baseResults) {
      if (r.score == null || r.isAbsent) continue
      const termKey = `T${r.term} ${r.year}`
      if (!studentTerms.has(r.studentId)) {
        studentTerms.set(r.studentId, { name: r.studentName, scores: [] })
      }
      studentTerms.get(r.studentId)!.scores.push({ key: termKey, score: r.score })
    }
    const results: { name: string; delta: number; first: number; last: number }[] = []
    for (const [, v] of studentTerms.entries()) {
      if (v.scores.length < 2) continue
      const sorted = v.scores.sort((a, b) => a.key.localeCompare(b.key))
      const first  = sorted[0].score
      const last   = sorted[sorted.length - 1].score
      results.push({ name: v.name, delta: +(last - first).toFixed(1), first, last })
    }
    return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10)
  }, [baseResults, journalMeta])

  // Excel export
  const exportExcel = useCallback(async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('My Results')
    ws.columns = [
      { header: 'Student Name',   key: 'studentName',     width: 22 },
      { header: 'Admission No',   key: 'admissionNumber', width: 14 },
      { header: 'Subject',        key: 'subject',         width: 18 },
      { header: 'Class',          key: 'className',       width: 12 },
      { header: 'Assessment',     key: 'assessment',      width: 18 },
      { header: 'Term',           key: 'term',            width: 8  },
      { header: 'Year',           key: 'year',            width: 8  },
      { header: 'Score',          key: 'score',           width: 8  },
      { header: 'Grade',          key: 'grade',           width: 8  },
    ]
    const headerRow = ws.getRow(1)
    headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height    = 20
    for (const r of filteredResults) {
      const j = journalMeta.get(r.examJournalId)
      ws.addRow({
        studentName:     r.studentName,
        admissionNumber: r.admissionNumber,
        subject:         subjectMap.get(r.subjectId) ?? '—',
        className:       classMap.get(j?.classId ?? '') ?? '—',
        assessment:      j?.assessmentType.replace(/_/g, ' ') ?? '—',
        term:            `T${r.term}`,
        year:            r.year,
        score:           r.isAbsent ? 'ABS' : (r.score ?? '—'),
        grade:           r.isAbsent ? 'ABS' : (r.grade ?? '—'),
      })
    }
    ws.autoFilter = { from: 'A1', to: 'I1' }
    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `my-results-${bandFilter}-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [filteredResults, journalMeta, subjectMap, classMap, bandFilter])

  if (journals.length === 0) return null

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(145deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)', letterSpacing: -.3 }}>My Analytics</div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Performance across all your assessed journals</div>
        </div>
        <button
          onClick={() => void exportExcel()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#10b981,#059669)',
            color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(16,185,129,.3)', fontFamily: 'var(--font2)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export My Results
        </button>
      </div>

      {/* Band pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, whiteSpace: 'nowrap' as const, marginRight: 4 }}>Band</span>
        {([
          ['all',         'All'],
          ['top10',       'Top 10'],
          ['proficient',  'Proficient (A/B)'],
          ['can_improve', 'Can Improve (C/D)'],
          ['needs_help',  'Needs Help (E)'],
        ] as [TeacherAnalyticsFilter, string][]).map(([v, l]) => (
          <AnalyticsPill key={v} label={l} active={bandFilter === v} onClick={() => setBandFilter(v)} />
        ))}
      </div>

      {/* Secondary filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '12px 16px', alignItems: 'flex-end' }}>
        {([
          { label: 'Subject', val: subjFilter,  set: setSubjFilter,  opts: [['','All Subjects'], ...subjects.map(s => [s.id, s.name])] as [string,string][] },
          { label: 'Class',   val: classFilter, set: setClassFilter, opts: [['','All Classes'],  ...classes.map(c  => [c.id, c.name])] as [string,string][] },
        ]).map(({ label, val, set, opts }) => (
          <div key={label} style={{ flex: '0 1 150px', minWidth: 120 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, marginBottom: 5 }}>{label}</div>
            <select value={val} onChange={e => set(e.target.value)} className="sui-input" style={{ width: '100%' }}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <div style={{ fontSize: 12, color: 'var(--txt3)', alignSelf: 'center', marginLeft: 'auto' }}>
          <strong style={{ color: 'var(--txt)' }}>{filteredResults.length}</strong> results
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 200, borderRadius: 14 }} />)}
        </div>
      )}

      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

          {/* Grade distribution */}
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)', marginBottom: 14 }}>My Class Grade Distribution</div>
            {gradeData.every(d => d.count === 0) ? (
              <div style={{ padding: '30px 0', textAlign: 'center' as const, color: 'var(--txt3)', fontSize: 12.5 }}>No scored results yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gradeData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 12, fontWeight: 700, fill: 'var(--txt2)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<TeacherChartTooltip />} cursor={{ fill: 'rgba(0,0,0,.04)' }} />
                  <Bar dataKey="count" name="Students" radius={[6,6,0,0]}>
                    {gradeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Score trend */}
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)', marginBottom: 14 }}>Average Score per Term</div>
            {trendData.length < 2 ? (
              <div style={{ padding: '30px 0', textAlign: 'center' as const, color: 'var(--txt3)', fontSize: 12.5 }}>Need results from at least 2 terms.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TeacherChartTooltip />} cursor={{ stroke: 'var(--border)' }} />
                  <Line type="monotone" dataKey="avg" name="Avg Score" stroke="var(--brand)" strokeWidth={2.5} dot={{ fill: 'var(--brand)', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Student improvement */}
          {improvementData.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.05)', gridColumn: 'span 1' }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)', marginBottom: 14 }}>Student Progress (First → Latest)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {improvementData.map(s => {
                  const improved = s.delta > 0
                  const same     = s.delta === 0
                  return (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 10, background: 'var(--surface2)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{s.first} → {s.last}</span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 800,
                        background: same ? 'var(--surface)' : improved ? 'rgba(16,185,129,.12)' : 'rgba(244,63,94,.1)',
                        color: same ? 'var(--txt3)' : improved ? '#10b981' : '#f43f5e',
                        border: `.5px solid ${same ? 'var(--border)' : improved ? 'rgba(16,185,129,.3)' : 'rgba(244,63,94,.25)'}`,
                      }}>
                        {!same && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            {improved
                              ? <polyline points="18 15 12 9 6 15"/>
                              : <polyline points="6 9 12 15 18 9"/>}
                          </svg>
                        )}
                        {same ? '=' : (improved ? '+' : '')}{s.delta}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export function ExamJournalPage() {
  const navigate   = useNavigate()
  const isMobile   = useIsMobile()
  const [creating, setCreating] = useState(false)
  const [filters,  setFilters]  = useState<JournalFilters>({})

  const { data: journals = [], isLoading } = useExamJournals(filters)
  const { data: subjects = [] } = useSubjects()
  const classes                 = useMyAssignedClasses()
  const { data: streams  = [] } = useStreams()

  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))
  const classMap   = new Map(classes.map(c => [c.id, c.name]))
  const streamMap  = new Map(streams.map(s => [s.id, s.name]))

  // Stat counts
  const totalCount     = journals.length
  const draftCount     = journals.filter(j => j.status === 'draft').length
  const publishedCount = journals.filter(j => j.status === 'published').length
  const currentTerm    = String(new Date().getMonth() < 4 ? 1 : new Date().getMonth() < 8 ? 2 : 3)
  const thisTermCount  = journals.filter(j => j.term === currentTerm && j.year === CURRENT_YEAR).length

  const STATS = [
    { label: 'Total',     value: totalCount     },
    { label: 'Draft',     value: draftCount     },
    { label: 'Published', value: publishedCount },
    { label: 'This Term', value: thisTermCount  },
  ]

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero band ──────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        borderRadius: 20,
        padding: isMobile ? '20px 18px' : '28px 32px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(99,102,241,.35)',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: '30%', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div>
                <h1 style={{ margin: 0, fontFamily: 'var(--font2)', fontWeight: 900, fontSize: isMobile ? 20 : 24, color: '#fff', letterSpacing: -.5 }}>
                  Exam Journal
                </h1>
                <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,.75)' }}>
                  Create assessments · Enter marks · Publish results
                </p>
              </div>
            </div>

            {/* Stat chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STATS.map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,.15)',
                  border: '.5px solid rgba(255,255,255,.25)',
                  borderRadius: 10,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{ fontFamily: 'var(--font3)', fontWeight: 900, fontSize: 15, color: '#fff' }}>{s.value}</span>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop create button */}
          <button
            className="mob-fab-hide"
            onClick={() => setCreating(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', borderRadius: 12,
              border: '.5px solid rgba(255,255,255,.3)',
              background: '#fff',
              color: '#4f46e5',
              fontWeight: 800, fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,.15)',
              fontFamily: 'var(--font2)',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create Journal Entry
          </button>
        </div>
      </div>

      {/* Mobile FAB */}
      <button className="mob-fab" onClick={() => setCreating(true)} aria-label="Create Journal Entry">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <FiltersBar filters={filters} onChange={setFilters} />

      {/* ── Journal cards ──────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : journals.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 20, border: '.5px solid var(--border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(99,102,241,.08)', border: '.5px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>No journal entries yet</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 320, margin: '0 auto 20px' }}>
            Create your first assessment entry to start entering marks.
          </div>
          <button onClick={() => setCreating(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Journal Entry
          </button>
        </div>
      ) : (
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {journals.map(j => (
            <JournalCard
              key={j.id}
              journal={j}
              subjectName={subjectMap.get(j.subjectId) ?? j.subjectId}
              className={classMap.get(j.classId) ?? j.classId}
              streamName={j.streamId ? (streamMap.get(j.streamId) ?? '—') : 'All'}
              onEnterMarks={() => navigate(`/teacher/exams/${j.id}/marks`)}
              onImportMarks={() => navigate(`/teacher/exams/${j.id}/marks?import=1`)}
            />
          ))}
        </div>
      )}

      {/* ── My Analytics section ───────────────────────────── */}
      {!isLoading && journals.length > 0 && (
        <MyAnalyticsPanel
          journals={journals}
          subjects={subjects}
          classes={classes}
        />
      )}

      {creating && <CreateJournalModal onClose={() => setCreating(false)} />}
    </div>
  )
}
