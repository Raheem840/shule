// SyncManager.tsx — Invisible component that activates the background sync queue.
// Mount once inside AppShell. It returns null — no DOM output.

import { useSyncQueue } from '../../hooks/useSyncQueue'

/** Mounts the sync queue side-effect. Renders nothing. */
export function SyncManager(): null {
  useSyncQueue()
  return null
}
