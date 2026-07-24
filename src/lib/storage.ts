import { supabase } from './supabase'

// ── Bucket registry ───────────────────────────────────────────────────────────
export const BUCKETS = {
  STAFF_PHOTOS:      'staff-photos',      // public — full public URL stored in staff.photo_url
  STUDENT_PHOTOS:    'student-photos',    // private — signed URLs only
  DOCUMENTS:         'documents',         // private — signed URLs only
  REPORT_CARDS:      'report-cards',      // public
  TEMPLATES:         'templates',         // private — signed URLs only
  STAFF_ATTACHMENTS: 'staff-attachments', // private — signed URLs only (message file attachments)
} as const

// ── Upload helpers ────────────────────────────────────────────────────────────

export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { upsert?: boolean; contentType?: string }
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert:      options?.upsert ?? true,
      contentType: options?.contentType,
    })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return path
}

export async function uploadPhoto(
  bucket: 'staff-photos' | 'student-photos',
  schoolId: string,
  entityId: string,
  file: File
): Promise<string> {
  const compressed = await compressImage(file, 800, 0.8)
  const path = `${schoolId}/${entityId}.jpg`
  return uploadFile(bucket, path, compressed, { upsert: true, contentType: 'image/jpeg' })
}

export async function uploadDocument(
  schoolId: string,
  staffId: string,
  docType: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${schoolId}/${staffId}/${docType}_${Date.now()}.${ext}`
  return uploadFile(BUCKETS.DOCUMENTS, path, file)
}

export async function uploadReportCard(
  schoolId: string,
  studentId: string,
  term: number,
  year: number,
  pdfBlob: Blob
): Promise<string> {
  const path = `${schoolId}/${year}/${term}/${studentId}.pdf`
  return uploadFile(BUCKETS.REPORT_CARDS, path, pdfBlob, {
    upsert: true,
    contentType: 'application/pdf',
  })
}

export async function uploadTemplate(schoolId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'pdf'
  const path = `${schoolId}/report-card-template.${ext}`
  return uploadFile(BUCKETS.TEMPLATES, path, file, { upsert: true })
}

export async function uploadSchoolLogo(schoolId: string, file: File): Promise<string> {
  const transparent = await compressLogoTransparent(file, 400)
  const path = `school-logos/${schoolId}/badge.png`
  await uploadFile(BUCKETS.STAFF_PHOTOS, path, transparent, { upsert: true, contentType: 'image/png' })
  const { data } = supabase.storage.from(BUCKETS.STAFF_PHOTOS).getPublicUrl(path)
  return data.publicUrl
}

// ── URL helpers ───────────────────────────────────────────────────────────────

export function getPublicUrl(bucket: string, pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  // Already a full URL (legacy data stored full URLs)
  if (pathOrUrl.startsWith('http')) return pathOrUrl
  const { data } = supabase.storage.from(bucket).getPublicUrl(pathOrUrl)
  return data.publicUrl
}

export async function getSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!path) return null

  // Legacy data stored the full public URL instead of just the path.
  // Extract the storage path so createSignedUrl works for private buckets.
  let storagePath = path
  if (path.startsWith('http')) {
    const publicMarker = `/object/public/${bucket}/`
    const signedMarker = `/object/sign/${bucket}/`
    const idx = path.indexOf(publicMarker)
    const idx2 = path.indexOf(signedMarker)
    if (idx !== -1) {
      storagePath = path.slice(idx + publicMarker.length)
    } else if (idx2 !== -1) {
      storagePath = path.slice(idx2 + signedMarker.length).split('?')[0]
    } else {
      return null  // unrecognised URL format — show initials instead
    }
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
  if (error) return null
  return data.signedUrl
}

// staff-attachments is now a private bucket (previously public, which meant
// its storage.objects RLS policies were never actually consulted for reads —
// Supabase serves public-bucket objects via a route that bypasses RLS
// entirely). messages.attachment_url stores a bare storage path going
// forward; getSignedUrl's legacy-URL handling still resolves any
// already-sent message whose attachment_url is an old full public URL.
export async function getStaffAttachmentUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  return getSignedUrl(BUCKETS.STAFF_ATTACHMENTS, pathOrUrl, 300)
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw new Error(`Delete failed: ${error.message}`)
}

export async function downloadFile(bucket: string, path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw new Error(`Download failed: ${error.message}`)
  return data
}

export async function listFiles(
  bucket: string,
  prefix: string,
  options?: { limit?: number }
): Promise<Array<{ name: string; id: string | null; updated_at: string | null; created_at: string | null; last_accessed_at: string | null; metadata: Record<string, unknown> | null }>> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: options?.limit ?? 1000 })
  if (error) throw new Error(`List failed: ${error.message}`)
  return data ?? []
}

// ── Image compression ─────────────────────────────────────────────────────────

async function compressImage(file: File, maxDim: number, quality: number): Promise<File> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) { resolve(file); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale   = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas  = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// A school badge is typically scanned/photographed on a white background —
// this fades near-white, low-saturation pixels to transparent so the crest
// floats directly on the sidebar instead of sitting in a white box. Only
// neutral (white/gray) pixels are affected; a saturated color stays opaque
// even if bright, so pale design elements in the crest itself survive. A
// crest with its OWN white detail (e.g. a white star) will lose that
// detail's fill too — an unavoidable limit of flat chroma-key removal
// without a real background-removal model.
async function compressLogoTransparent(file: File, maxDim: number): Promise<File> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) { resolve(file); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale   = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas  = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data    = imgData.data
      const FADE_START = 230, FADE_END = 250
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b)
        const isNeutral = (maxC - minC) < 18
        if (isNeutral && maxC > FADE_START) {
          const t = Math.min(1, (maxC - FADE_START) / (FADE_END - FADE_START))
          data[i + 3] = Math.round(data[i + 3] * (1 - t))
        }
      }
      ctx.putImageData(imgData, 0, 0)

      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name, { type: 'image/png' }) : file),
        'image/png'
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
