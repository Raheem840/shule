-- Migration: secretary_fee_status_view_only
-- Description: Bursar-role audit (2026-07-24) found the secretary SELECT
-- policy added in 20260703000003 grants full-row access to fee_payments —
-- amount_due, amount_paid, balance, receipt_number, notes — even though
-- CLAUDE.md documents secretary as "Status flag only" and every
-- secretary-facing page only ever displays a paid/partial/unpaid badge (or
-- a rounded completion %) computed from those columns client-side. Postgres
-- RLS can only filter rows, not columns, so the real fix is a status-only
-- view the secretary reads instead of the base table.
--
-- A `fee_status_for_secretary` view already existed from an earlier session
-- but was never wired into any page (grep-confirmed zero references) and
-- had a real bug of its own: no `school_id` column, so no caller could ever
-- scope it to one school. Replacing it here with a school_id-scoped version
-- that also derives a rounded `pct_paid` (needed by ReportCardsPage's fee
-- completion filter and FeeStatusPage's 60%-paid flag) — still never
-- exposes exact currency amounts or itemized per-fee-structure detail
-- (receipt_number/notes/fee_structure_id), only a per (student, year, term)
-- status + percentage.

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
GROUP BY school_id, student_id, academic_year_id, term;

ALTER VIEW public.fee_status_for_secretary OWNER TO postgres;
REVOKE ALL ON public.fee_status_for_secretary FROM anon;
GRANT SELECT ON public.fee_status_for_secretary TO authenticated;

-- Secretary no longer needs raw fee_payments row access now that the
-- status-only view exists — this is what actually closes the "row grants
-- every column" gap, not the view alone (the view is additive; a secretary
-- JWT could still hit the base table directly until this policy is gone).
DROP POLICY IF EXISTS "fee_payments: secretary can view" ON public.fee_payments;

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a secretary-role JWT:
--   SELECT * FROM fee_payments WHERE school_id = <own school>  → [] (was previously full rows)
--   SELECT * FROM fee_status_for_secretary WHERE school_id = <own school> AND student_id = <x>
--     → one row per (academic_year_id, term) with status + pct_paid, no currency columns
