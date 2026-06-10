// syncQueue.ts — Flush offline writes to Supabase when connection is restored.
// Each pending sync_queue row is attempted as a Supabase upsert.
// On success → status = 'synced'. On error → status = 'failed' (for retry UI).

import { supabase } from './supabase'
import { db }       from './db'
import { cachePageData, buildCacheKey, clearExpiredCache } from './offlineCache'

// ── Role type (mirrored here to avoid a circular dep with AuthContext) ────────
type UserRole =
  | 'principal' | 'deputy'       | 'dos'      | 'secretary'
  | 'bursar'    | 'class_teacher' | 'teacher'
  | 'student'   | 'parent'       | 'it_admin'

// ── Flush pending writes ───────────────────────────────────────────────────────
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

// ── Attach once to the window 'online' event — safe to call on app start ─────
export function startSyncListener(): void {
  window.addEventListener('online', () => {
    void flushSyncQueue()
  })
}

// ── Role-specific cache priming helpers ───────────────────────────────────────

async function primeTeacherCache(schoolId: string, authUserId: string): Promise<void> {
  const [journalsRes, slotsRes, classesRes] = await Promise.all([
    supabase
      .from('exam_journal')
      .select('id, name, subject_id, class_id, stream_id, term, year, status, total_marks, pass_mark, date_given, assessment_type, school_id')
      .eq('school_id', schoolId)
      .eq('teacher_id', authUserId)
      .order('date_given', { ascending: false })
      .limit(100),
    supabase
      .from('timetable_slots')
      .select('id, class_id, stream_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, term, year, school_id')
      .eq('school_id', schoolId)
      .eq('teacher_id', authUserId)
      .eq('is_published', true),
    supabase
      .from('classes')
      .select('id, name, level, academic_year_id, school_id')
      .eq('school_id', schoolId),
  ])

  if (journalsRes.data) {
    await cachePageData(
      buildCacheKey('teacher', 'exam_journal', schoolId),
      journalsRes.data
    )
  }
  if (slotsRes.data) {
    await cachePageData(
      buildCacheKey('teacher', 'timetable', schoolId),
      slotsRes.data
    )
  }
  if (classesRes.data) {
    await cachePageData(
      buildCacheKey('teacher', 'classes', schoolId),
      classesRes.data
    )
  }
}

