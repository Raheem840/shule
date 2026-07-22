-- The messages table's only real 1:1-message INSERT policy (staff_can_send_messages)
-- has always restricted from_user_id's role to staff roles — 'student' and 'parent'
-- were never included. This silently broke every parent/student-initiated message
-- (parent<->bursar/class-teacher messaging, student<->bursar/class-teacher messaging):
-- the SELECT-side policies have no role restriction, so an existing staff-authored
-- thread renders fine, but a parent/student's own reply is RLS-denied with no
-- visible error surfaced by the UI (the message composer clears optimistically).
-- Widen the existing policy rather than adding a new one — Postgres RLS policies
-- for the same command are OR'd together, so this is equivalent to a new policy
-- but keeps one canonical "who can insert a 1:1 message" rule instead of two.
DROP POLICY IF EXISTS "staff_can_send_messages" ON "public"."messages";
CREATE POLICY "staff_can_send_messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (
  (school_id = public.user_school_id())
  AND (public.user_role() = ANY (ARRAY[
    'principal', 'deputy', 'dos', 'secretary', 'bursar', 'class_teacher', 'teacher', 'it_admin',
    'student', 'parent'
  ]))
  AND (from_user_id = auth.uid())
);
