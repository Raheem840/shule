-- Migration: school_events_insert_ownership
-- Description: Teacher-role audit (2026-07-24) found "staff_manage_own_events"
-- (an ALL-command policy) only checks USING for SELECT/UPDATE/DELETE
-- (created_by = own staff id, or admin roles) — its WITH CHECK, which is what
-- actually governs INSERT, only verifies school_id. Any staff member (not
-- just admin roles) could insert a school_events row with created_by set to
-- an arbitrary staff id, impersonating another teacher's event.

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "staff_manage_own_events" ON "public"."school_events";
CREATE POLICY "staff_manage_own_events" ON "public"."school_events"
TO "authenticated"
USING (
  (school_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'school_id'::text))::uuid)
  AND (
    (((current_setting('request.jwt.claims'::text, true))::json ->> 'user_role'::text) = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text]))
    OR (created_by = (SELECT staff.id FROM staff WHERE staff.auth_user_id = auth.uid() LIMIT 1))
  )
)
WITH CHECK (
  (school_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'school_id'::text))::uuid)
  AND (
    (((current_setting('request.jwt.claims'::text, true))::json ->> 'user_role'::text) = ANY (ARRAY['principal'::text, 'deputy'::text, 'dos'::text, 'secretary'::text]))
    OR (created_by = (SELECT staff.id FROM staff WHERE staff.auth_user_id = auth.uid() LIMIT 1))
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As teacher A: INSERT INTO school_events (..., created_by = <teacher B's staff id>, ...)
-- should now be rejected (previously succeeded as long as school_id matched).
