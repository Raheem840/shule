// queryPersistence.ts — Saves/restores the React Query cache to/from IndexedDB.
// On startup: restoreQueryCache() hydrates the client with the last saved state.
// Periodically + on page close: persistQueryCache() dehydrates and saves.
//
// This means a page reload doesn't re-fetch everything — the cached data is
// available immediately, and queries only re-fetch in the background to stay fresh.

import { dehydrate, hydrate, type QueryClient, type DehydratedState } from '@tanstack/react-query'
import { db } from './db'

const PERSIST_KEY = 'rq-dehydrated-v1'
const MAX_AGE_MS  = 24 * 60 * 60 * 1000   // discard cache older than 24h

// Keys that should never be persisted (auth/session state, realtime subscriptions)
const EXCLUDED_KEY_PREFIXES = ['auth', 'session', 'notifications', 'realtime']

function shouldPersist(queryKey: readonly unknown[]): boolean {
  const first = String(queryKey[0] ?? '')
  return !EXCLUDED_KEY_PREFIXES.some(prefix => first.startsWith(prefix))
}

// ── Save ─────────────────────────────────────────────────────────────────────
export async function persistQueryCache(client: QueryClient): Promise<void> {
  try {
    const state: DehydratedState = dehydrate(client, {
      shouldDehydrateQuery: q =>
        q.state.status === 'success' && shouldPersist(q.queryKey),
    })
    const payload = JSON.stringify(state)
    // Avoid writing empty cache
    if (!state.queries.length) return
    await db.query_cache.put({
      cacheKey: PERSIST_KEY,
      data:     payload,
      cachedAt: Date.now(),
      schoolId: 'global',
    })
  } catch {
    // Best-effort — never block anything
  }
}

// ── Restore ───────────────────────────────────────────────────────────────────
export async function restoreQueryCache(client: QueryClient): Promise<void> {
  try {
    const item = await db.query_cache.get(PERSIST_KEY)
    if (!item) return
    if (Date.now() - item.cachedAt > MAX_AGE_MS) {
      await db.query_cache.delete(PERSIST_KEY)
      return
    }
    const state = JSON.parse(item.data) as DehydratedState
    hydrate(client, state)
  } catch {
    // Corrupted cache — ignore silently
  }
}

// ── Clear (call on signOut) ───────────────────────────────────────────────────
export async function clearQueryCache(): Promise<void> {
  try {
    await db.query_cache.delete(PERSIST_KEY)
  } catch { /* ignore */ }
}
