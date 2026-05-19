import { useState, useEffect, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { useRegisterStaff, useNextStaffNumber } from '../../hooks/useStaff'
import { useClasses, useSubjects, useDepartments } from '../../hooks/useClasses'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import type { UserRole } from '../../types/app'

// ── Image compression (same as student wizard) ────────────────
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

// ── Uganda MoES qualification levels ─────────────────────────
const QUAL_LEVELS = [
  { value: '1', label: 'O-Level Certificate (UCE)' },
  { value: '2', label: 'A-Level Certificate (UACE)' },
  { value: '3', label: 'Certificate (< 2 years)' },
  { value: '4', label: 'Diploma (2+ years)' },
  { value: '5', label: "Bachelor's Degree" },
  { value: '6', label: "Master's Degree" },
  { value: '7', label: 'Doctorate / PhD' },
]

// Minimum qualification for teaching S.5/S.6 (A-Level) is Diploma (4)
function qualWarning(level: number | null, classes: string[], allClasses: { id: string; level: string | null }[]): string | null {
  if (!level || level >= 4) return null
  const teachesALevel = classes.some(cid => {
    const cls = allClasses.find(c => c.id === cid)
    return cls && (cls.level === '5' || cls.level === '6')
  })
  return teachesALevel
    ? 'This qualification is below the minimum (Diploma) required to teach A-Level classes.'
    : null
}

// ── Staff roles ───────────────────────────────────────────────
const STAFF_ROLES: { value: UserRole; label: string }[] = [
  { value: 'principal',     label: 'Principal' },
  { value: 'deputy',        label: 'Deputy Head' },
  { value: 'dos',           label: 'Director of Studies' },
  { value: 'secretary',     label: 'Secretary' },
  { value: 'bursar',        label: 'Bursar' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'teacher',       label: 'Teacher' },
  { value: 'it_admin',      label: 'IT Admin' },
]

// ── Document types ────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'contract',       label: 'Employment Contract' },
  { value: 'national_id',    label: 'National ID Copy' },
  { value: 'certificate',    label: 'Academic Certificate' },
  { value: 'appointment',    label: 'Appointment Letter' },
  { value: 'appraisal',      label: 'Appraisal Record' },
  { value: 'other',          label: 'Other' },
]

// ── Zod schema ────────────────────────────────────────────────
const documentSchema = z.object({
  documentType: z.string().min(1),
  fileName:     z.string().min(1),
  fileUrl:      z.string().min(1),
})

const schema = z.object({
  // Step 1
  firstName:   z.string().min(1, 'First name is required'),
  lastName:    z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  gender:      z.string().optional(),
  phone:       z.string().optional(),
  email:       z.string().email('Invalid email').or(z.literal('')).optional(),
  nationalId:  z.string().optional(),
  // Step 2
  role:           z.string().min(1, 'Role is required'),
  staffNumber:    z.string().min(1, 'Staff number is required'),
  departmentId:   z.string().optional(),
  employmentType: z.string().optional(),
  joinDate:       z.string().optional(),
  subjects:       z.array(z.string()).optional(),
  classes:        z.array(z.string()).optional(),
  // Step 3
  qualificationLevel: z.string().optional(),
  qualificationTitle: z.string().optional(),
  institution:        z.string().optional(),
  graduationYear:     z.string().optional(),
  // Step 4
  documents: z.array(documentSchema).optional(),
})

type FormValues = z.infer<typeof schema>

// ── Props ──────────────────────────────────────────────────────
interface Props {
  open:       boolean
  onClose:    () => void
  onSuccess?: (staffId: string) => void
}

// ── Step indicator ────────────────────────────────────────────
const STEPS = ['Personal', 'Professional', 'Qualification', 'Documents']

