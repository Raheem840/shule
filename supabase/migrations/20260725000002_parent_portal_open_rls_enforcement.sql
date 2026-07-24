-- Migration: parent_portal_open_rls_enforcement
-- Description: Final full-app code-review (2026-07-25) found
-- school_profile.parent_portal_open — an admin/principal-facing "lock the
-- parent portal" toggle (used for fee disputes/security incidents per
-- CLAUDE.md) — is enforced ONLY client-side in ParentPortalPage.tsx (a
-- React Query check before rendering tabs). No RLS policy on any table a
-- parent reads references the column at all. A parent whose UI shows the
-- "portal closed" gate can still read their child's fees/report cards/
-- attendance/exam results/etc. via the same still-valid JWT by calling
-- Supabase directly (e.g. devtools), because every table underneath is
-- fully open regardless of the flag. This closes it at the DB layer for
-- every parent-facing SELECT policy, gated ONLY on user_role() = 'parent'
-- — the flag's name and every existing caller/doc reference is specific to
-- the parent portal, so the student portal is deliberately left untouched.

-- ── CHANGES ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_parent_portal_open()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT sp.parent_portal_open FROM school_profile sp WHERE sp.id = user_school_id()),
    true
  );
$$;

-- attendance
DROP POLICY IF EXISTS "attendance: parent can view own child" ON public.attendance;
CREATE POLICY "attendance: parent can view own child" ON public.attendance
FOR SELECT USING (
  school_id = user_school_id()
  AND user_role() = 'parent'
  AND is_parent_portal_open()
  AND student_id IN (
    SELECT unnest(parent_accounts.student_ids)
    FROM parent_accounts
    WHERE parent_accounts.school_id = user_school_id() AND parent_accounts.auth_user_id = auth.uid()
  )
);

-- exam_journal
DROP POLICY IF EXISTS "exam_journal: parent can view published for own child" ON public.exam_journal;
CREATE POLICY "exam_journal: parent can view published for own child" ON public.exam_journal
FOR SELECT USING (
  school_id = auth_school_id()
  AND is_parent_portal_open()
  AND status = 'published'
  AND id IN (
    SELECT exam_results.exam_journal_id
    FROM exam_results
    WHERE exam_results.school_id = auth_school_id()
      AND exam_results.student_id IN (
        SELECT unnest(parent_accounts.student_ids)
        FROM parent_accounts
        WHERE parent_accounts.school_id = auth_school_id() AND parent_accounts.auth_user_id = auth.uid()
      )
  )
);

-- exam_results
DROP POLICY IF EXISTS "exam_results: parent can view own child" ON public.exam_results;
CREATE POLICY "exam_results: parent can view own child" ON public.exam_results
FOR SELECT USING (
  school_id = auth_school_id()
  AND is_parent_portal_open()
  AND student_id IN (
    SELECT unnest(parent_accounts.student_ids)
    FROM parent_accounts
    WHERE parent_accounts.school_id = auth_school_id() AND parent_accounts.auth_user_id = auth.uid()
  )
  AND EXISTS (SELECT 1 FROM exam_journal ej WHERE ej.id = exam_results.exam_journal_id AND ej.status = 'published')
);

-- fee_payments
DROP POLICY IF EXISTS "fee_payments: parent can view own child" ON public.fee_payments;
CREATE POLICY "fee_payments: parent can view own child" ON public.fee_payments
FOR SELECT USING (
  is_parent_portal_open()
  AND student_id IN (
    SELECT unnest(pa.student_ids)
    FROM parent_accounts pa
    WHERE pa.auth_user_id = auth.uid() AND pa.school_id = fee_payments.school_id
  )
);

