import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { uploadStaffPhoto } from '../lib/uploadStaffPhoto'
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
            'employment_type', 'qualification_level',
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
// Staff submits a desired-password request via the notifications table.
// This notifies the IT admin's bell AND appears in PasswordResetsPage.
export function useRequestPasswordReset() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ staffName, desiredPassword }: { staffName: string; desiredPassword: string }) => {
      if (!user) throw new Error('Not authenticated')

      // Find all IT admin auth_user_ids for this school
      const { data: admins, error: adminErr } = await supabase
        .from('staff')
        .select('auth_user_id')
        .eq('school_id', user.schoolId)
        .eq('role', 'it_admin')
        .not('auth_user_id', 'is', null)

      if (adminErr) throw new Error(adminErr.message)
      if (!admins || admins.length === 0) {
        throw new Error('No IT Admin account found. Contact your school administrator directly.')
      }

      const rows = admins.map((a: any) => ({
        school_id:   user.schoolId,
        user_id:     a.auth_user_id as string,
        from_user:   user.id,
        type:        'system',
        title:       'Password Reset Request',
        body:        `${staffName} wants to change their password. New password: ${desiredPassword}`,
        target_role: 'it_admin',
        read:        false,
        read_at:     null,
      }))

      const { error } = await supabase.from('notifications').insert(rows)
      if (error) throw new Error(error.message)
    },
  })
}

// ── usePasswordResetRequests ───────────────────────────────────────────────
// IT admin reads unread system notifications that are password reset requests.
export function usePasswordResetRequests() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['pwd-reset-requests', user?.schoolId, user?.id],
    enabled:  !!user && user.role === 'it_admin',
    staleTime: 0,
    queryFn: async (): Promise<PasswordResetRequest[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, from_user, created_at')
        .eq('school_id', user!.schoolId)
        .eq('user_id', user!.id)
        .eq('type', 'system')
        .ilike('title', 'Password Reset%')
        .is('read_at', null)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any) => {
        const body: string = r.body ?? ''
        const nameMatch = body.match(/^(.+?) wants to change/)
        const pwdMatch  = body.match(/New password: (.+)$/)
        return {
          id:              r.id as string,
          staffName:       nameMatch?.[1] ?? 'Unknown',
          authUserId:      (r.from_user as string) ?? '',
          requestedAt:     r.created_at as string,
          desiredPassword: pwdMatch?.[1] ?? '',
        }
      })
    },
  })
}

// ── useApprovePasswordReset ────────────────────────────────────────────────
// IT admin marks request notification as read (done).
export function useApprovePasswordReset() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('school_id', user!.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pwd-reset-requests'] })
      void qc.invalidateQueries({ queryKey: ['notifications'] })
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

      // Upload via Edge Function — never call storage directly for private buckets
      const path = await uploadStaffPhoto(uploadFile, staffRow.id)

      const { error: dbErr } = await supabase
        .from('staff')
        .update({ photo_url: path })
        .eq('id', staffRow.id)
        .eq('school_id', user.schoolId)

      if (dbErr) throw new Error(dbErr.message)
      return path
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-profile', user?.id] })
    },
  })
}
