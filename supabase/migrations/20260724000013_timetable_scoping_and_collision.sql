-- Migration: timetable_scoping_and_collision
-- Description: Timetable-system audit (2026-07-24, checked live pg_policies
-- directly — the same bug class found repeatedly this session).
--
--   1. "all_staff_view_timetable" grants every authenticated user (student,
--      parent, any staff role) full SELECT of every published slot
--      school-wide, with no class/stream/teacher scoping. useTeacherTimetable
--      and the student/parent portal queries filter client-side, but a
--      direct API call bypasses that entirely — a student or parent could
--      pull the whole school's staffing schedule (every teacher, every
--      class, every period). Narrowed: non-student/parent roles keep full
--      visibility (staff routinely need this for coordination/coverage);
--      student/parent are now scoped to their own class/stream.
--
--   2. The same-class/stream double-booking unique constraint
--      (timetable_slots_school_id_class_id_stream_id_day_of_week_pe_key)
--      includes nullable stream_id, and Postgres treats NULL <> NULL in
--      unique constraints — so for any class with no streams (all its slots
--      have stream_id=NULL, a common case), the constraint never actually
--      fires. Two subjects could be scheduled into the same class+day+period
--      with zero DB backstop, protected only by client-side collision
--      checking. Added a partial unique index covering exactly the
--      stream_id IS NULL case (mirrors the existing teacher-double-booking
--      constraint's own NULL-safe design from 20260702000003).

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "all_staff_view_timetable" ON "public"."timetable_slots";

CREATE POLICY "timetable: staff can view published" ON "public"."timetable_slots"
FOR SELECT TO "authenticated"
USING (
  school_id = user_school_id()
  AND is_published = true
  AND user_role() NOT IN ('student', 'parent')
);

CREATE POLICY "timetable: student can view own class" ON "public"."timetable_slots"
FOR SELECT TO "authenticated"
USING (
  school_id = user_school_id()
  AND is_published = true
  AND user_role() = 'student'
  AND EXISTS (
    SELECT 1 FROM students s
    WHERE s.auth_user_id = auth.uid()
      AND s.school_id = timetable_slots.school_id
      AND s.class_id = timetable_slots.class_id
      AND (timetable_slots.stream_id IS NULL OR s.stream_id = timetable_slots.stream_id)
  )
);

CREATE POLICY "timetable: parent can view child's class" ON "public"."timetable_slots"
FOR SELECT TO "authenticated"
USING (
  school_id = user_school_id()
  AND is_published = true
  AND user_role() = 'parent'
  AND EXISTS (
    SELECT 1 FROM students s
    JOIN parent_accounts pa ON pa.auth_user_id = auth.uid() AND pa.school_id = timetable_slots.school_id
    WHERE s.id = ANY (pa.student_ids)
      AND s.class_id = timetable_slots.class_id
      AND (timetable_slots.stream_id IS NULL OR s.stream_id = timetable_slots.stream_id)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "timetable_slots_no_stream_unique"
ON "public"."timetable_slots" ("school_id", "class_id", "day_of_week", "period_number", "term", "year")
WHERE "stream_id" IS NULL;

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a student-role JWT: SELECT * FROM timetable_slots WHERE school_id =
-- <own school> should now only return rows for the student's own class
-- (previously returned every published slot school-wide).
-- As DoS: attempt to INSERT two different subject/teacher rows for the same
-- class (no stream) + day + period should now be rejected by
-- timetable_slots_no_stream_unique (previously succeeded, only caught
-- client-side).
