import { useState, useEffect, useRef } from 'react'
import { useForm, useWatch, useFieldArray } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { useRegisterStudent, useNextAdmissionNumber } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { supabase } from '../../lib/supabase'
import { uploadFile, BUCKETS } from '../../lib/storage'
import { useAuth } from '../../store/AuthContext'
import type { Class, Stream } from '../../types/app'

// ── Image compression ─────────────────────────────────────────
async function compressToJpeg(file: File, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { naturalWidth: w, naturalHeight: h } = img
      const MAX = 800
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h)
        w = Math.round(w * r)
        h = Math.round(h * r)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      let q = 0.85
      let result = canvas.toDataURL('image/jpeg', q)
      while (result.length * 0.75 > maxBytes && q > 0.15) {
        q = Math.max(0.15, q - 0.1)
        result = canvas.toDataURL('image/jpeg', q)
      }
      resolve(result)
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

// ── School prefix hook ────────────────────────────────────────
function useSchoolPrefix() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['school-prefix', user?.schoolId],
    enabled: !!user?.schoolId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from('school_profile')
        .select('short_name')
        .eq('id', user!.schoolId)
        .single()
      return (data?.short_name as string | null) ?? 'STU'
    },
  })
}

// ── Zod schemas ───────────────────────────────────────────────
export const guardianSchema = z.object({
  guardianName:    z.string().min(1, 'Full name is required'),
  relationship:    z.string().min(1, 'Relationship is required'),
  phone:           z.string().min(7, 'Valid phone number required'),
  email:           z.string().optional(),
  isPrimary:       z.boolean(),
  doNotContact:    z.boolean(),
  commsPreference: z.enum(['sms', 'whatsapp', 'both']),
})

export const wizardSchema = z.object({
  firstName:       z.string().min(1, 'First name is required'),
  lastName:        z.string().min(1, 'Last name is required'),
  dateOfBirth:     z.string().optional(),
  gender:          z.string().optional(),
  nationality:     z.string().optional(),
  religion:        z.string().optional(),
  medicalNotes:    z.string().optional(),
  admissionNumber: z.string().min(1, 'Admission number is required'),
  classId:         z.string().min(1, 'Class is required'),
  streamId:        z.string().optional(),
  studentType:     z.string().optional(),
  previousSchool:  z.string().optional(),
  enrolledAt:      z.string().min(1, 'Enrolment date is required'),
  guardians:       z.array(guardianSchema).min(1, 'At least one guardian is required'),
})

type FormValues = z.infer<typeof wizardSchema>

// ── Props ──────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: (studentId: string) => void
}

// ── Step indicator ────────────────────────────────────────────
const STEP_LABELS = ['Personal Info', 'Placement', 'Guardians']

