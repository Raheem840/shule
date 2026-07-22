-- Supports the new email-based self-service password reset flow. When a
-- student/parent completes a self-reset via the emailed recovery link, the
-- edge function clears temp_password (the old admin-issued password is now
-- stale — only the family knows the real one) and stamps this timestamp so
-- CredentialsMgmtPage.tsx can show "Self-reset on <date>" instead of either
-- a stale password or a blank/confusing empty state.

ALTER TABLE "public"."students"       ADD COLUMN IF NOT EXISTS "password_reset_at" timestamp with time zone;
ALTER TABLE "public"."parent_accounts" ADD COLUMN IF NOT EXISTS "password_reset_at" timestamp with time zone;
