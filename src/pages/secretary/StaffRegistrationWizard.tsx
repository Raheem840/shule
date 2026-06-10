import { useState, useEffect, useRef } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { useRegisterStaff, useNextStaffNumber } from '../../hooks/useStaff'
import { useClasses, useSubjects, useDepartments } from '../../hooks/useClasses'
import { supabase } from '../../lib/supabase'
import { uploadDocument } from '../../lib/storage'
import { uploadStaffPhoto } from '../../lib/uploadStaffPhoto'
import { validateFile } from '../../lib/fileValidation'
import { useAuth } from '../../store/AuthContext'
import { capitalizeName, normalizeEmail, normalizePhone } from '../../lib/validators'
import type { UserRole } from '../../types/app'

// ── Image compression ─────────────────────────────────────────
async function compressToJpeg(file: File, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img
      const MAX = 800
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h)
        w = Math.round(w * r); h = Math.round(h * r)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
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
    img.src = url
  })
}

// ── Uganda MoES qualification levels (exact spec) ─────────────
export const QUAL_LEVELS = [
  { value: 1, label: 'Certificate in Education (Grade III)' },
  { value: 2, label: 'Diploma in Education (Grade V)' },
  { value: 3, label: 'Bachelor of Education' },
  { value: 4, label: "Bachelor's degree + PGDE" },
  { value: 5, label: "Master's degree in Education" },
  { value: 6, label: "Master's degree (any) + teaching certificate" },
  { value: 7, label: 'PhD / Doctorate' },
]

// ── MoES minimum warning (not a blocker) ─────────────────────
// lower_secondary (levels 1–4) requires qual ≥ 2
// upper_secondary (levels 5–6) requires qual ≥ 3
export function getQualWarning(
  qualLevel: number | null,
  selectedClassIds: string[],
  allClasses: { id: string; level: string | null }[]
): string | null {
  if (!qualLevel || selectedClassIds.length === 0) return null
  const levels = selectedClassIds
    .map(id => allClasses.find(c => c.id === id)?.level)
    .filter(Boolean)
    .map(l => parseInt(l!, 10))

  const hasUpper = levels.some(l => l >= 5)
  const hasLower = levels.some(l => l >= 1 && l <= 4)

  if (hasUpper && qualLevel < 3) {
    return 'This staff member is assigned to Upper Secondary classes (S.5–S.6) but holds below a Bachelor of Education (Level 3). MoES requires Level 3+ for upper secondary teaching.'
  }
  if (hasLower && qualLevel < 2) {
    return 'This staff member is assigned to Lower Secondary classes (S.1–S.4) but holds below a Diploma in Education (Level 2). MoES requires Level 2+ for lower secondary teaching.'
  }
  return null
}

// ── Roles available to Secretary (excludes principal + it_admin)
const STAFF_ROLES: { value: UserRole; label: string }[] = [
  { value: 'deputy',        label: 'Deputy Head' },
  { value: 'dos',           label: 'Director of Studies' },
  { value: 'secretary',     label: 'Secretary' },
  { value: 'bursar',        label: 'Bursar' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'teacher',       label: 'Teacher' },
]

const DOC_TYPES = [
  { value: 'national_id',   label: 'National ID Scan' },
  { value: 'transcript',    label: 'Academic Transcripts' },
  { value: 'teaching_cert', label: 'Teaching Certificate' },
  { value: 'contract',      label: 'Employment Contract' },
  { value: 'other',         label: 'Other' },
]

// ── Zod schema ────────────────────────────────────────────────
const docSchema = z.object({
  documentType: z.string().min(1),
  fileName:     z.string().min(1),
  fileUrl:      z.string().min(1),
})

