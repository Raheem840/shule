-- Migration: 20260606_000002_fix_auth_helper_functions
-- Applied: 2026-06-06
-- Purpose: Make auth_role() and auth_school_id() resilient to different JWT claim layouts
--          (top-level, nested under 'claims', or nested under 'app_metadata').

CREATE OR REPLACE FUNCTION "public"."auth_role"()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'claims' ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'user_role'
  );
$$;

CREATE OR REPLACE FUNCTION "public"."auth_school_id"()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'school_id')::uuid,
    (auth.jwt() -> 'claims' ->> 'school_id')::uuid,
    (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
  );
$$;
