-- Migration: student_role_rls_fixes
-- Description: Student-role audit (2026-07-24) found two live RLS gaps.
--
--   1. CRITICAL — "students: school staff can view" (00003_rls_policies.sql)
--      is a SELECT policy with NO role restriction at all (school_id match
--      only). The 2026-07-21 unscoped-RLS fix (20260721000004) replaced a
--      differently-named duplicate ("students_select_own_school") with
--      properly role-scoped policies, but never dropped this original
--      policy — since Postgres ORs all permissive SELECT policies together,
--      it alone still grants every authenticated user in the school,
--      INCLUDING student and parent role JWTs, full read access to every
--      row in `students` (names, DOB, gender, medical_notes, admission
--      number, class/stream). The app's own client-side
--      `.eq('auth_user_id', user.id)` filtering never mattered — a student
--      calling the Supabase client directly bypasses it entirely.
--
--   2. MEDIUM — "notifications_insert" / "system_can_insert_notifications"
--      only check school_id, with no role restriction — a student or
--      parent session can insert a notifications row with an arbitrary
--      user_id/target_role, spoofing a staff/system notification to any
--      other user. No student- or parent-facing hook ever inserts into
--      notifications (grep-confirmed), so restricting INSERT to staff
--      roles — matching the same allowlist already used by
--      messages_insert — closes the gap without touching any real flow.

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "students: school staff can view" ON "public"."students";

DROP POLICY IF EXISTS "notifications_insert" ON "public"."notifications";
CREATE POLICY "notifications_insert" ON "public"."notifications"
FOR INSERT TO "authenticated"
WITH CHECK (
  (school_id = user_school_id())
  AND (user_role() = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text, 'bursar'::text, 'class_teacher'::text, 'teacher'::text, 'it_admin'::text]))
);

DROP POLICY IF EXISTS "system_can_insert_notifications" ON "public"."notifications";
CREATE POLICY "system_can_insert_notifications" ON "public"."notifications"
FOR INSERT TO "authenticated"
WITH CHECK (
  (school_id = user_school_id())
  AND (user_role() = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text, 'bursar'::text, 'class_teacher'::text, 'teacher'::text, 'it_admin'::text]))
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a student-role JWT: SELECT * FROM students WHERE school_id = <own school>
-- should now return only own row (previously returned every student).
-- As a student-role JWT: INSERT INTO notifications (..., user_id = <another
-- user>, ...) should now be rejected (previously succeeded).
