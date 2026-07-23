-- Migration: parent_role_rls_fixes
-- Description: Parent-role audit (2026-07-24), which specifically re-checked
-- LIVE pg_policies (not just migration files) after the student audit found
-- a leftover unrestricted policy coexisting with a later "fixed" narrower
-- one — found the same bug class twice more, plus a regression this
-- session's own earlier fix (20260724000010) accidentally introduced.
--
--   1. REGRESSION FIX — 20260724000010 (school_events_insert_ownership)
--      rewrote "staff_manage_own_events" to add an ownership check, but was
--      written without first checking live state and clobbered a MORE
--      refined version already live from 20260712000001
--      (teacher_class_scoped_messages_events_rls.sql), which additionally
--      required staff_has_class() for teacher/class_teacher — i.e. a
--      teacher could only manage events for classes they actually teach.
--      That scoping was silently lost. Restored here, combined with the
--      ownership check (both are compatible; the earlier migration already
--      had ownership scoping correct for teacher/class_teacher — the actual
--      gap 20260724000010 meant to close, senior roles bypassing ownership
--      entirely, was never present in the 20260712000001 version, so this
--      migration's WITH CHECK is just the 20260712000001 version restored
--      verbatim).
--
--   2. CRITICAL (live-DB-only) — "all_staff_view_events" SELECT policy has
--      no role check and no visible_to_parents check (school_id match
--      only). useSchoolNotices (useParentPortal.ts) filters
--      visible_to_parents=true purely client-side — a parent or student
--      hitting the table directly sees every internal school_events row,
--      including teacher-authored exam descriptions, journal_id, and marks
--      configuration never meant for a parent audience.
--
--   3. CRITICAL (live-DB-only) — "guardians_select" on student_guardians is
--      a leftover unrestricted SELECT policy (school_id match only, no role
--      check) coexisting with the correctly-scoped
--      "guardians: secretary and principal can view" — same bug class as
--      the confirmed CRITICAL student-audit finding. Any parent or student
--      JWT can read every family's guardian name/phone/email/
--      do_not_contact flag school-wide.
--
--   4. CRITICAL — exam_results SELECT policies for parent/student have no
--      join to exam_journal.status='published' — useStudentExamSummary
--      enforces "published only" purely client-side by filtering after a
--      separate journal fetch. A parent/student hitting the table directly
--      sees draft marks before a teacher publishes them — the same bug
--      class fixed for DoS Journals analytics earlier this session (commit
--      7ae2fbc), unfixed here.
--
--   5. HIGH — attendance has no SELECT policy for parent or student at all.
--      "attendance_select" explicitly excludes both roles and
--      "attendance: teacher sees own records" only covers staff. The Parent
--      Attendance tab (and presumably the student one) has always returned
--      zero rows, indistinguishable in the UI from "no attendance recorded
--      yet." Added scoped SELECT access for both.

-- ── CHANGES ──────────────────────────────────────────────────

-- 1. Restore staff_manage_own_events with the staff_has_class scoping that
--    20260724000010 accidentally dropped.
DROP POLICY IF EXISTS "staff_manage_own_events" ON "public"."school_events";
CREATE POLICY "staff_manage_own_events" ON "public"."school_events"
FOR ALL TO "authenticated"
USING (
  school_id = user_school_id()
  AND (
    user_role() = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text])
    OR (
      created_by = (SELECT id FROM staff WHERE auth_user_id = auth.uid() LIMIT 1)
      AND (
        user_role() NOT IN ('teacher', 'class_teacher')
        OR class_id IS NULL
        OR staff_has_class((SELECT id FROM staff WHERE auth_user_id = auth.uid() LIMIT 1), class_id)
      )
    )
  )
)
WITH CHECK (
  school_id = user_school_id()
  AND (
    user_role() = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text])
    OR (
      created_by = (SELECT id FROM staff WHERE auth_user_id = auth.uid() LIMIT 1)
      AND (
        user_role() NOT IN ('teacher', 'class_teacher')
        OR class_id IS NULL
        OR staff_has_class((SELECT id FROM staff WHERE auth_user_id = auth.uid() LIMIT 1), class_id)
      )
    )
  )
);

-- 2. school_events SELECT — staff keep full visibility; parent/student only
--    see events explicitly marked visible_to_parents.
DROP POLICY IF EXISTS "all_staff_view_events" ON "public"."school_events";
CREATE POLICY "school_events_select" ON "public"."school_events"
FOR SELECT TO "authenticated"
USING (
  school_id = user_school_id()
  AND (
    user_role() NOT IN ('student', 'parent')
    OR visible_to_parents = true
  )
);