async function primeStudentCache(schoolId: string, authUserId: string): Promise<void> {
  // Get the student record first so we can look up their results/fees
  const { data: studentRow } = await supabase
    .from('students')
    .select('id, class_id, stream_id, first_name, last_name, status, school_id')
    .eq('school_id', schoolId)
    .eq('auth_user_id', authUserId)
    .single()

  if (!studentRow) return

  const studentId = studentRow.id as string

  const [resultsRes, feesRes, cardsRes] = await Promise.all([
    supabase
      .from('exam_results')
      .select('id, exam_journal_id, score, grade, term, year, is_absent, remarks, school_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('year', { ascending: false })
      .limit(200),
    supabase
      .from('fee_payments')
      .select('id, fee_structure_id, academic_year_id, term, amount_due, amount_paid, balance, payment_date, receipt_number, school_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false })
      .limit(50),
    supabase
      .from('report_cards')
      .select('id, student_id, term, year, status, principal_remarks, pdf_url, released_at, school_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('year', { ascending: false })
      .limit(20),
  ])

  const key = buildCacheKey('student', 'portal', schoolId, { studentId })

  if (resultsRes.data) {
    await cachePageData(buildCacheKey('student', 'results', schoolId, { studentId }), resultsRes.data)
  }
  if (feesRes.data) {
    await cachePageData(buildCacheKey('student', 'fees', schoolId, { studentId }), feesRes.data)
  }
  if (cardsRes.data) {
    await cachePageData(buildCacheKey('student', 'report_cards', schoolId, { studentId }), cardsRes.data)
  }
  // Also cache the student profile itself
  await cachePageData(key, studentRow)
}

async function primeParentCache(schoolId: string, authUserId: string): Promise<void> {
  // Fetch the parent account to get their linked student IDs
  const { data: parentRow } = await supabase
    .from('parent_accounts')
    .select('id, student_ids, full_name, school_id')
    .eq('school_id', schoolId)
    .eq('auth_user_id', authUserId)
    .single()

  if (!parentRow) return

  const studentIds = (parentRow.student_ids as string[] | null) ?? []
  if (studentIds.length === 0) return

  // Cache child profiles + recent fees per child
  await Promise.all(
    studentIds.map(async (studentId) => {
      const [profileRes, feesRes, resultsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, first_name, last_name, class_id, stream_id, status, photo_url, school_id')
          .eq('school_id', schoolId)
          .eq('id', studentId)
          .single(),
        supabase
          .from('fee_payments')
          .select('id, fee_structure_id, term, amount_due, amount_paid, balance, payment_date, receipt_number, school_id')
          .eq('school_id', schoolId)
          .eq('student_id', studentId)
          .order('payment_date', { ascending: false })
          .limit(30),
        supabase
          .from('exam_results')
          .select('id, exam_journal_id, score, grade, term, year, school_id')
          .eq('school_id', schoolId)
          .eq('student_id', studentId)
          .order('year', { ascending: false })
          .limit(100),
      ])

      if (profileRes.data) {
        await cachePageData(buildCacheKey('parent', 'child_profile', schoolId, { studentId }), profileRes.data)
      }
      if (feesRes.data) {
        await cachePageData(buildCacheKey('parent', 'fees', schoolId, { studentId }), feesRes.data)
      }
      if (resultsRes.data) {
        await cachePageData(buildCacheKey('parent', 'results', schoolId, { studentId }), resultsRes.data)
      }
    })
  )
}

async function primeAdminCache(schoolId: string): Promise<void> {
  const [studentsRes, staffRes, classesRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, admission_number, first_name, last_name, class_id, stream_id, status, school_id')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(500),
    supabase
      .from('staff')
      .select('id, first_name, last_name, role, auth_user_id, is_active, department_id, school_id')
      .eq('school_id', schoolId)
      .eq('is_active', true),
    supabase
      .from('classes')
      .select('id, name, level, academic_year_id, school_id')
      .eq('school_id', schoolId),
  ])

  if (studentsRes.data) {
    await cachePageData(buildCacheKey('admin', 'students', schoolId), studentsRes.data)
  }
  if (staffRes.data) {
    await cachePageData(buildCacheKey('admin', 'staff', schoolId), staffRes.data)
  }
  if (classesRes.data) {
    await cachePageData(buildCacheKey('admin', 'classes', schoolId), classesRes.data)
  }
}

// ── Main entry point: prime Dexie + page cache after successful login ─────────
// Called by AuthContext after every successful session resolve.
// Best-effort — any error is silently swallowed so login is never blocked.
export async function primeOfflineCache(
  schoolId:   string,
  role?:      UserRole,
  authUserId?: string,
): Promise<void> {
  try {
    // Clean up stale page cache entries (older than 7 days) on each login
    void clearExpiredCache(7 * 24 * 60 * 60 * 1000)

    // ── Always cache: students, staff, timetable into Dexie row tables ──────
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
          id:              r.id,
          schoolId:        r.school_id as string,
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

    // ── Role-specific page cache priming ─────────────────────────────────────
    if (!role || !authUserId) return

    switch (role) {
      case 'teacher':
      case 'class_teacher':
        await primeTeacherCache(schoolId, authUserId)
        break
      case 'student':
        await primeStudentCache(schoolId, authUserId)
        break
      case 'parent':
        await primeParentCache(schoolId, authUserId)
        break
      case 'principal':
      case 'secretary':
      case 'bursar':
      case 'dos':
      case 'deputy':
      case 'it_admin':
        await primeAdminCache(schoolId)
        break
      default:
        break
    }
  } catch {
    // Cache priming is best-effort — never block login
  }
}
