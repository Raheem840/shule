-- Student promotion is being restricted to deputy + secretary only (removed from
-- principal and IT admin). Deputy was never granted UPDATE on students at all —
-- neither of the two existing UPDATE policies include 'deputy' — so without this,
-- a deputy-triggered promotion would silently fail with zero rows updated (RLS
-- denies, no error surfaces to the client beyond "0 rows affected").
DROP POLICY IF EXISTS "students: secretary and principal can update" ON public.students;
CREATE POLICY "students: secretary and principal can update" ON public.students
  FOR UPDATE
  USING (school_id = auth_school_id() AND auth_role() = ANY (ARRAY['principal'::text, 'secretary'::text, 'deputy'::text]))
  WITH CHECK (school_id = auth_school_id() AND auth_role() = ANY (ARRAY['principal'::text, 'secretary'::text, 'deputy'::text]));

DROP POLICY IF EXISTS "students_update_by_secretary" ON public.students;
CREATE POLICY "students_update_by_secretary" ON public.students
  FOR UPDATE
  USING (school_id = user_school_id())
  WITH CHECK (school_id = user_school_id() AND user_role() = ANY (ARRAY['secretary'::text, 'principal'::text, 'it_admin'::text, 'class_teacher'::text, 'deputy'::text]));
