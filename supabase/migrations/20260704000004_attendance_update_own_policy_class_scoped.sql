-- Migration: attendance_update_own_policy_class_scoped
-- Created: Sat 04 Jul 2026 06:30:00 PM EAT
-- Author: Sinqura Dev Team
-- Description: The previous migration (20260704_000003) scoped
-- "attendance_update" (user_role() family) to a teacher's assigned classes,
-- but missed a THIRD, older overlapping policy on the same table/command:
-- "attendance: staff can update own" (auth_role() family), which grants
-- UPDATE based purely on `recorded_by = own staff id` with no check that the
-- teacher is still assigned to that class today. Since Postgres RLS policies
-- for the same command are OR'd together (permissive), a teacher reassigned
-- off a class could still update its historical attendance rows via this
-- policy alone, completely bypassing the class-scoping added last migration.
-- Secretary/principal remain unrestricted, matching existing product
-- decisions and the sibling "attendance_update" policy.

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "attendance: staff can update own" ON "public"."attendance";
CREATE POLICY "attendance: staff can update own" ON "public"."attendance"
FOR UPDATE
USING (
  (school_id = auth_school_id())
  AND (
    auth_role() = ANY (ARRAY['secretary'::text, 'principal'::text])
    OR (
      recorded_by = (SELECT staff.id FROM staff WHERE staff.auth_user_id = auth.uid())
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
)
WITH CHECK (
  (school_id = auth_school_id())
  AND (
    auth_role() = ANY (ARRAY['secretary'::text, 'principal'::text])
    OR (
      recorded_by = (SELECT staff.id FROM staff WHERE staff.auth_user_id = auth.uid())
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
-- As a teacher-role JWT who originally recorded an attendance row for class X
-- but whose staff.classes[] no longer includes X and who is no longer
-- streams.class_teacher_id for X: UPDATE on that row should now be rejected
-- (previously succeeded via "attendance: staff can update own" alone).
