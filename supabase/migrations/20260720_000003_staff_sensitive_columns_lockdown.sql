-- CRITICAL: staff's only SELECT policy (staff_select_own_school) checks
-- school_id alone — any authenticated staff member, any role, could read
-- every other staff member's temp_password (plaintext login credential),
-- national_id, date_of_birth, and address by querying the table directly
-- (row-level RLS has no column granularity, so the UI's own discipline
-- around what it *chooses* to select — see useStaff.ts's LIST_COLS/
-- DETAIL_COLS split — was the only thing stopping this, and a direct
-- Supabase client call bypasses that entirely).
--
-- First attempt at this used REVOKE SELECT (col_list) alone and it silently
-- did nothing: Supabase's default GRANT ALL ON ALL TABLES IN SCHEMA public
-- TO authenticated already grants table-wide SELECT, and a table-wide grant
-- implies access to every column regardless of a narrower column-level
-- REVOKE — Postgres only lets a column-level REVOKE undo a column-level
-- GRANT, not carve an exception out of a table-wide one. The correct
-- pattern is invert it: revoke the table-wide SELECT entirely, then
-- explicitly GRANT SELECT on only the safe columns.
--
-- Confirmed via full-codebase search: nothing in the app actually renders
-- national_id, date_of_birth, address, or temp_password from useStaffById's
-- DETAIL_COLS anywhere (PrincipalStaffProfilePage fetches them but never
-- displays them) — so this breaks zero existing functionality. If a future
-- feature needs these fields, it should go through a SECURITY DEFINER RPC
-- that re-verifies the caller's role server-side, matching
-- save_school_api_key's pattern, not a raw table select.

REVOKE SELECT ON public.staff FROM authenticated;

GRANT SELECT (
  id, school_id, auth_user_id, staff_number, first_name, last_name, role,
  department_id, subjects, classes, qualification_level, qualification_title,
  institution, graduation_year, employment_type, employment_date, join_date,
  photo_url, is_active, email, phone, gender, last_login_at, created_at
) ON public.staff TO authenticated;
