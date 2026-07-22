-- Migration: remove_principal_from_students_update
-- Description: Suspend/expel authority (and all other student-record writes)
-- was moved from Principal to Deputy in the app. The previous migration
-- (20260701_000002) added 'deputy' to both students UPDATE policies but,
-- despite its own comment claiming principal was removed, left 'principal'
-- in the allowed-role arrays — so the client-side read-only restriction on
-- Principal was UI-only and could be bypassed via a direct Supabase call.
-- This migration actually removes 'principal' from both policies so the
-- Principal is a genuine read-only boundary, not just a UI convention.
--
-- Principal has no remaining code path that UPDATEs the students table
-- (verified: src/hooks/usePrincipal.ts only SELECTs students elsewhere;
-- useSuspendStudent — the only UPDATE — now requires role = 'deputy').

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "students: secretary and principal can update" ON public.students;
CREATE POLICY "students: secretary and deputy can update" ON public.students
  FOR UPDATE
  USING (school_id = auth_school_id() AND auth_role() = ANY (ARRAY['secretary'::text, 'deputy'::text]))
  WITH CHECK (school_id = auth_school_id() AND auth_role() = ANY (ARRAY['secretary'::text, 'deputy'::text]));

DROP POLICY IF EXISTS "students_update_by_secretary" ON public.students;
CREATE POLICY "students_update_by_secretary" ON public.students
  FOR UPDATE
  USING (school_id = user_school_id())
  WITH CHECK (school_id = user_school_id() AND user_role() = ANY (ARRAY['secretary'::text, 'it_admin'::text, 'class_teacher'::text, 'deputy'::text]));

-- ── VERIFICATION ─────────────────────────────────────────────
-- Run after applying to confirm it worked:
-- SELECT polname, pg_get_expr(polwithcheck, polrelid) AS with_check
-- FROM pg_policy WHERE polrelid = 'public.students'::regclass AND polcmd = 'w';
-- Expect: neither policy's with_check array contains 'principal'.