function WizardSteps({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: '1.5rem' }}>
      {STEPS.map((label, i) => {
        const num    = i + 1
        const done   = num < current
        const active = num === current
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                className={done ? 'sui-wstep-done' : active ? 'sui-wstep-active' : 'sui-wstep-pending'}
                style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font2)', flexShrink: 0 }}
              >
                {done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : num}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'var(--brand)' : done ? 'var(--txt2)' : 'var(--txt3)', fontFamily: 'var(--font2)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={done ? 'sui-wline-done' : 'sui-wline-pending'}
                style={{ flex: 1, height: 2, margin: '0 0.5rem', marginBottom: 22 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────
export function StaffRegistrationWizard({ open, onClose, onSuccess }: Props) {
  const [step,         setStep]         = useState(1)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [uploading,    setUploading]    = useState<Record<number, boolean>>({})
  const photoRef = useRef<HTMLInputElement>(null)

  const { user }                   = useAuth()
  const { success: ok, error: err} = useToast()
  const { data: nextNum = '' }     = useNextStaffNumber()
  const { data: classes  = [] }    = useClasses()
  const { data: subjects = [] }    = useSubjects()
  const { data: depts    = [] }    = useDepartments()
  const registerMutation            = useRegisterStaff()

  const { register, control, handleSubmit, formState: { errors }, trigger,
          setValue, watch, reset, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '', lastName: '', dateOfBirth: '', gender: '',
      phone: '', email: '', nationalId: '',
      role: '', staffNumber: '', departmentId: '', employmentType: '',
      joinDate: new Date().toISOString().slice(0, 10),
      subjects: [], classes: [],
      qualificationLevel: '', qualificationTitle: '', institution: '', graduationYear: '',
      documents: [],
    },
  })

  const { fields: docFields, append: docAppend, remove: docRemove } =
    useFieldArray({ control, name: 'documents' })

  useEffect(() => {
    if (step === 2 && nextNum && !getValues('staffNumber')) {
      setValue('staffNumber', nextNum)
    }
  }, [step, nextNum])

  useEffect(() => {
    if (!open) { reset(); setStep(1); setPhotoDataUrl(null) }
  }, [open])

  const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
    1: ['firstName', 'lastName'],
    2: ['role', 'staffNumber'],
    3: [],
    4: [],
  }

  async function next() {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep(s => Math.min(4, s + 1))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.target.value = ''
    const dataUrl = await compressToJpeg(file, 200 * 1024)
    setPhotoDataUrl(dataUrl)
  }

  async function handleDocUpload(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(u => ({ ...u, [idx]: true }))
    try {
      const ext  = file.name.split('.').pop()
      const path = `${user!.schoolId}/staff-docs/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage
        .from('staff-documents')
        .upload(path, file, { upsert: false })
      if (upErr) throw upErr
      const url = supabase.storage.from('staff-documents').getPublicUrl(path).data.publicUrl
      setValue(`documents.${idx}.fileUrl`,  url)
      setValue(`documents.${idx}.fileName`, file.name)
    } catch (e) {
      err((e as Error).message)
    } finally {
      setUploading(u => ({ ...u, [idx]: false }))
    }
  }

  async function onSubmit(values: FormValues) {
    const n = (s?: string) => s?.trim() || null

    let photoUrl: string | null = null
    if (photoDataUrl) {
      try {
        const base64 = photoDataUrl.split(',')[1]
        const binary = atob(base64)
        const ua     = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) ua[i] = binary.charCodeAt(i)
        const blob = new Blob([ua], { type: 'image/jpeg' })
        const path = `${user!.schoolId}/staff-photos/${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage
          .from('staff-documents')
          .upload(path, blob, { upsert: true })
        if (!upErr) {
          photoUrl = supabase.storage.from('staff-documents').getPublicUrl(path).data.publicUrl
        }
      } catch { /* register without photo */ }
    }

    registerMutation.mutate({
      firstName:          values.firstName,
      lastName:           values.lastName,
      dateOfBirth:        n(values.dateOfBirth),
      gender:             (values.gender as 'male' | 'female') || null,
      phone:              n(values.phone),
      email:              n(values.email),
      nationalId:         n(values.nationalId),
      photoUrl,
      role:               values.role as UserRole,
      staffNumber:        values.staffNumber,
      departmentId:       n(values.departmentId),
      employmentType:     (values.employmentType as 'permanent' | 'contract' | 'part_time') || null,
      joinDate:           n(values.joinDate),
      subjects:           values.subjects ?? [],
      classes:            values.classes ?? [],
      qualificationLevel: values.qualificationLevel ? parseInt(values.qualificationLevel, 10) : null,
      qualificationTitle: n(values.qualificationTitle),
      institution:        n(values.institution),
      graduationYear:     values.graduationYear ? parseInt(values.graduationYear, 10) : null,
      documents:          (values.documents ?? []).filter(d => d.fileUrl),
    }, {
      onSuccess: id => {
        ok(`${values.firstName} ${values.lastName} registered as ${values.role}`)
        onSuccess?.(id)
        onClose()
      },
      onError: e => err(e.message),
    })
  }

  const watchedClasses = watch('classes') ?? []
  const watchedQualLevel = watch('qualificationLevel')
  const qualWarn = qualWarning(
    watchedQualLevel ? parseInt(watchedQualLevel, 10) : null,
    watchedClasses,
    classes
  )

  const isLoading = registerMutation.isPending

  // ── Render ─────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register New Staff Member"
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? 'Cancel' : '← Back'}
          </Button>
          {step < 4
            ? <Button variant="primary" onClick={next}>Continue →</Button>
            : <Button variant="primary" type="submit" form="reg-staff-form" loading={isLoading}>
                Register Staff Member
              </Button>
          }
        </div>
      }
    >
      <WizardSteps current={step} />
      <form id="reg-staff-form" onSubmit={handleSubmit(onSubmit)}>

        {/* ── STEP 1 — PERSONAL INFO ──────────────────────── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <div
              onClick={() => photoRef.current?.click()}
              style={{ border: `2px dashed ${photoDataUrl ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', background: photoDataUrl ? 'var(--brand-light)' : 'var(--surface2)', transition: 'all 0.15s' }}
            >
              {photoDataUrl ? (
                <>
                  <img src={photoDataUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Photo ready</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>Click to replace</div>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setPhotoDataUrl(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </>
              ) : (
                <>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)' }}>Upload staff photo</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>JPG or PNG · Max 200 KB · Auto-compressed</div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Input label="First Name *" {...register('firstName')} error={errors.firstName?.message} placeholder="e.g. Kigongo" />
              <Input label="Last Name *"  {...register('lastName')}  error={errors.lastName?.message}  placeholder="e.g. Nakato" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Input label="Date of Birth" type="date" {...register('dateOfBirth')} />
              <Select label="Gender" {...register('gender')} placeholder="Select"
                options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Input label="Phone" type="tel" {...register('phone')} placeholder="+256 700 000 000" />
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} placeholder="name@school.ac.ug" />
            </div>

            <Input label="National ID" {...register('nationalId')} placeholder="CM86010012345XXXX" />
          </div>
        )}

        {/* ── STEP 2 — PROFESSIONAL ──────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Role *" {...register('role')} error={errors.role?.message}
                placeholder="Select role" options={STAFF_ROLES} />
              <Input label="Staff Number *" {...register('staffNumber')} error={errors.staffNumber?.message}
                helper="Auto-generated — edit if needed" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Department" {...register('departmentId')}
                placeholder="Select department"
                options={depts.filter(d => !d.archived).map(d => ({ value: d.id, label: d.name }))} />
              <Select label="Employment Type" {...register('employmentType')}
                placeholder="Select"
                options={[
                  { value: 'permanent', label: 'Permanent' },
                  { value: 'contract',  label: 'Contract' },
                  { value: 'part_time', label: 'Part-Time' },
                ]} />
            </div>

            <Input label="Join Date" type="date" {...register('joinDate')} />

            {/* Subject multi-select */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
                Subjects Taught
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.6rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', minHeight: 44 }}>
                {subjects.map(sub => {
                  const checked = (watch('subjects') ?? []).includes(sub.id)
                  return (
                    <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`, background: checked ? 'var(--brand-light)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.12s', fontSize: 12, fontWeight: 700, color: checked ? 'var(--brand)' : 'var(--txt2)' }}>
                      <input type="checkbox" style={{ display: 'none' }}
                        checked={checked}
                        onChange={e => {
                          const cur = watch('subjects') ?? []
                          setValue('subjects', e.target.checked ? [...cur, sub.id] : cur.filter(id => id !== sub.id))
                        }}
                      />
                      {sub.name}
                    </label>
                  )
                })}
                {subjects.length === 0 && <span style={{ fontSize: 12, color: 'var(--txt3)' }}>No subjects available</span>}
              </div>
            </div>

            {/* Class assignment multi-select */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
                Assigned Classes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.6rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', minHeight: 44 }}>
                {classes.map(cls => {
                  const checked = (watch('classes') ?? []).includes(cls.id)
                  return (
                    <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`, background: checked ? 'var(--brand-light)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.12s', fontSize: 12, fontWeight: 700, color: checked ? 'var(--brand)' : 'var(--txt2)' }}>
                      <input type="checkbox" style={{ display: 'none' }}
                        checked={checked}
                        onChange={e => {
                          const cur = watch('classes') ?? []
                          setValue('classes', e.target.checked ? [...cur, cls.id] : cur.filter(id => id !== cls.id))
                        }}
                      />
                      {cls.name}
                    </label>
                  )
                })}
                {classes.length === 0 && <span style={{ fontSize: 12, color: 'var(--txt3)' }}>No classes available</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 — QUALIFICATION ─────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              label="Qualification Level (Uganda MoES)"
              {...register('qualificationLevel')}
              placeholder="Select level"
              options={QUAL_LEVELS}
            />

            {qualWarn && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--r)', fontSize: 12.5, color: '#92400e', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {qualWarn}
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

            {/* Visual qualification scale */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', letterSpacing: '0.5px', marginBottom: 10, fontFamily: 'var(--font2)' }}>MoES QUALIFICATION SCALE</div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {QUAL_LEVELS.map((ql, i) => {
                  const level     = i + 1
                  const selected  = parseInt(watch('qualificationLevel') ?? '0', 10) === level
                  const isCurrent = selected
                  return (
                    <div key={level} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ height: 6, borderRadius: 3, background: isCurrent ? 'var(--brand)' : level <= parseInt(watch('qualificationLevel') ?? '0', 10) ? 'var(--brand-light)' : 'var(--border)', transition: 'all 0.2s' }} />
                      <div style={{ fontSize: 9, fontWeight: 800, color: isCurrent ? 'var(--brand)' : 'var(--txt3)', marginTop: 4, fontFamily: 'var(--font2)' }}>{level}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 8 }}>
                Level 4+ required for A-Level classes · Level 5+ recommended for Heads of Department
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4 — DOCUMENTS ─────────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
              Upload supporting documents. All are optional — they can be added later from the staff profile.
            </p>

            {docFields.map((field, idx) => (
              <div key={field.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                    Document {idx + 1}
                  </span>
                  <button type="button" onClick={() => docRemove(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Select label="Document Type" {...register(`documents.${idx}.documentType`)}
                    placeholder="Select type" options={DOC_TYPES} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)' }}>
                      File
                    </label>
                    {getValues(`documents.${idx}.fileUrl`) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.75rem', background: 'var(--success-bg)', borderRadius: 'var(--r)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getValues(`documents.${idx}.fileName`)}
                        </span>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', cursor: 'pointer' }}>
                        {uploading[idx]
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" style={{ animation: 'shule-spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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
            ))}

            {docFields.length < 5 && (
              <button type="button"
                onClick={() => docAppend({ documentType: '', fileName: '', fileUrl: '' })}
                style={{ width: '100%', padding: '0.65rem', border: '2px dashed var(--border)', borderRadius: 'var(--r)', background: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'color 0.15s, border-color 0.15s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add Document
              </button>
            )}

            <div style={{ padding: '0.75rem 1rem', background: 'var(--info-bg)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--txt2)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              IT Admin will create the login credentials separately. The staff member will receive their password once their account is activated.
            </div>
          </div>
        )}

      </form>
    </Modal>
  )
}