-- 3. student_guardians — drop the leftover unrestricted SELECT policy.
DROP POLICY IF EXISTS "guardians_select" ON "public"."student_guardians";

-- 4. exam_results — parent/student SELECT must only see published journals.
DROP POLICY IF EXISTS "exam_results: parent can view own child" ON "public"."exam_results";
CREATE POLICY "exam_results: parent can view own child" ON "public"."exam_results"
FOR SELECT
USING (
  school_id = auth_school_id()
  AND student_id IN (
    SELECT unnest(parent_accounts.student_ids)
    FROM parent_accounts
    WHERE parent_accounts.school_id = auth_school_id() AND parent_accounts.auth_user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM exam_journal ej
    WHERE ej.id = exam_results.exam_journal_id AND ej.status = 'published'
  )
);

DROP POLICY IF EXISTS "exam_results: student can view own" ON "public"."exam_results";
CREATE POLICY "exam_results: student can view own" ON "public"."exam_results"
FOR SELECT
USING (
  school_id = auth_school_id()
  AND student_id = (
    SELECT students.id FROM students
    WHERE students.school_id = auth_school_id() AND students.auth_user_id = auth.uid()
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1 FROM exam_journal ej
    WHERE ej.id = exam_results.exam_journal_id AND ej.status = 'published'
  )
);

-- 5. attendance — add parent/student SELECT, scoped to their own child(ren)/self.
CREATE POLICY "attendance: parent can view own child" ON "public"."attendance"
FOR SELECT TO "authenticated"
USING (
  school_id = user_school_id()
  AND user_role() = 'parent'
  AND student_id IN (
    SELECT unnest(parent_accounts.student_ids)
    FROM parent_accounts
    WHERE parent_accounts.school_id = user_school_id() AND parent_accounts.auth_user_id = auth.uid()
  )
);

CREATE POLICY "attendance: student can view own" ON "public"."attendance"
FOR SELECT TO "authenticated"
USING (
  school_id = user_school_id()
  AND user_role() = 'student'
  AND student_id = (
    SELECT students.id FROM students
    WHERE students.school_id = user_school_id() AND students.auth_user_id = auth.uid()
    LIMIT 1
  )
);

-- 6. messages INSERT — "staff_can_send_messages" already restricts
--    teacher/class_teacher to teacher_can_message(), but has no equivalent
--    check for 'parent' — a parent session could INSERT a message to any
--    to_user_id in the school (any student, staff, or another family's
--    parent), not just the bursar/class-teacher the UI restricts them to.
--    Mirrors teacher_can_message's own use of staff_has_class().
CREATE OR REPLACE FUNCTION parent_can_message(p_parent_auth_id uuid, p_to_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_user_id = p_to_user_id AND s.role = 'bursar')
    OR EXISTS (
      SELECT 1
      FROM parent_accounts pa
      JOIN students stu ON stu.id = ANY (pa.student_ids)
      JOIN staff s ON s.auth_user_id = p_to_user_id
      WHERE pa.auth_user_id = p_parent_auth_id
        AND staff_has_class(s.id, stu.class_id)
    );
$$;

DROP POLICY IF EXISTS "staff_can_send_messages" ON "public"."messages";
CREATE POLICY "staff_can_send_messages" ON "public"."messages"
FOR INSERT
WITH CHECK (
  school_id = user_school_id()
  AND from_user_id = auth.uid()
  AND user_role() = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text, 'bursar'::text, 'class_teacher'::text, 'teacher'::text, 'it_admin'::text, 'student'::text, 'parent'::text])
  AND (
    user_role() NOT IN ('teacher', 'class_teacher', 'parent')
    OR (user_role() IN ('teacher', 'class_teacher') AND teacher_can_message(auth.uid(), to_user_id))
    OR (user_role() = 'parent' AND parent_can_message(auth.uid(), to_user_id))
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a teacher-role JWT not assigned to class X: attempt to INSERT/UPDATE a
-- school_events row with class_id=X — should be rejected (regression fixed).
-- As a parent-role JWT: SELECT * FROM school_events should only return rows
-- with visible_to_parents=true. SELECT * FROM student_guardians should
-- return zero rows (parents have no direct guardian-table access). SELECT *
-- FROM exam_results for own child should exclude any row whose journal is
-- still 'draft'. SELECT * FROM attendance for own child should now return
-- rows (previously always empty).
