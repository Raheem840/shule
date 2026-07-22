-- CRITICAL: school_profile had RLS fully disabled with anon (the public,
-- unauthenticated key embedded in every frontend bundle) granted
-- DELETE/INSERT/SELECT/UPDATE/TRUNCATE — confirmed live via
-- pg_class.relrowsecurity=false and zero rows in pg_policies for this table.
-- This table stores real API secrets (at_api_key, sms_api_key, wa_access_token)
-- alongside branding — in a multi-tenant deployment, anyone (logged in or not,
-- from any school or none) could read every school's secrets, rewrite
-- branding/settings, or delete the row entirely.
--
-- The one legitimate need for open access is SELECT: useConnectionStatus.ts
-- deliberately pings this table unauthenticated (pre-login connectivity
-- check), and the login screen needs to show school branding pre-auth.
-- Writes have no such requirement — only useSave/useTogglePortal
-- (PrincipalSettingsPage.tsx) and useSaveSchoolSettings (useAdmin.ts, already
-- app-layer gated to it_admin/principal) ever write to this table.

ALTER TABLE public.school_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_profile_select_public" ON public.school_profile
  FOR SELECT
  USING (true);

CREATE POLICY "school_profile_insert_admin" ON public.school_profile
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_role() = ANY (ARRAY['principal', 'it_admin']));

CREATE POLICY "school_profile_update_admin" ON public.school_profile
  FOR UPDATE TO authenticated
  USING (id = public.auth_school_id())
  WITH CHECK (
    id = public.auth_school_id()
    AND public.auth_role() = ANY (ARRAY['principal', 'it_admin'])
  );

CREATE POLICY "school_profile_delete_admin" ON public.school_profile
  FOR DELETE TO authenticated
  USING (
    id = public.auth_school_id()
    AND public.auth_role() = 'it_admin'
  );
