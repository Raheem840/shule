-- Students and parents could never see teacher remarks at all — every
-- existing SELECT policy on teacher_remarks only allowed
-- principal/dos/secretary/teacher/class_teacher, with no student/parent
-- allowance whatsoever. RLS silently returned zero rows (no error), so a
-- remark that was genuinely entered and 100% complete on the teacher side
-- never showed up in either family portal's "Remarks" tab (which query
-- teacher_remarks directly via useParentTeacherRemarks / the student
-- portal's own equivalent). Same class of bug, same fix pattern, as the
-- exam_results/exam_journal student+parent RLS gap fixed in
-- 20260711_000001_exam_results_journal_student_parent_rls.sql.

CREATE POLICY "teacher_remarks: student can view own"
ON "public"."teacher_remarks" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND student_id = (
    SELECT id FROM public.students
    WHERE school_id = public.auth_school_id()
      AND auth_user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "teacher_remarks: parent can view own child"
ON "public"."teacher_remarks" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND student_id IN (
    SELECT unnest(student_ids)
    FROM public.parent_accounts
    WHERE school_id = public.auth_school_id()
      AND auth_user_id = auth.uid()
  )
);
