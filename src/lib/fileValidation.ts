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
