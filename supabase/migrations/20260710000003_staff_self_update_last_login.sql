-- AppShell stamps staff.last_login_at on first login so the onboarding
-- wizard + password-reset banner show exactly once. The only staff UPDATE
-- policy (staff_update_admin) is restricted to secretary/principal/it_admin/dos,
-- so that stamp silently failed (RLS zero-row match, not an error) for every
-- other role — teacher, class_teacher, bursar, deputy, dos-as-viewer never got
-- last_login_at persisted, so the onboarding modal reappeared on every login.
CREATE POLICY "staff: can update own last_login_at"
  ON public.staff
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
