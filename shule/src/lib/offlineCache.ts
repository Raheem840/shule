// offlineCache.ts — Generic IndexedDB page-data cache for offline fallback.
// All reads/writes go through Dexie (db.ts). The key convention is:
//   {role}/{page}/{schoolId}[/{filters}]
// e.g. "teacher/exams/school-uuid/term1-2025"

import { db } from './db'

// ── Write ─────────────────────────────────────────────────────────────────────
// Silently overwrites any existing entry for the same key.
export async function cachePageData(key: string, data: unknown): Promise<void> {
  try {
    // Dexie put() updates if key matches, inserts otherwise.
    // We match on the 'key' field (unique-ish string), not on the auto-increment id.
    // Delete existing first so put() always inserts fresh (avoids duplicate key issues).
    await db.cached_pages.where('key').equals(key).delete()
    await db.cached_pages.add({
      key,
      data:     JSON.stringify(data),
      cachedAt: Date.now(),
    })
  } catch {
    // Best-effort — never block the caller
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────
// Returns null when not found or when data is corrupted.
export async function getCachedData<T>(key: string): Promise<{ data: T; cachedAt: Date } | null> {
  try {
    const entry = await db.cached_pages.where('key').equals(key).first()
    if (!entry) return null
    return {
      data:     JSON.parse(entry.data) as T,
      cachedAt: new Date(entry.cachedAt),
    }
  } catch {
    return null
  }
}

// ── Expire old entries ────────────────────────────────────────────────────────
// Call on app start (or after sync) to keep IndexedDB lean.
export async function clearExpiredCache(maxAgeMs: number): Promise<void> {
  try {
    const cutoff = Date.now() - maxAgeMs
    await db.cached_pages.where('cachedAt').below(cutoff).delete()
  } catch {
    // Ignore
  }
}

// ── Delete one key (call after successful mutation) ───────────────────────────
export async function invalidateCacheKey(key: string): Promise<void> {
  try {
    await db.cached_pages.where('key').equals(key).delete()
  } catch {
    // Ignore
  }
}

// ── Build a canonical cache key ───────────────────────────────────────────────
// Usage: buildCacheKey('teacher', 'exams', schoolId, { term: '1', year: 2025 })
export function buildCacheKey(
  role: string,
  page: string,
  schoolId: string,
  filters: Record<string, string | number | boolean | null | undefined> = {}
): string {
  const filterStr = Object.entries(filters)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('-')
  return [role, page, schoolId, filterStr].filter(Boolean).join('/')
}
