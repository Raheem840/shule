-- Students and parents could never see exam results/marks at all — the
-- Student and Parent portals' "My Results"/"Performance" views query
-- exam_results and exam_journal directly, but neither table's SELECT policy
-- had any allowance for the 'student' or 'parent_accounts' side, only
-- teacher/principal/dos/secretary/deputy. RLS silently returned zero rows
-- (not an error), so marks that were genuinely entered and published never
-- showed up for the family they belong to. Mirrors the existing
-- fee_payments parent/student self-access pattern.

CREATE POLICY "exam_results: student can view own"
ON "public"."exam_results" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND student_id = (
    SELECT id FROM public.students
    WHERE school_id = public.auth_school_id()
      AND auth_user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "exam_results: parent can view own child"
ON "public"."exam_results" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND student_id IN (
    SELECT unnest(student_ids)
    FROM public.parent_accounts
    WHERE school_id = public.auth_school_id()
      AND auth_user_id = auth.uid()
  )
);

-- exam_journal: student/parent only need to resolve published journals'
-- metadata (subject, total_marks) for their own child's results — draft
-- journals stay invisible to them, matching every other published-only view.
CREATE POLICY "exam_journal: student can view published for own results"
ON "public"."exam_journal" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND status = 'published'
  AND id IN (
    SELECT exam_journal_id FROM public.exam_results
    WHERE school_id = public.auth_school_id()
      AND student_id = (
        SELECT id FROM public.students
        WHERE school_id = public.auth_school_id()
          AND auth_user_id = auth.uid()
        LIMIT 1
      )
  )
);

CREATE POLICY "exam_journal: parent can view published for own child"
ON "public"."exam_journal" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND status = 'published'
  AND id IN (
    SELECT exam_journal_id FROM public.exam_results
    WHERE school_id = public.auth_school_id()
      AND student_id IN (
        SELECT unnest(student_ids)
        FROM public.parent_accounts
        WHERE school_id = public.auth_school_id()
          AND auth_user_id = auth.uid()
      )
  )
);
