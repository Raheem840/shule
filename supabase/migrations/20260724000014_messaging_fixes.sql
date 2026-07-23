-- Migration: messaging_fixes
-- Description: Messaging-system audit (2026-07-24, live pg_policies
-- checked directly per this session's established pattern).
--
--   1. CRITICAL — storage.objects on the staff-attachments bucket has two
--      leftover unscoped policies ("attachment_upload"/"attachment_read",
--      `bucket_id = 'staff-attachments'` only) still live alongside their
--      properly-scoped replacements from 20260723000001. Postgres ORs
--      permissive policies, so the old ones alone let ANY authenticated
--      user from ANY school read or write to ANY path in this public
--      bucket — same recurring bug class found across this session's other
--      audits. Dropped.
--
--   2. HIGH — messages INSERT ("staff_can_send_messages") checks
--      teacher_can_message()/parent_can_message() for those roles, but has
--      no equivalent for 'student' — a student session can message any
--      to_user_id in the school, not just their own class teacher/bursar
--      the UI restricts them to. Added student_can_message(), mirroring
--      parent_can_message()'s shape but keyed off the student's own row.
--
--   3. REGRESSION FIX — this session's earlier student-role fix
--      (20260724000011) restricted `notifications` INSERT to staff roles
--      only, based on a grep that missed useMessaging.ts's useSendMessage/
--      useSendMessageToParent — both fire a `notifications` insert to
--      notify the RECIPIENT of a message a parent or student just sent.
--      That flow has been silently RLS-rejected (swallowed by an
--      unawaited insert) since that migration landed. Restored, narrowly:
--      parent/student may now insert a notification only when
--      from_user_id = themselves, type = 'message', and target_role is
--      NULL (never a broadcast) — preserves the original fix's intent
--      (no arbitrary user_id/target_role spoofing of a staff/system
--      notification) while un-breaking the real feature.

-- ── CHANGES ──────────────────────────────────────────────────

-- 1. Drop the leftover unscoped staff-attachments storage policies.
DROP POLICY IF EXISTS "attachment_upload" ON "storage"."objects";
DROP POLICY IF EXISTS "attachment_read"   ON "storage"."objects";

-- 2. messages INSERT — add student_can_message().
CREATE OR REPLACE FUNCTION student_can_message(p_student_auth_id uuid, p_to_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_user_id = p_to_user_id AND s.role = 'bursar')
    OR EXISTS (
      SELECT 1
      FROM students stu
      JOIN staff s ON s.auth_user_id = p_to_user_id
      WHERE stu.auth_user_id = p_student_auth_id
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
    user_role() NOT IN ('teacher', 'class_teacher', 'parent', 'student')
    OR (user_role() IN ('teacher', 'class_teacher') AND teacher_can_message(auth.uid(), to_user_id))
    OR (user_role() = 'parent' AND parent_can_message(auth.uid(), to_user_id))
    OR (user_role() = 'student' AND student_can_message(auth.uid(), to_user_id))
  )
);

-- 3. notifications INSERT — restore parent/student's own-message-ping path.
DROP POLICY IF EXISTS "notifications_insert" ON "public"."notifications";
CREATE POLICY "notifications_insert" ON "public"."notifications"
FOR INSERT TO "authenticated"
WITH CHECK (
  school_id = user_school_id()
  AND (
    user_role() = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text, 'bursar'::text, 'class_teacher'::text, 'teacher'::text, 'it_admin'::text])
    OR (
      user_role() = ANY (ARRAY['parent'::text, 'student'::text])
      AND from_user = auth.uid()
      AND type = 'message'
      AND target_role IS NULL
    )
  )
);

DROP POLICY IF EXISTS "system_can_insert_notifications" ON "public"."notifications";
CREATE POLICY "system_can_insert_notifications" ON "public"."notifications"
FOR INSERT TO "authenticated"
WITH CHECK (
  school_id = user_school_id()
  AND (
    user_role() = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text, 'bursar'::text, 'class_teacher'::text, 'teacher'::text, 'it_admin'::text])
    OR (
      user_role() = ANY (ARRAY['parent'::text, 'student'::text])
      AND from_user = auth.uid()
      AND type = 'message'
      AND target_role IS NULL
    )
  )
);

-- 4. notifications SELECT — "notifications_select"'s `user_id IS NULL`
--    clause makes any such row visible to every user in the school
--    regardless of target_role, bypassing the role-targeting the other two
--    clauses enforce. No current insert path creates a user_id-NULL row
--    (confirmed by this audit), but it's a live latent gap — removed.
DROP POLICY IF EXISTS "notifications_select" ON "public"."notifications";
CREATE POLICY "notifications_select" ON "public"."notifications"
FOR SELECT TO "authenticated"
USING (
  school_id = user_school_id()
  AND (
    user_id = auth.uid()
    OR target_role = 'all_staff'
    OR target_role = user_role()
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a student-role JWT: INSERT INTO messages (..., to_user_id = <some
-- unrelated staff member>, ...) should now be rejected unless that staff
-- member is the bursar or the student's own class teacher.
-- As a parent-role JWT: send a message to the class teacher — the paired
-- notifications insert (from_user=self, type='message', target_role=null)
-- should now succeed (previously silently rejected since 20260724000011).
-- As any authenticated user from a DIFFERENT school: attempt to read/write
-- storage.objects at bucket_id='staff-attachments' with a path under
-- another school's folder — should now be rejected (previously succeeded
-- via the leftover unscoped policy).
