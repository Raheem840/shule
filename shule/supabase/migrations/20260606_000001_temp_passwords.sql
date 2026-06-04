-- Migration: 20260605_000002_temp_passwords
-- Store the last-issued temp password on staff and students rows so the IT admin
-- can always retrieve credentials from the credentials page (not just from the
-- one-time card that appears at activation time).

ALTER TABLE "public"."staff"
  ADD COLUMN IF NOT EXISTS "temp_password" TEXT;

ALTER TABLE "public"."students"
  ADD COLUMN IF NOT EXISTS "temp_password" TEXT;