function WizardSteps({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: '1.25rem' }}>
      {STEP_LABELS.map((label, i) => {
        const num  = i + 1
        const done = num < current
        const active = num === current
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                className={done ? 'sui-wstep-done' : active ? 'sui-wstep-active' : 'sui-wstep-pending'}
                style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font2)', flexShrink: 0 }}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : num}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'var(--brand)' : done ? 'var(--txt2)' : 'var(--txt3)', fontFamily: 'var(--font2)', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={done ? 'sui-wline-done' : 'sui-wline-pending'}
                style={{ flex: 1, height: 2, margin: '0 0.5rem', marginBottom: 22 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Live preview card ─────────────────────────────────────────
const AVATAR_COLORS = ['#0d9488','#8b5cf6','#f59e0b','#f43f5e','#0ea5e9','#10b981']

function PreviewCard({ control, classes, streams, photoPreview }: {
  control: Control<FormValues>
  classes: Class[]
  streams: Stream[]
  photoPreview: string | null
}) {
  const v         = useWatch({ control })
  const firstName = v.firstName ?? ''
  const lastName  = v.lastName  ?? ''
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'Student Name'
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || '?'
  const avatarBg  = AVATAR_COLORS[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
  const cls       = classes.find(c => c.id === v.classId)
  const stream    = streams.find(s => s.id === v.streamId)

  return (
    <div style={{ position: 'sticky', top: 0 }}>
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
        {photoPreview ? (
          <img src={photoPreview} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand)', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', flexShrink: 0 }}>
            {initials}
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            {fullName}
          </div>
          {v.admissionNumber && (
            <div style={{ fontFamily: 'var(--font3)', fontSize: 11, color: 'var(--brand)', marginTop: 3 }}>
              {v.admissionNumber}
            </div>
          )}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cls && (
            <Row label="Class">
              {stream ? `${cls.name} ${stream.name}` : cls.name}
            </Row>
          )}
          {v.studentType && (
            <Row label="Type">
              <Badge variant={v.studentType === 'boarder' ? 'violet' : 'teal'}>
                {v.studentType === 'boarder' ? 'Boarder' : 'Day Scholar'}
              </Badge>
            </Row>
          )}
          {v.gender && (
            <Row label="Gender">
              <span style={{ textTransform: 'capitalize' }}>{v.gender}</span>
            </Row>
          )}
          {v.enrolledAt && (
            <Row label="Enrolled">
              {new Date(v.enrolledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Row>
          )}
          {v.guardians?.some(g => g.guardianName) && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--txt3)', letterSpacing: '0.8px', marginBottom: 6, fontFamily: 'var(--font2)' }}>
                GUARDIANS
              </div>
              {v.guardians.filter(g => g.guardianName).map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)' }}>{g.guardianName}</span>
                  {g.isPrimary && <Badge variant="teal" style={{ fontSize: 9 }}>Primary</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 700 }}>{children}</span>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────
export function StudentRegistrationWizard({ open, onClose, onSuccess }: Props) {
  const [step,         setStep]         = useState(1)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const { user }               = useAuth()
  const { success: ok, error: err } = useToast()
  const year                   = new Date().getFullYear()
  const { data: nextSeq }      = useNextAdmissionNumber(year)
  const { data: prefix = 'STU' } = useSchoolPrefix()
  const { data: classes = [] } = useClasses()
  const registerMutation        = useRegisterStudent()

  const methods = useForm<FormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      firstName: '', lastName: '', dateOfBirth: '', gender: '', nationality: '',
      religion: '', medicalNotes: '', admissionNumber: '', classId: '', streamId: '',
      studentType: '', previousSchool: '', enrolledAt: new Date().toISOString().slice(0, 10),
      guardians: [{ guardianName: '', relationship: '', phone: '', email: '', isPrimary: true, doNotContact: false, commsPreference: 'sms' }],
    },
  })

  const { register, control, handleSubmit, formState: { errors }, trigger, setValue, watch, getValues } = methods
  const watchedClassId = watch('classId')
  const { data: streams = [] } = useStreams(watchedClassId || null)
  const { fields: gFields, append: gAppend, remove: gRemove } = useFieldArray({ control, name: 'guardians' })

  useEffect(() => {
    if (step === 2 && nextSeq && prefix && !getValues('admissionNumber')) {
      setValue('admissionNumber', `${prefix}/${year}/${String(nextSeq).padStart(4, '0')}`)
    }
  }, [step, nextSeq, prefix])

  useEffect(() => {
    if (!open) {
      methods.reset()
      setStep(1)
      setPhotoDataUrl(null)
      setSubmitting(false)
    }
  }, [open])

  const STEP_REQUIRED: Record<number, (keyof FormValues)[]> = {
    1: ['firstName', 'lastName'],
    2: ['admissionNumber', 'classId', 'enrolledAt'],
    3: ['guardians'],
  }

  async function next() {
    const valid = await trigger(STEP_REQUIRED[step] as (keyof FormValues)[])
    if (valid) setStep(s => Math.min(3, s + 1))
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    let photoUrl: string | null = null

    if (photoDataUrl) {
      try {
        const base64 = photoDataUrl.split(',')[1]
        const binary = atob(base64)
        const ua     = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) ua[i] = binary.charCodeAt(i)
        const blob = new Blob([ua], { type: 'image/jpeg' })
        const path = `${user!.schoolId}/${Date.now()}.jpg`
        // Store path (not public URL) — student-photos is private, display via signed URL
        photoUrl = await uploadFile(BUCKETS.STUDENT_PHOTOS, path, blob, { upsert: true })
      } catch { /* register without photo */ }
    }

    setSubmitting(false)
    const n = (s?: string) => s?.trim() || null

    registerMutation.mutate({
      firstName:       values.firstName,
      lastName:        values.lastName,
      dob:             n(values.dateOfBirth),
      gender:          (values.gender as 'male' | 'female') || null,
      nationality:     n(values.nationality),
      religion:        n(values.religion),
      medicalNotes:    n(values.medicalNotes),
      photoUrl,
      admissionNumber: values.admissionNumber,
      classId:         values.classId,
      streamId:        n(values.streamId),
      studentType:     (values.studentType as 'day' | 'boarder') || null,
      previousSchool:  n(values.previousSchool),
      enrolledAt:      values.enrolledAt,
      guardians: values.guardians.map(g => ({
        guardianName:    g.guardianName,
        relationship:    g.relationship,
        phone:           g.phone,
        email:           g.email?.trim() || null,
        isPrimary:       g.isPrimary,
        doNotContact:    g.doNotContact,
        commsPreference: g.commsPreference,
      })),
    }, {
      onSuccess: id => {
        ok(`${values.firstName} ${values.lastName} registered successfully`)
        onSuccess?.(id)
        onClose()
      },
      onError: e => err(e.message),
    })
  }

  function onInvalid(errs: FieldErrors<FormValues>) {
    const keys = Object.keys(errs)
    const s1   = ['firstName','lastName','dateOfBirth','gender','nationality','religion','medicalNotes']
    const s2   = ['admissionNumber','classId','streamId','studentType','previousSchool','enrolledAt']
    if (keys.some(k => s1.includes(k))) setStep(1)
    else if (keys.some(k => s2.includes(k))) setStep(2)
    else setStep(3)
  }

  function makePrimary(idx: number) {
    gFields.forEach((_, i) => setValue(`guardians.${i}.isPrimary`, i === idx))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.target.value = ''
    const dataUrl = await compressToJpeg(file, 200 * 1024)
    setPhotoDataUrl(dataUrl)
  }

  const isLoading = registerMutation.isPending || submitting

  // ── Render ─────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register New Student"
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? 'Cancel' : '← Back'}
          </Button>
          {step < 3 ? (
            <Button variant="primary" onClick={next}>Continue →</Button>
          ) : (
            <Button variant="primary" type="submit" form="reg-student-form" loading={isLoading}>
              Register Student
            </Button>
          )}
        </div>
      }
    >
      <WizardSteps current={step} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: '1.5rem' }}>
        {/* ── Form ─────────────────────────────────────────── */}
        <form id="reg-student-form" onSubmit={handleSubmit(onSubmit, onInvalid)}>

          {/* STEP 1 — PERSONAL INFO */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Photo upload zone */}
              <input ref={photoInputRef} type="file" accept="image/*" aria-label="Upload student photo" style={{ display: 'none' }} onChange={handlePhotoChange} />
              <div
                onClick={() => photoInputRef.current?.click()}
                style={{
                  border: `2px dashed ${photoDataUrl ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-lg)',
                  padding: '1.5rem 1.25rem',
                  cursor: 'pointer',
                  background: photoDataUrl ? 'var(--brand-light)' : 'var(--surface2)',
                  transition: 'border-color 0.18s, background 0.18s',
                  textAlign: 'center',
                }}
              >
                {photoDataUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={photoDataUrl} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand)', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Photo uploaded</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>Click anywhere to replace</div>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPhotoDataUrl(null) }}
                      style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.25)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="1.4" stroke="var(--txt3)">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)' }}>Click to upload a photo</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>JPG or PNG — auto-compressed to 200 KB</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', padding: '3px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20 }}>
                      Optional
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Input label="First Name *" {...register('firstName')} error={errors.firstName?.message} placeholder="e.g. Amara" />
                <Input label="Last Name *"  {...register('lastName')}  error={errors.lastName?.message}  placeholder="e.g. Nakato" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Input label="Date of Birth" type="date" {...register('dateOfBirth')} error={errors.dateOfBirth?.message} />
                <Select
                  label="Gender"
                  {...register('gender')}
                  error={errors.gender?.message}
                  placeholder="Select gender"
                  options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Input label="Nationality" {...register('nationality')} placeholder="e.g. Ugandan" />
                <Input label="Religion"    {...register('religion')}    placeholder="e.g. Christian" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)' }}>
                  Medical Notes
                </label>
                <textarea
                  {...register('medicalNotes')}
                  rows={3}
                  placeholder="Allergies, conditions, special needs…"
                  style={{ width: '100%', padding: '0.55rem 0.85rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 12.5, fontFamily: 'var(--font1)', color: 'var(--txt)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* STEP 2 — ACADEMIC PLACEMENT */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Admission Number *"
                {...register('admissionNumber')}
                error={errors.admissionNumber?.message}
                helper="Auto-generated — edit if needed"
                leftIcon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
              />

              <Input label="Enrolment Date *" type="date" {...register('enrolledAt')} error={errors.enrolledAt?.message} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Select
                  label="Class *"
                  {...register('classId')}
                  error={errors.classId?.message}
                  placeholder="Select class"
                  options={classes.map(c => ({ value: c.id, label: c.name }))}
                />
                <Select
                  label="Stream"
                  {...register('streamId')}
                  placeholder={watchedClassId ? (streams.length ? 'Select stream' : 'No streams') : 'Choose class first'}
                  disabled={!watchedClassId || streams.length === 0}
                  options={streams.map(s => ({ value: s.id, label: s.name }))}
                />
              </div>

              {/* Student type radio cards */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
                  Student Type
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {(['day', 'boarder'] as const).map(type => {
                    const checked = watch('studentType') === type
                    return (
                      <label key={type} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.9rem', border: `2px solid ${checked ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r)', background: checked ? 'var(--brand-light)' : 'var(--surface2)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <input type="radio" value={type} {...register('studentType')} style={{ accentColor: 'var(--brand)' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: checked ? 'var(--brand)' : 'var(--txt2)' }}>
                          {type === 'day' ? 'Day Scholar' : 'Boarder'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <Input label="Previous School" {...register('previousSchool')} placeholder="Name of previous school (optional)" />
            </div>
          )}

          {/* STEP 3 — GUARDIANS */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {gFields.map((field, idx) => {
                const isPrimary = watch(`guardians.${idx}.isPrimary`)
                const commsPref = watch(`guardians.${idx}.commsPreference`)
                const isDNC     = watch(`guardians.${idx}.doNotContact`)

                return (
                  <div key={field.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-sm)' }}>

                    {/* Card header strip */}
                    <div style={{
                      padding: '0.7rem 1rem',
                      background: isPrimary ? 'rgba(13,148,136,0.06)' : 'var(--surface2)',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: isPrimary ? 'var(--brand)' : 'var(--surface)',
                          border: isPrimary ? 'none' : '1.5px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 900, fontFamily: 'var(--font2)',
                          color: isPrimary ? '#fff' : 'var(--txt3)',
                        }}>
                          {idx + 1}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                          Guardian {idx + 1}
                        </span>
                        {isPrimary && <Badge variant="teal">Primary contact</Badge>}
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {!isPrimary && (
                          <button
                            type="button" onClick={() => makePrimary(idx)}
                            style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-light)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: 6, cursor: 'pointer', padding: '3px 9px', fontFamily: 'var(--font2)' }}
                          >
                            Set primary
                          </button>
                        )}
                        {idx > 0 && (
                          <button
                            type="button" onClick={() => gRemove(idx)}
                            style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fields */}
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <Input label="Full Name *" {...register(`guardians.${idx}.guardianName`)} error={errors.guardians?.[idx]?.guardianName?.message} placeholder="Guardian's full name" />
                        <Select
                          label="Relationship *"
                          {...register(`guardians.${idx}.relationship`)}
                          error={errors.guardians?.[idx]?.relationship?.message}
                          placeholder="Select"
                          options={[
                            { value: 'mother',      label: 'Mother' },
                            { value: 'father',      label: 'Father' },
                            { value: 'aunt',        label: 'Aunt' },
                            { value: 'uncle',       label: 'Uncle' },
                            { value: 'grandparent', label: 'Grandparent' },
                            { value: 'sibling',     label: 'Sibling' },
                            { value: 'guardian',    label: 'Legal Guardian' },
                            { value: 'other',       label: 'Other' },
                          ]}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <Input label="Phone *" type="tel" {...register(`guardians.${idx}.phone`)} error={errors.guardians?.[idx]?.phone?.message} placeholder="+256 700 000 000" />
                        <Input label="Email"   type="email" {...register(`guardians.${idx}.email`)} error={errors.guardians?.[idx]?.email?.message} placeholder="guardian@email.com" />
                      </div>

                      {/* Comms preference — icon chips */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
                          Contact via
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {([
                            { value: 'sms',      label: 'SMS',
                              icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.79 19.79 19.79 0 0 1 1.61 1.17 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.61 5.61l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
                            { value: 'whatsapp', label: 'WhatsApp',
                              icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                            { value: 'both',     label: 'Both',
                              icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
                          ] as const).map(opt => {
                            const checked = commsPref === opt.value
                            return (
                              <label key={opt.value} style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                padding: '0.5rem 0.5rem',
                                border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`,
                                borderRadius: 'var(--r)',
                                background: checked ? 'var(--brand-light)' : 'var(--surface2)',
                                color: checked ? 'var(--brand)' : 'var(--txt2)',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}>
                                <input type="radio" value={opt.value} {...register(`guardians.${idx}.commsPreference`)} style={{ display: 'none' }} />
                                {opt.icon}
                                <span style={{ fontSize: 11.5, fontWeight: 700 }}>{opt.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      {/* Do Not Contact toggle */}
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        padding: '0.6rem 0.85rem',
                        background: isDNC ? 'var(--danger-bg)' : 'var(--surface2)',
                        border: `1px solid ${isDNC ? 'rgba(244,63,94,0.25)' : 'var(--border)'}`,
                        borderRadius: 'var(--r)', transition: 'all 0.15s',
                      }}>
                        <input type="checkbox" {...register(`guardians.${idx}.doNotContact`)} style={{ accentColor: 'var(--danger)', width: 14, height: 14, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isDNC ? 'var(--danger)' : 'var(--txt2)' }}>
                            Do Not Contact
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                            Exclude from fee reminders and bulk SMS
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )
              })}

              {gFields.length < 2 && (
                <button
                  type="button"
                  onClick={() => gAppend({ guardianName: '', relationship: '', phone: '', email: '', isPrimary: false, doNotContact: false, commsPreference: 'sms' })}
                  style={{ width: '100%', padding: '0.75rem', border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)', background: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'color 0.15s, border-color 0.15s' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                  Add Second Guardian
                </button>
              )}
            </div>
          )}
        </form>

        {/* ── Preview card ────────────────────────────────── */}
        <PreviewCard
          control={control}
          classes={classes}
          streams={streams}
          photoPreview={photoDataUrl}
        />
      </div>
    </Modal>
  )
}
