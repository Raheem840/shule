// queryPersistence.ts — Saves/restores the React Query cache to/from IndexedDB.
// On startup: restoreQueryCache() hydrates the client with the last saved state.
// Periodically + on page close: persistQueryCache() dehydrates and saves.
//
// This means a page reload doesn't re-fetch everything — the cached data is
// available immediately, and queries only re-fetch in the background to stay fresh.

import { dehydrate, hydrate, type QueryClient, type DehydratedState } from '@tanstack/react-query'
import { db } from './db'

// Bumped to v2: v1 caches may have Map/Set query data already corrupted to
// "{}" by the old Map-unsafe JSON.stringify — bumping the key means those
// are simply never looked up again, rather than waiting out MAX_AGE_MS.
const PERSIST_KEY = 'rq-dehydrated-v2'
const MAX_AGE_MS  = 24 * 60 * 60 * 1000   // discard cache older than 24h

// Keys that should never be persisted (auth/session state, realtime subscriptions)
const EXCLUDED_KEY_PREFIXES = ['auth', 'session', 'notifications', 'realtime']

function shouldPersist(queryKey: readonly unknown[]): boolean {
  const first = String(queryKey[0] ?? '')
  return !EXCLUDED_KEY_PREFIXES.some(prefix => first.startsWith(prefix))
}

// A number of query hooks across the app (useAttendance, useJournalMarkCounts,
// etc.) return a Map (or Set) as their data — plain JSON.stringify silently
// drops a Map's entries (it has no enumerable own properties, so it
// serializes as "{}"), and restoring that corrupted "{}" back into the cache
// on next load crashes the first consumer that calls .get()/.has() on it,
// well before the background refetch has a chance to replace it with real
// data. Tag Maps/Sets through a replacer/reviver pair so they round-trip
// intact instead of quietly turning into an empty plain object.
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { __type: 'Map', entries: Array.from(value.entries()) }
  if (value instanceof Set) return { __type: 'Set', values: Array.from(value.values()) }
  return value
}
function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object') {
    const v = value as { __type?: string; entries?: [unknown, unknown][]; values?: unknown[] }
    if (v.__type === 'Map') return new Map(v.entries)
    if (v.__type === 'Set') return new Set(v.values)
  }
  return value
}

// ── Save ─────────────────────────────────────────────────────────────────────
export async function persistQueryCache(client: QueryClient): Promise<void> {
  try {
    const state: DehydratedState = dehydrate(client, {
      shouldDehydrateQuery: q =>
        q.state.status === 'success' && shouldPersist(q.queryKey),
    })
    const payload = JSON.stringify(state, replacer)
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
    const state = JSON.parse(item.data, reviver) as DehydratedState
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
