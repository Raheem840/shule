// useSyncQueue.ts — Background service that flushes queued offline writes to Supabase.
// Watches connection status and flushes pending items when verified online.

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getPendingSync, markSynced, markFailed } from '../lib/db'
import { useConnection } from './useConnectionStatus'

/** Shape of the sync state exposed to consumers. */
interface SyncQueueState {
  /** Number of items currently waiting to sync. */
  pendingCount: number
  /** True while a flush is in progress. */
  isSyncing: boolean
  /** Timestamp of the last successful flush completion. */
  lastSyncAt: Date | null
  /** Number of items that permanently failed (retryCount >= 3). */
  failedCount: number
}

/**
 * Manages the background flush of offline-queued writes to Supabase.
 * Flushes when the connection becomes verified online, then every 90 seconds.
 */
export function useSyncQueue(): SyncQueueState {
  const { isVerified } = useConnection()
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing]       = useState(false)
  const [lastSyncAt, setLastSyncAt]     = useState<Date | null>(null)
  const [failedCount, setFailedCount]   = useState(0)

  // Track whether we were previously verified to detect the true→true transition
  const wasVerified = useRef(false)
  const isFlushing  = useRef(false)

  /** Flush up to 50 pending items one at a time to Supabase. */
  async function flush() {
    if (isFlushing.current) return
    isFlushing.current = true
    setIsSyncing(true)

    try {
      const items = await getPendingSync()
      setPendingCount(items.length)
      if (items.length === 0) {
        setIsSyncing(false)
        isFlushing.current = false
        return
      }

      let failed = 0
      for (const item of items) {
        try {
          const payload = JSON.parse(item.payload) as Record<string, unknown>
          const { error } = await supabase
            .from(item.tableName as string)
            .upsert(payload, { onConflict: 'id' })

          if (!error) {
            await markSynced(item.id!)
          } else if (error.code === '23505') {
            // Unique constraint — server already has this record; treat as success
            await markSynced(item.id!)
          } else {
            await markFailed(item.id!, error.message)
            failed++
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          await markFailed(item.id!, msg)
          failed++
        }
      }

      setFailedCount(failed)
      // Refresh pending count after flush
      const remaining = await getPendingSync()
      setPendingCount(remaining.length)
      setLastSyncAt(new Date())

      // Invalidate all queries so UI picks up fresh data from Supabase
      await queryClient.invalidateQueries()
    } finally {
      setIsSyncing(false)
      isFlushing.current = false
    }
  }

  useEffect(() => {
    if (!isVerified) {
      wasVerified.current = false
      return
    }

    // First time or transitions to verified: flush after 2s delay
    const initialTimer = setTimeout(() => void flush(), 2_000)
    wasVerified.current = true

    // Continue flushing every 90 seconds while verified
    const interval = setInterval(() => void flush(), 90_000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified])

  return { pendingCount, isSyncing, lastSyncAt, failedCount }
}
