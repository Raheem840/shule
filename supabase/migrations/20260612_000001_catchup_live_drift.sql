-- Migration: 20260612_000001_catchup_live_drift
-- Captures schema drift between local migrations and live DB (audited 2026-06-12):
--   1. school_profile.parent_portal_open  — exists in live, was missing from migrations
--   2. push_subscriptions table           — created in live dashboard, no migration existed
--   3. DROP staff.salary_band             — in initial migration but never applied to live DB

-- ── 1. school_profile: parent_portal_open ─────────────────────────────────────
ALTER TABLE "public"."school_profile"
  ADD COLUMN IF NOT EXISTS "parent_portal_open" boolean NOT NULL DEFAULT true;

-- ── 2. push_subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
  "id"           uuid        NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id" uuid        NOT NULL,
  "school_id"    uuid        NOT NULL,
  "endpoint"     text        NOT NULL,
  "p256dh"       text,
  "auth"         text,
  "created_at"   timestamptz DEFAULT now(),
  "updated_at"   timestamptz DEFAULT now(),
  CONSTRAINT "push_subscriptions_pkey"                     PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_auth_user_id_endpoint_key" UNIQUE ("auth_user_id", "endpoint"),
  CONSTRAINT "push_subscriptions_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "public"."school_profile"("id") ON DELETE CASCADE,
  CONSTRAINT "push_subscriptions_auth_user_id_fkey"
    FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'push_subscriptions'
      AND policyname = 'Users manage own subscriptions'
  ) THEN
    CREATE POLICY "Users manage own subscriptions"
      ON "public"."push_subscriptions"
      FOR ALL
      USING    ((SELECT auth.uid()) = auth_user_id)
      WITH CHECK ((SELECT auth.uid()) = auth_user_id);
  END IF;
END $$;

GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";

-- ── 3. staff.salary_band — drop ghost column ─────────────────────────────────
-- Present in 00001_initial_schema.sql but was never in the live DB.
ALTER TABLE "public"."staff"
  DROP COLUMN IF EXISTS "salary_band";
