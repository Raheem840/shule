import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

export type MyProfile = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  role: string
  staffNumber: string | null
  photoUrl: string | null
  departmentName: string | null
  schoolName: string | null
}

// ── useMyProfile ───────────────────────────────────────────────────────────
export function useMyProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-profile', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyProfile> => {
      const sid = user!.schoolId

      const [staffRes, schoolRes] = await Promise.all([
        supabase
          .from('staff')
          .select('id, first_name, last_name, email, phone, role, staff_number, photo_url, department_id')
          .eq('school_id', sid)
          .eq('auth_user_id', user!.id)
          .single(),
        supabase
          .from('school_profile')
          .select('school_name')
          .eq('id', sid)
          .maybeSingle(),
      ])

      if (staffRes.error) throw new Error(staffRes.error.message)
      const row = staffRes.data

      let departmentName: string | null = null
      if (row.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('name')
          .eq('id', row.department_id)
          .maybeSingle()
        departmentName = dept?.name ?? null
      }

      return {
        id:             row.id,
        firstName:      row.first_name,
        lastName:       row.last_name,
        email:          row.email,
        phone:          row.phone,
        role:           row.role,
        staffNumber:    row.staff_number,
        photoUrl:       row.photo_url,
        departmentName,
        schoolName:     schoolRes.data?.school_name ?? null,
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
    mutationFn: async (updates: { phone?: string; email?: string }) => {
      if (!user) throw new Error('Not authenticated')

      // Find staff row
      const { data: staffRow, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (staffErr || !staffRow) throw new Error('Staff record not found')

      const dbUpdates: Record<string, string> = {}
      if (updates.phone != null) dbUpdates['phone'] = updates.phone
      if (updates.email != null) dbUpdates['email'] = updates.email

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from('staff')
          .update(dbUpdates)
          .eq('id', staffRow.id)
          .eq('school_id', user.schoolId)
        if (error) throw new Error(error.message)
      }

      // Update Supabase Auth email if changed
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

// ── useUpdateProfilePhoto ──────────────────────────────────────────────────
export function useUpdateProfilePhoto() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated')

      // Get staff row to get the ID for the path
      const { data: staffRow, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (staffErr || !staffRow) throw new Error('Staff record not found')

      // Compress via Canvas if > 200KB
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
