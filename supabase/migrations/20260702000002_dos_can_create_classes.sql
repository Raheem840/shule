-- Migration: dos_can_create_classes
-- Description: DOS (Director of Studies) creates classes from DosClassesPage.tsx
-- (useCreateClass) but every INSERT was rejected with "new row violates row-level
-- security policy for table classes" because 'dos' was missing from both of the
-- classes table's INSERT policies (there are two overlapping permissive policies
-- from different migration eras — both must allow 'dos' since either one alone
-- gates the insert). Secretary/Principal/IT admin worked because they were
-- already listed.

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "classes: admin can insert" ON public.classes;
CREATE POLICY "classes: admin can insert" ON public.classes
  FOR INSERT
  WITH CHECK (school_id = auth_school_id() AND auth_role() = ANY (ARRAY['principal'::text, 'it_admin'::text, 'secretary'::text, 'dos'::text]));

DROP POLICY IF EXISTS "classes_insert" ON public.classes;
CREATE POLICY "classes_insert" ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (school_id = user_school_id() AND user_role() = ANY (ARRAY['principal'::text, 'secretary'::text, 'it_admin'::text, 'dos'::text]));

-- ── VERIFICATION ─────────────────────────────────────────────
-- Run after applying to confirm it worked:
-- SELECT polname, pg_get_expr(polwithcheck, polrelid) AS with_check
-- FROM pg_policy WHERE polrelid = 'public.classes'::regclass AND polcmd = 'a';
-- Expect: both policies' with_check arrays contain 'dos'.
