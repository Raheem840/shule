-- Migration: staff_password_approval_requests
-- Created: Sat 04 Jul 2026 01:12:09 AM EAT
-- Author: Sinqura Dev Team
-- Description: Replaces the email-invite/reset-link model for staff accounts
-- (blocked — school does not yet own a verified sending domain for SMTP)
-- with an in-app approval flow: a staff member submits the password they
-- want (identified by email + staff_number, works whether they already have
-- an account or not), IT admin sees WHO is requesting but never the
-- password itself, and approves/rejects. On approval an edge function
-- (service_role) creates or updates the Supabase Auth user with that
-- password. All writes to this table happen through edge functions using
-- the service_role key — no client role gets an INSERT/UPDATE/DELETE policy.

-- ── CHANGES ──────────────────────────────────────────────────

CREATE TABLE public.staff_password_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.school_profile(id),
  staff_id      uuid NOT NULL REFERENCES public.staff(id),
  kind          text NOT NULL CHECK (kind IN ('activation', 'reset')),
  new_password  text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES public.staff(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX staff_password_requests_school_status_idx
  ON public.staff_password_requests (school_id, status);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.staff_password_requests ENABLE ROW LEVEL SECURITY;

-- Only it_admin can view requests for their own school. No INSERT/UPDATE/DELETE
-- policy exists for any client role — RLS defaults to deny for a command with
-- no matching policy, so all writes must go through a service_role edge
-- function (request-staff-password, resolve-staff-password-request).
CREATE POLICY "it_admin can view password requests" ON public.staff_password_requests
FOR SELECT
USING (school_id = public.user_school_id() AND public.user_role() = 'it_admin');

GRANT ALL ON TABLE public.staff_password_requests TO anon, authenticated, service_role;

-- Column-level lock: even it_admin (the only role with a SELECT policy above)
-- must never be able to read the plaintext password, at the DB layer, not just
-- by omitting it from the client-side query. A `select('*')` from an it_admin
-- JWT will now error outright instead of silently returning the column.
REVOKE SELECT (new_password) ON public.staff_password_requests FROM anon, authenticated;

-- ── VERIFICATION ─────────────────────────────────────────────
-- As an it_admin-role JWT: SELECT id, staff_id, kind, status FROM staff_password_requests
-- should work; SELECT new_password FROM staff_password_requests should fail with
-- "permission denied for column new_password".
