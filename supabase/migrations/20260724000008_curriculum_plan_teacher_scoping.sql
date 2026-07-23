-- Migration: curriculum_plan_teacher_scoping
-- Description: Teacher-role audit (2026-07-24) found two real breaks in
-- curriculum_plan RLS left by 20260717000001 (which correctly removed
-- dos/principal's ability to mark-covered, but left only one one-way gate):
--
--   1. "teacher_can_mark_covered" is a one-way false→true UPDATE policy
--      (USING covered=false, WITH CHECK covered=true). TeacherCurriculumPage's
--      "unmark as covered" action sets covered:false, which matches ZERO
--      remaining UPDATE policy — the topic is stuck "covered" forever the
--      moment a teacher taps it by mistake.
--   2. "teacher_can_delete_own_curriculum" (20260603000001) keys ownership
--      off covered_by, which is only ever set once a topic IS covered — so
--      it can never match the only state the UI's delete button is shown for
--      (covered = false, i.e. covered_by IS NULL). The delete path has been
--      dead since it shipped.
--
-- Fixed by adding a symmetric unmark policy and widening delete to also
-- cover a teacher's own currently-assigned, not-yet-covered topics (via the
-- same class-assignment EXISTS check already used by the attendance
-- policies), instead of the covered_by-only check that a pending topic can
-- never satisfy.

-- ── CHANGES ──────────────────────────────────────────────────

CREATE POLICY "teacher_can_unmark_covered" ON "public"."curriculum_plan"
FOR UPDATE TO "authenticated"
USING (
  school_id = user_school_id()
  AND user_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
  AND covered = true
)
WITH CHECK (
  school_id = user_school_id()
  AND user_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
  AND covered = false
);

DROP POLICY IF EXISTS "teacher_can_delete_own_curriculum" ON "public"."curriculum_plan";
CREATE POLICY "teacher_can_delete_own_curriculum" ON "public"."curriculum_plan"
FOR DELETE TO "authenticated"
USING (
  school_id = user_school_id()
  AND (
    user_role() = ANY (ARRAY['dos'::text, 'principal'::text])
    OR covered_by IN (SELECT id FROM staff WHERE auth_user_id = auth.uid())
    OR (
      covered = false
      AND user_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.auth_user_id = auth.uid()
          AND s.school_id = curriculum_plan.school_id
          AND (
            curriculum_plan.class_id = ANY (s.classes)
            OR EXISTS (
              SELECT 1 FROM streams st
              WHERE st.class_teacher_id = s.id AND st.class_id = curriculum_plan.class_id
            )
          )
      )
    )
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a teacher-role JWT: mark a topic covered, then immediately unmark it —
-- both should now succeed (previously unmark silently failed). Add a topic
-- for an assigned class, then delete it while still uncovered — should now
-- succeed (previously always rejected).
