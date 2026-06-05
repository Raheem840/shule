// db.ts — Dexie (IndexedDB) local database for offline-first storage.
// Tables mirror server-side Supabase tables. sync_queue tracks pending writes.

import Dexie, { type Table } from 'dexie'

// ── Sync Queue ─────────────────────────────────────────────────────────────
export type SyncQueueItem = {
  id?: number                                   // auto-increment PK
  tableName: string                             // target Supabase table
  actionType: 'insert' | 'update' | 'delete'
  status: 'pending' | 'synced' | 'failed'
  payload: string                               // JSON.stringify of the record
  createdAt: string                             // ISO datetime
  retryCount: number                            // number of flush attempts made
  schoolId: string                              // owning school for multi-tenant isolation
  error?: string                                // last error message from a failed attempt
}

// ── Query Cache ────────────────────────────────────────────────────────────
/** Shape of a cached query result stored in IndexedDB. */
export type QueryCacheItem = {
  cacheKey: string                              // unique key identifying the query
  data: string                                  // JSON.stringify of the query result
  cachedAt: number                              // Date.now() timestamp
  schoolId: string                              // owning school for isolation
}

// ── Local table shapes (subset of server columns used offline) ─────────────
type LocalStudent = {
  id: string
  schoolId: string
  admissionNumber: string
  [key: string]: unknown
}

type LocalStaff = {
  id: string
  schoolId: string
  authUserId: string | null
  [key: string]: unknown
}

type LocalExamMark = {
  id: string
  schoolId: string
  examJournalId: string
  studentId: string
  [key: string]: unknown
}

type LocalAttendance = {
  id: string
  schoolId: string
  classId: string
  date: string
  [key: string]: unknown
}

// ── Cached auth session for offline login ─────────────────────────────────
type CachedAuthSession = {
  id: string            // always 'current'
  session: unknown      // serialised Supabase Session
  user: {
    id: string
    email: string
    role: string
    schoolId: string
    name: string
    studentIds?: string[]
  }
  savedAt: string
}

// ── Cached timetable slots ────────────────────────────────────────────────
type LocalTimetableSlot = {
  id: string
  schoolId: string
  classId: string
  [key: string]: unknown
}

// ── Generic page data cache (offline fallback) ────────────────────────────
export type CachedPage = {
  id?:      number   // Dexie auto-increment PK
  key:      string   // cache key: {role}/{page}/{schoolId}[/{filters}]
  data:     string   // JSON.stringify of cached payload
  cachedAt: number   // Date.now() ms timestamp
}

// ── Database class ─────────────────────────────────────────────────────────
class ShuleDatabase extends Dexie {
  students!:         Table<LocalStudent>
  staff!:            Table<LocalStaff>
  exam_marks!:       Table<LocalExamMark>
  attendance!:       Table<LocalAttendance>
  sync_queue!:       Table<SyncQueueItem>
  auth_session!:     Table<CachedAuthSession>
  timetable_slots!:  Table<LocalTimetableSlot>
  cached_pages!:     Table<CachedPage>
  query_cache!:      Table<QueryCacheItem>

  constructor() {
    super('ShuleDB')
    this.version(1).stores({
      students:   '&id, schoolId, admissionNumber',
      staff:      '&id, schoolId, authUserId',
      exam_marks: '&id, schoolId, examJournalId, studentId',
      attendance: '&id, schoolId, classId, date',
      sync_queue: '++id, tableName, actionType, status, createdAt',
    })
    this.version(2).stores({
      students:        '&id, schoolId, admissionNumber',
      staff:           '&id, schoolId, authUserId',
      exam_marks:      '&id, schoolId, examJournalId, studentId',
      attendance:      '&id, schoolId, classId, date',
      sync_queue:      '++id, tableName, actionType, status, createdAt',
      auth_session:    '&id',
      timetable_slots: '&id, schoolId, classId',
    })
    // v3 — generic page-level offline cache
    this.version(3).stores({
      students:        '&id, schoolId, admissionNumber',
      staff:           '&id, schoolId, authUserId',
      exam_marks:      '&id, schoolId, examJournalId, studentId',
      attendance:      '&id, schoolId, classId, date',
      sync_queue:      '++id, tableName, actionType, status, createdAt',
      auth_session:    '&id',
      timetable_slots: '&id, schoolId, classId',
      cached_pages:    '++id, key, cachedAt',
    })
    // v4 — structured query cache + retryCount/schoolId on sync_queue
    this.version(4).stores({
      students:        '&id, schoolId, admissionNumber',
      staff:           '&id, schoolId, authUserId',
      exam_marks:      '&id, schoolId, examJournalId, studentId',
      attendance:      '&id, schoolId, classId, date',
      sync_queue:      '++id, tableName, actionType, status, createdAt, schoolId',
      auth_session:    '&id',
      timetable_slots: '&id, schoolId, classId',
      cached_pages:    '++id, key, cachedAt',
      query_cache:     'cacheKey, cachedAt, schoolId',
    })
  }
}

export const db = new ShuleDatabase()

// ── queueSync ──────────────────────────────────────────────────────────────
/** Queues a write for later sync when offline. Call instead of supabase.from().insert(). */
export async function queueSync(
  tableName: string,
  actionType: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>,
  schoolId = ''
): Promise<void> {
  await db.sync_queue.add({
    tableName,
    actionType,
    status: 'pending',
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
    retryCount: 0,
    schoolId,
  })
}

// ── getPendingSync ─────────────────────────────────────────────────────────
/** Returns up to 50 pending sync items ordered oldest-first. */
export async function getPendingSync(): Promise<SyncQueueItem[]> {
  return db.sync_queue
    .where('status')
    .equals('pending')
    .limit(50)
    .sortBy('createdAt')
}

// ── markSynced ─────────────────────────────────────────────────────────────
/** Marks a sync item as successfully synced. */
export async function markSynced(id: number): Promise<void> {
  await db.sync_queue.update(id, { status: 'synced' })
}

// ── markFailed ─────────────────────────────────────────────────────────────
/** On retryCount < 3: increment retryCount, keep status pending. On >= 3: mark failed. */
export async function markFailed(id: number, errorMessage: string): Promise<void> {
  const item = await db.sync_queue.get(id)
  if (!item) return
  if (item.retryCount < 3) {
    await db.sync_queue.update(id, {
      retryCount: item.retryCount + 1,
      error: errorMessage,
    })
  } else {
    await db.sync_queue.update(id, {
      status: 'failed',
      error: errorMessage,
    })
  }
}

// ── cacheQueryResult ───────────────────────────────────────────────────────
/** Saves query result to IndexedDB cache (upsert by cacheKey). */
export async function cacheQueryResult(
  cacheKey: string,
  data: unknown,
  schoolId: string
): Promise<void> {
  await db.query_cache.put({
    cacheKey,
    data: JSON.stringify(data),
    cachedAt: Date.now(),
    schoolId,
  })
}

// ── getCachedQueryResult ───────────────────────────────────────────────────
/** Returns cached data if < 2 hours old, otherwise null. */
export async function getCachedQueryResult(cacheKey: string): Promise<unknown | null> {
  const item = await db.query_cache.get(cacheKey)
  if (!item) return null
  const twoHoursMs = 2 * 60 * 60 * 1000
  if (Date.now() - item.cachedAt > twoHoursMs) return null
  try {
    return JSON.parse(item.data) as unknown
  } catch {
    return null
  }
}
