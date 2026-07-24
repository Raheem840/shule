-- Migration: exam_journal_update_ownership
-- Description: Marks-import/journal-lifecycle audit (2026-07-24) found
-- "exam_journal_teacher_update"'s WITH CHECK only verifies school_id — it
-- doesn't re-check teacher_id ownership on the NEW row values (only USING
-- checks the pre-update row, which is correct). A teacher editing their own
-- journal could reassign teacher_id/class_id/subject_id to anything in the
-- school via a direct API call. No UI field exercises this today, but the
-- DB-layer gap should match the (correct) USING clause.

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "exam_journal_teacher_update" ON "public"."exam_journal";
CREATE POLICY "exam_journal_teacher_update" ON "public"."exam_journal"
FOR UPDATE TO "authenticated"
USING (
  school_id = user_school_id()
  AND (
    user_role() = 'principal'
    OR teacher_id IN (SELECT staff.id FROM staff WHERE staff.auth_user_id = auth.uid())
  )
)
WITH CHECK (
  school_id = user_school_id()
  AND (
    user_role() = 'principal'
    OR teacher_id IN (SELECT staff.id FROM staff WHERE staff.auth_user_id = auth.uid())
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As teacher A: UPDATE exam_journal SET teacher_id = <teacher B's staff id>
-- WHERE id = <A's own journal> should now be rejected.
