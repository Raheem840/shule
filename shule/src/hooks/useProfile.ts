import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

export type PasswordResetRequest = {
  id: string
  staffName: string
  authUserId: string
  requestedAt: string
  desiredPassword: string
}

export type MyProfile = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address: string | null
  role: string
  staffNumber: string | null
  photoUrl: string | null
  departmentName: string | null
  schoolName: string | null
  employmentType: string | null
  qualificationLevel: number | null
  salaryBand: string | null
  joinDate: string | null
  isActive: boolean
  lastSignInAt: string | null
}

// ── useMyProfile ───────────────────────────────────────────────────────────
export function useMyProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-profile', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyProfile> => {
      const sid = user!.schoolId

      const [staffRes, schoolRes, sessionRes] = await Promise.all([
        supabase
          .from('staff')
          .select([
            'id', 'first_name', 'last_name', 'email', 'phone', 'address',
            'role', 'staff_number', 'photo_url', 'department_id',
            'employment_type', 'qualification_level', 'salary_band',
            'join_date', 'is_active',
          ].join(', '))
          .eq('school_id', sid)
          .eq('auth_user_id', user!.id)
          .single(),
        supabase
          .from('school_profile')
          .select('school_name')
          .eq('id', sid)
          .maybeSingle(),
        supabase.auth.getSession(),
      ])

      if (staffRes.error) throw new Error(staffRes.error.message)
      const row = staffRes.data as unknown as Record<string, unknown>

      let departmentName: string | null = null
      if (row['department_id']) {
        const { data: dept } = await supabase
          .from('departments')
          .select('name')
          .eq('id', row['department_id'] as string)
          .maybeSingle()
        departmentName = dept?.name ?? null
      }

      return {
        id:                 row['id'] as string,
        firstName:          row['first_name'] as string,
        lastName:           row['last_name'] as string,
        email:              (row['email'] as string | null) ?? null,
        phone:              (row['phone'] as string | null) ?? null,
        address:            (row['address'] as string | null) ?? null,
        role:               row['role'] as string,
        staffNumber:        (row['staff_number'] as string | null) ?? null,
        photoUrl:           (row['photo_url'] as string | null) ?? null,
        departmentName,
        schoolName:         schoolRes.data?.school_name ?? null,
        employmentType:     (row['employment_type'] as string | null) ?? null,
        qualificationLevel: (row['qualification_level'] as number | null) ?? null,
        salaryBand:         (row['salary_band'] as string | null) ?? null,
        joinDate:           (row['join_date'] as string | null) ?? null,
        isActive:           (row['is_active'] as boolean | null) ?? true,
        lastSignInAt:       sessionRes.data.session?.user.last_sign_in_at ?? null,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useUpdateProfile ───────────────────────────────────────────────────────
export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (updates: { phone?: string | null; email?: string | null; address?: string | null }) => {
      if (!user) throw new Error('Not authenticated')

      const { data: staffRow, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (staffErr || !staffRow) throw new Error('Staff record not found')

      const dbUpdates: Record<string, unknown> = {}
      if (updates.phone   !== undefined) dbUpdates['phone']   = updates.phone   ?? null
      if (updates.address !== undefined) dbUpdates['address'] = updates.address ?? null
      if (updates.email   !== undefined) dbUpdates['email']   = updates.email   ?? null

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from('staff')
          .update(dbUpdates)
          .eq('id', staffRow.id)
          .eq('school_id', user.schoolId)
        if (error) throw new Error(error.message)
      }

      if (updates.email != null) {
        const { error: authErr } = await supabase.auth.updateUser({ email: updates.email })
        if (authErr) throw new Error(authErr.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-profile', user?.id] })
    },
  })
}

// ── useChangePassword ──────────────────────────────────────────────────────
export function useChangePassword() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error(error.message)
    },
  })
}

// ── useRequestPasswordReset ────────────────────────────────────────────────
// Staff submits a desired-password request that lands in send_queue.
// IT admin reads and approves it from PasswordResetsPage.
export function useRequestPasswordReset() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ staffName, desiredPassword }: { staffName: string; desiredPassword: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('send_queue').insert({
        school_id: user.schoolId,
        type:      'password_reset_request',
        payload:   {
          auth_user_id:     user.id,
          staff_name:       staffName,
          desired_password: desiredPassword,
          requested_at:     new Date().toISOString(),
        },
        status: 'pending',
      })
      if (error) throw new Error(error.message)
    },
  })
}

// ── usePasswordResetRequests ───────────────────────────────────────────────
// IT admin reads pending password-reset requests.
export function usePasswordResetRequests() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['pwd-reset-requests', user?.schoolId],
    enabled:  !!user && user.role === 'it_admin',
    staleTime: 0,
    queryFn: async (): Promise<PasswordResetRequest[]> => {
      const { data, error } = await supabase
        .from('send_queue')
        .select('id, payload, queued_at')
        .eq('school_id', user!.schoolId)
        .eq('type', 'password_reset_request')
        .eq('status', 'pending')
        .order('queued_at', { ascending: false })

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any) => ({
        id:              r.id,
        staffName:       (r.payload as any).staff_name       ?? 'Unknown',
        authUserId:      (r.payload as any).auth_user_id     ?? '',
        requestedAt:     (r.payload as any).requested_at     ?? r.queued_at,
        desiredPassword: (r.payload as any).desired_password ?? '',
      }))
    },
  })
}

// ── useApprovePasswordReset ────────────────────────────────────────────────
// IT admin marks request as done (manual approval — password changed in Supabase).
export function useApprovePasswordReset() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('send_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('school_id', user!.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pwd-reset-requests', user?.schoolId] })
    },
  })
}

// ── useUpdateProfilePhoto ──────────────────────────────────────────────────
export function useUpdateProfilePhoto() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated')

      const { data: staffRow, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (staffErr || !staffRow) throw new Error('Staff record not found')

      let uploadFile = file
      if (file.size > 200_000) {
        const canvas = document.createElement('canvas')
        const img    = new Image()
        img.src = URL.createObjectURL(file)
        await new Promise(res => { img.onload = res })
        const scale  = Math.sqrt(200_000 / file.size)
        canvas.width  = img.width  * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85))
        if (blob) uploadFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
      }

      const path = `staff-photos/${user.schoolId}/${staffRow.id}.jpg`
      const { error: upErr } = await supabase.storage
        .from('staff-photos')
        .upload(path, uploadFile, { upsert: true, contentType: 'image/jpeg' })

      if (upErr) throw new Error(upErr.message)

      const { data: urlData } = supabase.storage.from('staff-photos').getPublicUrl(path)
      const photoUrl = urlData.publicUrl

      const { error: dbErr } = await supabase
        .from('staff')
        .update({ photo_url: photoUrl })
        .eq('id', staffRow.id)
        .eq('school_id', user.schoolId)

      if (dbErr) throw new Error(dbErr.message)
      return photoUrl
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-profile', user?.id] })
    },
  })
}
