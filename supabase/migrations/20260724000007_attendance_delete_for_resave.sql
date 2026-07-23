-- Migration: attendance_delete_for_resave
-- Description: Teacher-role audit (2026-07-24) found useSaveAttendance
-- (useAttendance.ts) does a delete-then-reinsert for a class+date on every
-- save (including edits to an already-saved day), but the only DELETE
-- policy on attendance was "attendance: principal can delete" — teacher,
-- class_teacher, and secretary deletes silently affected 0 rows, and the
-- follow-up insert then collided with the attendance_student_date_idx
-- unique index, throwing a duplicate-key error on every re-save. In
-- practice: a teacher marks attendance, reopens the page to fix one
-- student's status, and save fails outright — attendance for that day
-- becomes uneditable by anyone but the principal.
--
-- Extends DELETE to teacher/class_teacher/secretary, scoped to their own
-- currently-assigned classes (same class-assignment EXISTS check as the
-- sibling attendance UPDATE/INSERT policies from 20260704000003/000004) —
-- not a blanket grant.

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "attendance: principal can delete" ON "public"."attendance";
CREATE POLICY "attendance: staff can delete own class" ON "public"."attendance"
FOR DELETE
USING (
  (school_id = auth_school_id())
  AND (
    auth_role() = ANY (ARRAY['secretary'::text, 'principal'::text])
    OR (
      auth_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.auth_user_id = auth.uid()
          AND s.school_id = attendance.school_id
          AND (
            attendance.class_id = ANY (s.classes)
            OR EXISTS (
              SELECT 1 FROM streams st
              WHERE st.class_teacher_id = s.id AND st.class_id = attendance.class_id
            )
          )
      )
    )
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a teacher-role JWT assigned to class X: DELETE FROM attendance WHERE
-- class_id = X AND date = <today> should now succeed (previously 0 rows
-- affected). As a teacher no longer assigned to X: DELETE should still be
-- rejected (0 rows).
