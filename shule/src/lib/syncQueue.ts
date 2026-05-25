// syncQueue.ts — Flush offline writes to Supabase when connection is restored.
// Each pending sync_queue row is attempted as a Supabase upsert.
// On success → status = 'synced'. On error → status = 'failed' (for retry UI).

import { supabase } from './supabase'
import { db } from './db'

export async function flushSyncQueue(): Promise<void> {
  const pending = await db.sync_queue
    .where('status')
    .equals('pending')
    .toArray()

  if (pending.length === 0) return

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>

      let error: { message: string } | null = null

      if (item.actionType === 'delete') {
        const { error: e } = await supabase
          .from(item.tableName)
          .delete()
          .eq('id', payload['id'])
        error = e
      } else {
        const { error: e } = await supabase
          .from(item.tableName)
          .upsert(payload)
        error = e
      }

      if (item.id != null) {
        await db.sync_queue.update(item.id, {
          status: error ? 'failed' : 'synced',
        })
      }
    } catch {
      if (item.id != null) {
        await db.sync_queue.update(item.id, { status: 'failed' })
      }
    }
  }
}

// Attach once to the window 'online' event. Safe to call on app start.
export function startSyncListener(): void {
  window.addEventListener('online', () => {
    void flushSyncQueue()
  })
}

// Fetch and cache critical data for offline use. Run after successful login.
export async function primeOfflineCache(schoolId: string): Promise<void> {
  try {
    const [studentsRes, staffRes, slotsRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, admission_number, first_name, last_name, class_id, stream_id, status, school_id')
        .eq('school_id', schoolId)
        .eq('status', 'active'),
      supabase
        .from('staff')
        .select('id, first_name, last_name, role, auth_user_id, is_active, school_id')
        .eq('school_id', schoolId)
        .eq('is_active', true),
      supabase
        .from('timetable_slots')
        .select('id, class_id, stream_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, school_id')
        .eq('school_id', schoolId)
        .eq('is_published', true),
    ])

    if (studentsRes.data) {
      await db.students.bulkPut(
        studentsRes.data.map(r => ({
          ...r,
          id:       r.id,
          schoolId: r.school_id as string,
          admissionNumber: r.admission_number as string,
        }))
      )
    }

    if (staffRes.data) {
      await db.staff.bulkPut(
        staffRes.data.map(r => ({
          ...r,
          id:         r.id,
          schoolId:   r.school_id as string,
          authUserId: (r.auth_user_id as string) ?? null,
        }))
      )
    }

    if (slotsRes.data) {
      await db.timetable_slots.bulkPut(
        slotsRes.data.map(r => ({
          ...r,
          id:       r.id,
          schoolId: r.school_id as string,
          classId:  r.class_id as string,
        }))
      )
    }
  } catch {
    // Cache priming is best-effort — never block login
  }
}
