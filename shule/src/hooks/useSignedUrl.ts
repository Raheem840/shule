import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/storage'

/**
 * Resolves a signed URL for a private storage bucket path.
 * Returns null while loading or if path is empty.
 * Use for student-photos, documents, and templates buckets.
 */
export function useSignedUrl(
  bucket: string | null,
  path: string | null | undefined
): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!bucket || !path) { setUrl(null); return }
    let cancelled = false
    getSignedUrl(bucket, path).then(signed => {
      if (!cancelled) setUrl(signed)
    })
    return () => { cancelled = true }
  }, [bucket, path])

  return url
}