const schema = z.object({
  isExistingStaff: z.boolean(),
  // Step 1 — Personal
  firstName:   z.string().min(1, 'First name required'),
  lastName:    z.string().min(1, 'Last name required'),
  dateOfBirth: z.string().optional(),
  gender:      z.string().optional(),
  nationality: z.string().optional(),
  nationalId:  z.string().optional(),   // conditionally required via STEP_REQUIRED
  phone:       z.string().optional(),
  email:       z.string().email('Invalid email').or(z.literal('')).optional(),
  address:     z.string().optional(),
  // Step 2 — Professional
  role:           z.string().min(1, 'Role required'),
  staffNumber:    z.string().min(1, 'Staff number required'),
  employmentDate: z.string().optional(),
  employmentType: z.string().optional(),
  departmentId:   z.string().optional(),
  subjects:       z.array(z.string()).default([]),
  classes:        z.array(z.string()).default([]),
  // Step 3 — Qualification
  qualificationLevel: z.number().nullable().optional(),
  qualificationTitle: z.string().optional(),
  institution:        z.string().optional(),
  graduationYear:     z.string().optional(),
  // Step 4 — Documents
  documents: z.array(docSchema).default([]),
})

type FormValues = z.infer<typeof schema>

// ── Props ──────────────────────────────────────────────────────
interface Props {
  open:       boolean
  onClose:    () => void
  onSuccess?: (staffId: string) => void
}

// ── Step indicator ────────────────────────────────────────────
const STEPS_NEW      = ['Basic Info', 'Professional', 'Qualification', 'Documents']
const STEPS_EXISTING = ['Basic Info', 'Role & Submit']

