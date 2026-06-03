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
  }
}

export const db = new ShuleDatabase()

// ── queueSync ──────────────────────────────────────────────────────────────
// Call this instead of supabase.from(...).insert() when offline.
// The sync listener picks it up when the connection is restored.
export async function queueSync(
  tableName: string,
  actionType: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>
): Promise<void> {
  await db.sync_queue.add({
    tableName,
    actionType,
    status: 'pending',
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
  })
}
