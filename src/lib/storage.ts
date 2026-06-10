import { supabase } from './supabase'

// ── Bucket registry ───────────────────────────────────────────────────────────
export const BUCKETS = {
  STAFF_PHOTOS:      'staff-photos',      // private — signed URLs only (changed from public)
  STUDENT_PHOTOS:    'student-photos',    // private — signed URLs only
  DOCUMENTS:         'documents',         // private — signed URLs only
  REPORT_CARDS:      'report-cards',      // public
  TEMPLATES:         'templates',         // private — signed URLs only
  STAFF_ATTACHMENTS: 'staff-attachments', // public
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
  const compressed = await compressImage(file, 400, 0.9)
  const path = `school-logos/${schoolId}/badge.jpg`
  await uploadFile(BUCKETS.STAFF_ATTACHMENTS, path, compressed, { upsert: true, contentType: 'image/jpeg' })
  const { data } = supabase.storage.from(BUCKETS.STAFF_ATTACHMENTS).getPublicUrl(path)
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

export async function deleteFile(bucket: string, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path])
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
