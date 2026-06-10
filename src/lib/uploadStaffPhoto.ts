import { supabase } from './supabase'

/**
 * Upload a staff photo via the Edge Function so we never need the
 * service role key on the frontend. Returns the storage PATH (not a URL).
 * Save this path to staff.photo_url so signed URLs can be generated later.
 */
export async function uploadStaffPhoto(file: File, staffId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('staffId', staffId)

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-staff-photo`,
    {
      method:  'POST',
      headers: {
        // Pass the user's JWT — Edge Function verifies role server-side.
        // Do NOT set Content-Type — browser sets multipart boundary automatically.
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error((err as { error: string }).error ?? 'Photo upload failed')
  }

  const { path } = await res.json() as { path: string }
  return path
}
