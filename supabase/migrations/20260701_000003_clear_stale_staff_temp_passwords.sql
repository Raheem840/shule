-- Staff passwords are no longer generated/stored anywhere — activation and
-- reset now send an email invite/reset link instead (see
-- create-staff-auth-user / reset-staff-password edge functions). Any
-- staff.temp_password value left over from before that change is stale (may
-- no longer be the real password, since the staff member could have changed
-- it) and must not sit in the database indefinitely as a live-looking secret.
UPDATE public.staff SET temp_password = NULL WHERE temp_password IS NOT NULL;
