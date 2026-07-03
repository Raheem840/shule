-- Migration: secretary_can_view_fee_payments
-- Created: Fri 03 Jul 2026 02:16:15 PM EAT
-- Author: Sinqura Dev Team
-- Description: fee_payments had no SELECT RLS policy at all for 'secretary'
-- (only bursar/principal/parent-own/student-own) — but CLAUDE.md's own
-- finance-boundary table documents secretary as "Status flag only", and
-- SecretaryReportsPage's "Fee Status Summary" report / School-at-a-Glance /
-- the Dashboard fee widget all already assume secretary can read this table
-- (they only ever surface paid/partial/unpaid counts, never raw amounts).
-- Without this policy those UI surfaces silently return zero rows and
-- mislabel every student as "unpaid".

-- ── CHANGES ──────────────────────────────────────────────────

CREATE POLICY "fee_payments: secretary can view" ON "public"."fee_payments"
FOR SELECT
USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'secretary'::"text")));

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a secretary-role JWT: SELECT * FROM fee_payments WHERE school_id = <own school>
-- should now return rows (previously always []).
