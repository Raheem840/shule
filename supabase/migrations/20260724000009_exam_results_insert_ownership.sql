-- Migration: exam_results_insert_ownership
-- Description: Teacher-role audit (2026-07-24) found "exam_results: teacher
-- can insert" only checks school_id + role — it never verifies teacher_id
-- matches the caller's own staff id, unlike the sibling UPDATE policy which
-- does. Because useSaveMarks upserts on conflict (exam_journal_id,
-- student_id), the FIRST write for any given student+journal goes through
-- this permissive INSERT check rather than the ownership-checked UPDATE
-- policy — any teacher who learns another teacher's exam_journal_id (e.g.
-- via a shared school_events.journal_id) could insert exam_results rows
-- with an arbitrary teacher_id into a colleague's still-open journal before
-- the real marks are entered.

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "exam_results: teacher can insert" ON "public"."exam_results";
CREATE POLICY "exam_results: teacher can insert" ON "public"."exam_results"
FOR INSERT
WITH CHECK (
  school_id = auth_school_id()
  AND (
    auth_role() = 'principal'::text
    OR (
      auth_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
      AND teacher_id = (SELECT staff.id FROM staff WHERE staff.auth_user_id = auth.uid())
    )
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As teacher A: INSERT INTO exam_results (..., teacher_id = <teacher B's staff id>, ...)
-- should now be rejected (previously succeeded as long as school_id matched).