function WizardSteps({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      {steps.map((label, i) => {
        const num = i + 1; const done = num < current; const active = num === current
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div className={done ? 'sui-wstep-done' : active ? 'sui-wstep-active' : 'sui-wstep-pending'}
                style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font2)', flexShrink: 0 }}>
                {done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : num}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'var(--brand)' : done ? 'var(--txt2)' : 'var(--txt3)', fontFamily: 'var(--font2)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={done ? 'sui-wline-done' : 'sui-wline-pending'}
                style={{ flex: 1, height: 2, margin: '0 0.5rem', marginBottom: 22 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Chip multi-select ─────────────────────────────────────────
function ChipSelect({
  label, items, selected, onChange,
}: {
  label:    string
  items:    { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.6rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', minHeight: 44 }}>
        {items.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--txt3)' }}>None available</span>
          : items.map(item => {
              const checked = selected.includes(item.id)
              return (
                <button key={item.id} type="button"
                  onClick={() => onChange(checked ? selected.filter(id => id !== item.id) : [...selected, item.id])}
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`, background: checked ? 'var(--brand-light)' : 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: checked ? 'var(--brand)' : 'var(--txt2)', transition: 'all 0.12s' }}>
                  {item.name}
                </button>
              )
            })}
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────
export function StaffRegistrationWizard({ open, onClose, onSuccess }: Props) {
  const [step,         setStep]         = useState(1)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [uploading,    setUploading]    = useState<Record<number, boolean>>({})
  const [phoneWarning, setPhoneWarning] = useState<string>('')
  // Auth account activation is IT Admin's responsibility — no credential state here
  const photoRef = useRef<HTMLInputElement>(null)

  const { user }               = useAuth()
  const { success: ok, error: err } = useToast()
  const { data: nextNum = '' } = useNextStaffNumber()
  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()
  const { data: depts    = [] } = useDepartments()
  const registerMutation        = useRegisterStaff()

  const { register, control, handleSubmit, formState: { errors },
          trigger, setValue, watch, reset, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      isExistingStaff: false,
      firstName: '', lastName: '', dateOfBirth: '', gender: '',
      nationality: '', nationalId: '', phone: '', email: '', address: '',
      role: '', staffNumber: '', employmentDate: new Date().toISOString().slice(0, 10),
      employmentType: '', departmentId: '', subjects: [], classes: [],
      qualificationLevel: null, qualificationTitle: '', institution: '', graduationYear: '',
      documents: [],
    },
  })

  const { fields: docFields, append: docAppend, remove: docRemove } =
    useFieldArray({ control, name: 'documents' })

  const watchedValues    = useWatch({ control })
  const isExisting       = watchedValues.isExistingStaff ?? false
  const watchedClasses   = watchedValues.classes ?? []
  const watchedQualLevel = watchedValues.qualificationLevel ?? null
  const qualWarn         = getQualWarning(watchedQualLevel, watchedClasses, classes)

  const maxStep = isExisting ? 2 : 4
  const steps   = isExisting ? STEPS_EXISTING : STEPS_NEW

  // Step-required fields differ by mode
  const STEP_REQUIRED: Record<number, (keyof FormValues)[]> = isExisting
    ? {
        1: ['firstName', 'lastName', 'email'],
        2: ['role', 'staffNumber'],
      }
    : {
        1: ['firstName', 'lastName', 'nationalId'],
        2: ['role', 'staffNumber'],
        3: [],
        4: [],
      }

  useEffect(() => {
    if (step === 2 && nextNum && !getValues('staffNumber')) {
      setValue('staffNumber', nextNum)
    }
  }, [step, nextNum])

  useEffect(() => {
    if (!open) { reset(); setStep(1); setPhotoDataUrl(null); setUploading({}); setPhoneWarning('') }
  }, [open])

  // When toggling mode, reset to step 1 so we never land on an invalid step
  function handleModeChange(value: boolean) {
    setValue('isExistingStaff', value)
    setStep(1)
  }

  async function next() {
    const valid = await trigger(STEP_REQUIRED[step] ?? [])
    if (valid) setStep(s => Math.min(maxStep, s + 1))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.target.value = ''
    setPhotoDataUrl(await compressToJpeg(file, 200 * 1024))
  }

  async function handleDocUpload(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const validationError = validateFile(file, 'DOCUMENT')
    if (validationError) { err(validationError); return }
    setUploading(u => ({ ...u, [idx]: true }))
    try {
      const docType = (watch(`documents.${idx}.documentType` as any) as string) || `doc_${idx}`
      const path = await uploadDocument(user!.schoolId, 'temp', docType, file)
      setValue(`documents.${idx}.fileUrl`,  path)
      setValue(`documents.${idx}.fileName`, file.name)
    } catch (e) {
      err((e as Error).message)
    } finally {
      setUploading(u => ({ ...u, [idx]: false }))
    }
  }

  async function onSubmit(values: FormValues) {
    const n = (v?: string) => v?.trim() || null

    registerMutation.mutate({
      firstName:          values.firstName,
      lastName:           values.lastName,
      dateOfBirth:        n(values.dateOfBirth),
      gender:             (values.gender as 'male' | 'female') || null,
      phone:              n(values.phone),
      email:              n(values.email),
      nationalId:         n(values.nationalId),
      photoUrl:           null,   // uploaded below after we have the staffId
      role:               values.role as UserRole,
      staffNumber:        values.staffNumber,
      departmentId:       n(values.departmentId),
      employmentType:     (values.employmentType as 'permanent' | 'contract' | 'volunteer') || null,
      joinDate:           n(values.employmentDate),
      subjects:           values.subjects,
      classes:            values.classes,
      qualificationLevel: values.qualificationLevel ?? null,
      qualificationTitle: n(values.qualificationTitle),
      institution:        n(values.institution),
      graduationYear:     values.graduationYear ? parseInt(values.graduationYear, 10) : null,
      documents:          values.documents.filter(d => d.fileUrl),
    }, {
      onSuccess: async id => {
        // Upload photo via Edge Function — private bucket requires server-side upload
        if (photoDataUrl) {
          try {
            const base64 = photoDataUrl.split(',')[1]
            const binary = atob(base64)
            const ua     = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) ua[i] = binary.charCodeAt(i)
            const photoFile = new File([new Blob([ua], { type: 'image/jpeg' })], 'photo.jpg', { type: 'image/jpeg' })
            const path = await uploadStaffPhoto(photoFile, id)
            await supabase.from('staff').update({ photo_url: path }).eq('id', id).eq('school_id', user!.schoolId)
          } catch { /* non-critical — registration already succeeded */ }
        }

        ok(`${values.firstName} ${values.lastName} registered successfully`)
        onSuccess?.(id)
        // Auth account activation is handled by IT Admin in the Users page
        onClose()
      },
      onError: e => err(e.message),
    })
  }

  const isLoading  = registerMutation.isPending
  const isLastStep = step === maxStep

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register Staff Member"
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? 'Cancel' : '← Back'}
          </Button>
          {!isLastStep
            ? <Button variant="primary" onClick={next}>Continue →</Button>
            : <Button variant="primary" type="submit" form="reg-staff-form" loading={isLoading}>
                {isExisting ? 'Register Staff' : 'Register Staff Member'}
              </Button>
          }
        </div>
      }
    >
      {/* ── Mode toggle — pill segmented control ─────────────── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{
          display: 'flex', padding: '0.25rem',
          background: 'var(--surface2)', borderRadius: 12,
          border: '1px solid var(--border)', gap: '0.25rem',
        }}>
          {/* New Employee */}
          <button
            type="button"
            onClick={() => handleModeChange(false)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
              padding: '0.5rem 0.75rem', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font2)', fontSize: 13, fontWeight: 700, transition: 'all 0.18s',
              background: !isExisting
                ? 'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)'
                : 'transparent',
              color: !isExisting ? '#fff' : 'var(--txt2)',
              boxShadow: !isExisting ? '0 2px 8px rgba(13,148,136,0.25)' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            New Employee
          </button>

          {/* Existing Staff */}
          <button
            type="button"
            onClick={() => handleModeChange(true)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
              padding: '0.5rem 0.75rem', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font2)', fontSize: 13, fontWeight: 700, transition: 'all 0.18s',
              background: isExisting
                ? 'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)'
                : 'transparent',
              color: isExisting ? '#fff' : 'var(--txt2)',
              boxShadow: isExisting ? '0 2px 8px rgba(13,148,136,0.25)' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Existing Staff
          </button>
        </div>

        {/* Context hint for existing staff mode */}
        {isExisting && (
          <div style={{
            marginTop: '0.6rem', padding: '0.5rem 0.75rem',
            background: 'var(--brand-light)', border: '1px solid rgba(13,148,136,0.2)',
            borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>
              Quick 2-step registration for staff already employed at the school. Qualifications and documents can be added later.
            </span>
          </div>
        )}
      </div>

      <WizardSteps current={step} steps={steps} />

      <form id="reg-staff-form" onSubmit={(handleSubmit as any)(onSubmit)}>

        {/* ── STEP 1 — BASIC INFO ────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* Photo upload — new staff only */}
            {!isExisting && (
              <>
                <input ref={photoRef} type="file" accept="image/*" aria-label="Upload staff photo" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <div onClick={() => photoRef.current?.click()}
                  style={{ border: `2px dashed ${photoDataUrl ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', background: photoDataUrl ? 'var(--brand-light)' : 'var(--surface2)', transition: 'all 0.15s' }}>
                  {photoDataUrl ? (
                    <>
                      <img src={photoDataUrl} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Photo ready</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Click to replace</div>
                      </div>
                      <button type="button" onClick={e => { e.stopPropagation(); setPhotoDataUrl(null) }}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)' }}>Upload staff photo</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Uploaded to staff-photos bucket · Max 200KB</div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Name row — always shown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Input
                label="First Name *"
                {...register('firstName')}
                onBlur={e => { const v = capitalizeName(e.target.value); if (v !== e.target.value) setValue('firstName', v) }}
                error={errors.firstName?.message}
                placeholder="e.g. Kigongo"
              />
              <Input
                label="Last Name *"
                {...register('lastName')}
                onBlur={e => { const v = capitalizeName(e.target.value); if (v !== e.target.value) setValue('lastName', v) }}
                error={errors.lastName?.message}
                placeholder="e.g. Nakato"
              />
            </div>

            {/* Existing staff: simplified fields */}
            {isExisting ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Input
                    label="Email *"
                    type="email"
                    {...register('email')}
                    onBlur={e => { const v = normalizeEmail(e.target.value); if (v !== e.target.value) setValue('email', v) }}
                    error={errors.email?.message}
                    placeholder="name@school.ac.ug"
                  />
                  <div>
                    <Input
                      label="Phone"
                      type="tel"
                      {...register('phone')}
                      onBlur={e => {
                        const result = normalizePhone(e.target.value)
                        if (result.normalized !== e.target.value) setValue('phone', result.normalized)
                        setPhoneWarning(result.warning ?? '')
                      }}
                      placeholder="+256 700 000 000"
                    />
                    {phoneWarning && (
                      <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        {phoneWarning}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Select label="Gender" {...register('gender')} placeholder="Select (optional)"
                    options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
                  <Input
                    label="National ID"
                    {...register('nationalId')}
                    onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (v !== e.target.value) setValue('nationalId', v) }}
                    placeholder="Optional — add later"
                  />
                </div>
              </>
            ) : (
              /* New staff: full personal details */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Input label="Date of Birth" type="date" {...register('dateOfBirth')} />
                  <Select label="Gender" {...register('gender')} placeholder="Select"
                    options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Input label="Nationality" {...register('nationality')} placeholder="e.g. Ugandan" />
                  <Input
                    label="National ID Number *"
                    {...register('nationalId')}
                    onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (v !== e.target.value) setValue('nationalId', v) }}
                    error={errors.nationalId?.message}
                    placeholder="CM86010012345XXXX"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <Input
                      label="Phone"
                      type="tel"
                      {...register('phone')}
                      onBlur={e => {
                        const result = normalizePhone(e.target.value)
                        if (result.normalized !== e.target.value) setValue('phone', result.normalized)
                        setPhoneWarning(result.warning ?? '')
                      }}
                      placeholder="+256 700 000 000"
                    />
                    {phoneWarning && (
                      <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        {phoneWarning}
                      </div>
                    )}
                  </div>
                  <Input
                    label="Email"
                    type="email"
                    {...register('email')}
                    onBlur={e => { const v = normalizeEmail(e.target.value); if (v !== e.target.value) setValue('email', v) }}
                    error={errors.email?.message}
                    placeholder="name@school.ac.ug"
                  />
                </div>
                <Input label="Address" {...register('address')} placeholder="e.g. Kampala, Nakawa Division" />
              </>
            )}
          </div>
        )}

        {/* ── STEP 2 — PROFESSIONAL / ROLE & SUBJECTS ────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Role *" {...register('role')} error={errors.role?.message}
                placeholder="Select role" options={STAFF_ROLES} />
              <Input label="Staff Number *" {...register('staffNumber')} error={errors.staffNumber?.message}
                helper="Auto-generated — edit if needed" />
            </div>

            {/* Employment Date shown only for new staff (defaults to today for existing) */}
            {!isExisting ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Input label="Employment Date" type="date" {...register('employmentDate')} />
                <Select label="Employment Type" {...register('employmentType')} placeholder="Select type"
                  options={[
                    { value: 'permanent',  label: 'Permanent' },
                    { value: 'contract',   label: 'Contract' },
                    { value: 'volunteer',  label: 'Volunteer' },
                  ]} />
              </div>
            ) : (
              <Select label="Employment Type" {...register('employmentType')} placeholder="Select type (optional)"
                options={[
                  { value: 'permanent',  label: 'Permanent' },
                  { value: 'contract',   label: 'Contract' },
                  { value: 'volunteer',  label: 'Volunteer' },
                ]} />
            )}

            <Select label="Department" {...register('departmentId')} placeholder="Select department"
              options={depts.filter(d => !d.archived).map(d => ({ value: d.id, label: d.name }))} />

            <ChipSelect
              label="Subjects Taught"
              items={subjects.map(s => ({ id: s.id, name: s.name }))}
              selected={watchedValues.subjects ?? []}
              onChange={ids => setValue('subjects', ids)}
            />
            <ChipSelect
              label="Assigned Classes"
              items={classes.map(c => ({ id: c.id, name: c.name }))}
              selected={watchedValues.classes ?? []}
              onChange={ids => setValue('classes', ids)}
            />
          </div>
        )}

        {/* ── STEP 3 — QUALIFICATION ─────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Level selector */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
                Qualification Level (Uganda MoES)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {QUAL_LEVELS.map(ql => {
                  const selected = watchedQualLevel === ql.value
                  return (
                    <label key={ql.value}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.85rem', border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r)', background: selected ? 'var(--brand-light)' : 'var(--surface2)', cursor: 'pointer', transition: 'all 0.12s' }}>
                      <input type="radio" name="qualLevel" style={{ accentColor: 'var(--brand)', flexShrink: 0 }}
                        checked={selected}
                        onChange={() => setValue('qualificationLevel', ql.value)}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 13, color: selected ? 'var(--brand)' : 'var(--txt3)', minWidth: 18 }}>
                          {ql.value}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? 'var(--brand)' : 'var(--txt2)' }}>
                          {ql.label}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* MoES warning banner — not a blocker */}
            {qualWarn && (
              <div style={{ padding: '0.75rem 1rem', background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--r)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>{qualWarn}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Input label="Qualification Title" {...register('qualificationTitle')}
                placeholder="e.g. Bachelor of Education" />
              <Input label="Year Graduated" type="number" {...register('graduationYear')}
                placeholder={String(new Date().getFullYear())} />
            </div>
            <Input label="Institution / University" {...register('institution')}
              placeholder="e.g. Makerere University" />
          </div>
        )}

        {/* ── STEP 4 — DOCUMENTS ─────────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ padding: '0.75rem 1rem', background: isExisting ? 'var(--info-bg)' : 'var(--surface2)', border: `1px solid ${isExisting ? 'rgba(14,165,233,0.2)' : 'var(--border)'}`, borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--txt2)' }}>
              {isExisting
                ? 'All document uploads are optional for existing staff members.'
                : 'National ID scan is required for new staff. Other documents are optional.'}
            </div>

            {docFields.map((field, idx) => {
              const docType = watch(`documents.${idx}.documentType`)
              const fileUrl = getValues(`documents.${idx}.fileUrl`)
              const isNatId = docType === 'national_id'
              const isRequired = !isExisting && isNatId

              return (
                <div key={field.id} style={{ background: 'var(--surface2)', border: `1px solid ${isRequired && !fileUrl ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                      Document {idx + 1} {isRequired && <span style={{ color: 'var(--danger)' }}>*</span>}
                    </span>
                    <button type="button" onClick={() => docRemove(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                    <Select label="Document Type" {...register(`documents.${idx}.documentType`)}
                      placeholder="Select type" options={DOC_TYPES} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 6 }}>File</div>
                      {fileUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.75rem', background: 'var(--success-bg)', borderRadius: 'var(--r)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getValues(`documents.${idx}.fileName`)}
                          </span>
                        </div>
                      ) : (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', cursor: 'pointer' }}>
                          {uploading[idx]
                            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" style={{ animation: 'shule-spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          }
                          <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600 }}>
                            {uploading[idx] ? 'Uploading…' : 'Choose file'}
                          </span>
                          <input type="file" style={{ display: 'none' }}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={e => handleDocUpload(idx, e)} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {docFields.length < 6 && (
              <button type="button"
                onClick={() => docAppend({ documentType: '', fileName: '', fileUrl: '' })}
                style={{ width: '100%', padding: '0.65rem', border: '2px dashed var(--border)', borderRadius: 'var(--r)', background: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add Document
              </button>
            )}

            {/* IT Admin activates auth accounts from the Users page */}
          </div>
        )}
      </form>
    </Modal>
  )
}
