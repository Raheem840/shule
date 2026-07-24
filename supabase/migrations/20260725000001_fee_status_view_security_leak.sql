-- Migration: fee_status_view_security_leak
-- Description: Final full-app code-review (2026-07-25) found the
-- fee_status_for_secretary view (20260724000006) is owned by postgres with
-- no security_invoker and no filtering of its own — GRANT SELECT TO
-- authenticated means ANY authenticated user, in ANY role, from ANY school,
-- can read every student's fee status/pct_paid school-wide by querying the
-- view directly (not just secretary, and not just their own school). The
-- app's own callers always add .eq('school_id', ...), but nothing at the
-- DB layer enforced that — the exact same "client always scopes it but the
-- DB doesn't" gap this session found and closed repeatedly elsewhere.
--
-- Views run with the OWNER's privileges regardless of the caller's RLS, so
-- the fix has to be an explicit filter inside the view's own query, not a
-- policy — there's no RLS to attach a policy to for a plain view reading a
-- table it owns. Restricted to exactly the callers this view actually has
-- today (grep-confirmed: secretary-role pages only) plus principal (per
-- CLAUDE.md's "Summary only" finance boundary), scoped to the caller's own
-- school. Deputy/DoS/teacher/student/parent get zero rows, matching the
-- non-negotiable finance isolation this view was supposed to preserve.

-- ── CHANGES ──────────────────────────────────────────────────

DROP VIEW IF EXISTS public.fee_status_for_secretary;

CREATE VIEW public.fee_status_for_secretary AS
SELECT
  school_id,
  student_id,
  academic_year_id,
  term,
  CASE
    WHEN COALESCE(SUM(balance), 0) <= 0 THEN 'paid'
    WHEN COALESCE(SUM(amount_paid), 0) = 0 THEN 'unpaid'
    ELSE 'partial'
  END AS status,
  CASE
    WHEN COALESCE(SUM(amount_due), 0) <= 0 THEN 100
    ELSE LEAST(100, GREATEST(0, ROUND((SUM(amount_paid) / SUM(amount_due)) * 100)))
  END::int AS pct_paid
FROM public.fee_payments
WHERE school_id = user_school_id()
  AND user_role() = ANY (ARRAY['secretary'::text, 'principal'::text])
GROUP BY school_id, student_id, academic_year_id, term;

ALTER VIEW public.fee_status_for_secretary OWNER TO postgres;
REVOKE ALL ON public.fee_status_for_secretary FROM anon;
GRANT SELECT ON public.fee_status_for_secretary TO authenticated;

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a deputy/dos/teacher/student/parent-role JWT (any school):
--   SELECT * FROM fee_status_for_secretary  → []  (was previously every
--   student's fee status, school-wide, across ALL schools)
-- As a secretary-role JWT from school A:
--   SELECT * FROM fee_status_for_secretary  → only school A's rows
--   (was previously every school's rows)
