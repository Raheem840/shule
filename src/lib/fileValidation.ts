export const FILE_LIMITS = {
  PHOTO: {
    maxBytes: 5 * 1024 * 1024,
    label: '5MB',
    types: ['image/jpeg', 'image/png', 'image/webp'] as string[],
  },
  DOCUMENT: {
    maxBytes: 10 * 1024 * 1024,
    label: '10MB',
    types: ['application/pdf', 'image/jpeg', 'image/png'] as string[],
  },
  TEMPLATE: {
    maxBytes: 20 * 1024 * 1024,
    label: '20MB',
    types: ['application/pdf', 'image/jpeg', 'image/png', 'image/svg+xml'] as string[],
  },
  REPORT: {
    maxBytes: 5 * 1024 * 1024,
    label: '5MB',
    types: ['application/pdf'] as string[],
  },
} as const

export type FileLimitKey = keyof typeof FILE_LIMITS

export function validateFile(
  file: File,
  limitKey: FileLimitKey
): string | null {
  const limits = FILE_LIMITS[limitKey]
  if (file.size > limits.maxBytes) {
    return `File too large — maximum size is ${limits.label}`
  }
  if (!limits.types.includes(file.type)) {
    const exts = limits.types.map(t => t.split('/')[1]).join(', ')
    return `Invalid file type — accepted: ${exts}`
  }
  return null
}

// Downscales + re-encodes an image file to a JPEG data URL under maxBytes —
// used for profile photo uploads (student/staff registration + edit forms).
export async function compressToJpeg(file: File, maxBytes: number): Promise<string> {
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
