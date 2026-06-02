-- ============================================================
-- SHULE RLS POLICIES
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Helper functions (read role + school_id from JWT claims) ──
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'user_role'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_school_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'school_id',
    auth.jwt() -> 'app_metadata' ->> 'school_id'
  )::uuid
$$;

-- ── students ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "students_select_own_school"    ON public.students;
DROP POLICY IF EXISTS "students_insert_by_secretary"  ON public.students;
DROP POLICY IF EXISTS "students_update_by_secretary"  ON public.students;
DROP POLICY IF EXISTS "students_delete_by_principal"  ON public.students;

CREATE POLICY "students_select_own_school" ON public.students
  FOR SELECT TO authenticated
  USING (school_id = public.user_school_id());

CREATE POLICY "students_insert_by_secretary" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.user_school_id()
    AND public.user_role() IN ('secretary', 'principal', 'it_admin')
  );

CREATE POLICY "students_update_by_secretary" ON public.students
  FOR UPDATE TO authenticated
  USING  (school_id = public.user_school_id())
  WITH CHECK (
    school_id = public.user_school_id()
    AND public.user_role() IN ('secretary', 'principal', 'it_admin', 'class_teacher')
  );

CREATE POLICY "students_delete_by_principal" ON public.students
  FOR DELETE TO authenticated
  USING (
    school_id = public.user_school_id()
    AND public.user_role() IN ('principal', 'it_admin')
  );

-- ── student_guardians ─────────────────────────────────────────
DROP POLICY IF EXISTS "guardians_select"  ON public.student_guardians;
DROP POLICY IF EXISTS "guardians_insert"  ON public.student_guardians;
DROP POLICY IF EXISTS "guardians_update"  ON public.student_guardians;
DROP POLICY IF EXISTS "guardians_delete"  ON public.student_guardians;

CREATE POLICY "guardians_select" ON public.student_guardians
  FOR SELECT TO authenticated USING (school_id = public.user_school_id());

CREATE POLICY "guardians_insert" ON public.student_guardians
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.user_school_id()
    AND public.user_role() IN ('secretary', 'principal', 'it_admin')
  );

CREATE POLICY "guardians_update" ON public.student_guardians
  FOR UPDATE TO authenticated
  USING (school_id = public.user_school_id())
  WITH CHECK (public.user_role() IN ('secretary', 'principal', 'it_admin'));

CREATE POLICY "guardians_delete" ON public.student_guardians
  FOR DELETE TO authenticated
  USING (school_id = public.user_school_id()
    AND public.user_role() IN ('secretary', 'principal', 'it_admin'));

-- ── staff ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_select_own_school" ON public.staff;
DROP POLICY IF EXISTS "staff_insert_secretary"  ON public.staff;
DROP POLICY IF EXISTS "staff_update_admin"      ON public.staff;
DROP POLICY IF EXISTS "staff_delete_principal"  ON public.staff;

CREATE POLICY "staff_select_own_school" ON public.staff
  FOR SELECT TO authenticated USING (school_id = public.user_school_id());

CREATE POLICY "staff_insert_secretary" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.user_school_id()
    AND public.user_role() IN ('secretary', 'principal', 'it_admin')
  );

CREATE POLICY "staff_update_admin" ON public.staff
  FOR UPDATE TO authenticated
  USING (school_id = public.user_school_id())
  WITH CHECK (public.user_role() IN ('secretary', 'principal', 'it_admin'));

CREATE POLICY "staff_delete_principal" ON public.staff
  FOR DELETE TO authenticated
  USING (school_id = public.user_school_id()
    AND public.user_role() IN ('principal', 'it_admin'));

-- ── parent_accounts ───────────────────────────────────────────
DROP POLICY IF EXISTS "parent_accounts_select" ON public.parent_accounts;
DROP POLICY IF EXISTS "parent_accounts_insert" ON public.parent_accounts;
DROP POLICY IF EXISTS "parent_accounts_update" ON public.parent_accounts;

CREATE POLICY "parent_accounts_select" ON public.parent_accounts
  FOR SELECT TO authenticated USING (school_id = public.user_school_id());

CREATE POLICY "parent_accounts_insert" ON public.parent_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.user_school_id()
    AND public.user_role() IN ('secretary', 'principal', 'it_admin')
  );

CREATE POLICY "parent_accounts_update" ON public.parent_accounts
  FOR UPDATE TO authenticated
  USING (school_id = public.user_school_id())
  WITH CHECK (public.user_role() IN ('secretary', 'principal', 'it_admin'));
