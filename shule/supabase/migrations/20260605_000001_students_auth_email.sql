-- Migration: 20260604_000002_students_auth_email
-- Add auth_email column to students so the exact Supabase auth email is stored on
-- account creation. This lets credentials pages show the correct login email regardless
-- of any formula changes to how emails are derived from admission numbers.

ALTER TABLE "public"."students"
  ADD COLUMN IF NOT EXISTS "auth_email" TEXT;
