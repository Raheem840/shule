import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/storage'

/**
 * Resolves a signed URL for the private staff-photos bucket.
 * Handles both legacy full public URLs and new relative paths stored in staff.photo_url.
 * Auto-refreshes every 55 minutes so the 1-hour signed URL never expires mid-session.
 */
export function useStaffPhotoUrl(photoPath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!photoPath) { setUrl(null); return }

    let cancelled = false

    async function refresh() {
      const signed = await getSignedUrl('staff-photos', photoPath, 3600)
      if (!cancelled) setUrl(signed)
    }

    void refresh()
    const interval = setInterval(() => { void refresh() }, 55 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [photoPath])

  return url
}