-- fee_structure_select — mixed-role policy; gate only the parent branch,
-- student/bursar/principal access is unaffected by this flag.
DROP POLICY IF EXISTS "fee_structure_select" ON public.fee_structure;
CREATE POLICY "fee_structure_select" ON public.fee_structure
FOR SELECT USING (
  school_id = user_school_id()
  AND (
    user_role() = ANY (ARRAY['bursar'::text, 'principal'::text, 'student'::text])
    OR (user_role() = 'parent' AND is_parent_portal_open())
  )
);

-- parent_accounts
DROP POLICY IF EXISTS "parent_can_view_own_account" ON public.parent_accounts;
CREATE POLICY "parent_can_view_own_account" ON public.parent_accounts
FOR SELECT USING (
  school_id = user_school_id()
  AND user_role() = 'parent'
  AND is_parent_portal_open()
  AND auth_user_id = auth.uid()
);

-- report_cards
DROP POLICY IF EXISTS "parent_can_view_released_report_cards" ON public.report_cards;
CREATE POLICY "parent_can_view_released_report_cards" ON public.report_cards
FOR SELECT USING (
  school_id = user_school_id()
  AND status = 'released'
  AND user_role() = 'parent'
  AND is_parent_portal_open()
  AND student_id IN (
    SELECT unnest(parent_accounts.student_ids)
    FROM parent_accounts
    WHERE parent_accounts.auth_user_id = auth.uid()
  )
);

-- school_events_select — mixed-role policy; student's visible_to_parents
-- access is unaffected, only the parent branch gains the portal-open check.
DROP POLICY IF EXISTS "school_events_select" ON public.school_events;
CREATE POLICY "school_events_select" ON public.school_events
FOR SELECT USING (
  school_id = user_school_id()
  AND (
    (user_role() <> ALL (ARRAY['student'::text, 'parent'::text]))
    OR (user_role() = 'student' AND visible_to_parents = true)
    OR (user_role() = 'parent' AND visible_to_parents = true AND is_parent_portal_open())
  )
);

-- students
DROP POLICY IF EXISTS "students_select_parent_child" ON public.students;
CREATE POLICY "students_select_parent_child" ON public.students
FOR SELECT USING (
  user_role() = 'parent'
  AND is_parent_portal_open()
  AND (auth.jwt() -> 'student_ids') ? (id)::text
);

-- teacher_remarks
DROP POLICY IF EXISTS "teacher_remarks: parent can view own child" ON public.teacher_remarks;
CREATE POLICY "teacher_remarks: parent can view own child" ON public.teacher_remarks
FOR SELECT USING (
  school_id = auth_school_id()
  AND is_parent_portal_open()
  AND student_id IN (
    SELECT unnest(parent_accounts.student_ids)
    FROM parent_accounts
    WHERE parent_accounts.school_id = auth_school_id() AND parent_accounts.auth_user_id = auth.uid()
  )
);

-- timetable_slots
DROP POLICY IF EXISTS "timetable: parent can view child's class" ON public.timetable_slots;
CREATE POLICY "timetable: parent can view child's class" ON public.timetable_slots
FOR SELECT USING (
  school_id = user_school_id()
  AND is_published = true
  AND user_role() = 'parent'
  AND is_parent_portal_open()
  AND EXISTS (
    SELECT 1
    FROM students s
    JOIN parent_accounts pa ON pa.auth_user_id = auth.uid() AND pa.school_id = timetable_slots.school_id
    WHERE s.id = ANY (pa.student_ids)
      AND s.class_id = timetable_slots.class_id
      AND (timetable_slots.stream_id IS NULL OR s.stream_id = timetable_slots.stream_id)
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- With school_profile.parent_portal_open = false for a school:
-- As that school's parent-role JWT: SELECT from attendance/exam_results/
-- fee_payments/report_cards/teacher_remarks/timetable_slots/students/
-- parent_accounts/exam_journal/fee_structure → [] for every one (was
-- previously full access regardless of the flag).
-- As that school's student-role JWT (same flag): unaffected, still sees
-- their own data — this flag is parent-portal-specific by design.
