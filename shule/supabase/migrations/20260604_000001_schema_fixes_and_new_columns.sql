-- Migration: 20260604_000001_schema_fixes_and_new_columns
-- Applied after: 00001_initial_schema, 00002_rls_policies, 00003_functions_triggers,
--               20260603000001_rls_and_hook_fixes
--
-- Changes:
--   1. fee_structure — fix applies_to constraint values (day→day_scholars, boarder→boarders)
--   2. fee_structure — add class_id (nullable FK to classes) and is_compulsory (bool)
--   3. fee_structure — update unique index to include class_id
--   4. custom_access_token_hook — extend to handle students and parents (not only staff)
--   5. notifications — RLS policies for students and parents to read their own
--   6. fee_payments  — drop broken unique index that blocks same fee per student per term
--                      when imported without fee_structure_id; replace with smarter one

-- ── 1. fix fee_structure.applies_to constraint ─────────────────────────────────
-- The initial schema used 'day' and 'boarder' but the app sends 'day_scholars' and 'boarders'

ALTER TABLE "public"."fee_structure"
  DROP CONSTRAINT IF EXISTS "fee_structure_applies_to_check";

ALTER TABLE "public"."fee_structure"
  ADD CONSTRAINT "fee_structure_applies_to_check"
  CHECK (("applies_to" = ANY (ARRAY[
    'all'::text,
    'day_scholars'::text,
    'boarders'::text
  ])));

-- Update any existing rows that used old values (safe, idempotent)
UPDATE "public"."fee_structure" SET "applies_to" = 'day_scholars' WHERE "applies_to" = 'day';
UPDATE "public"."fee_structure" SET "applies_to" = 'boarders'     WHERE "applies_to" = 'boarder';

-- ── 2. add class_id and is_compulsory to fee_structure ──────────────────────────

ALTER TABLE "public"."fee_structure"
  ADD COLUMN IF NOT EXISTS "class_id"      "uuid"    REFERENCES "public"."classes"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "is_compulsory" boolean   NOT NULL DEFAULT true;

-- ── 3. update unique index for fee_structure ────────────────────────────────────
-- Old index: (school_id, academic_year_id, term, name)
-- New index: (school_id, academic_year_id, term, name, class_id) using COALESCE for NULLs
--   allows "School Fees" for S.1 AND "School Fees" for S.2 AND "School Fees" for all

DROP INDEX IF EXISTS "public"."fee_structure_school_term_name_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "fee_structure_school_term_name_class_idx"
  ON "public"."fee_structure"
  USING "btree" (
    "school_id",
    "academic_year_id",
    "term",
    "name",
    COALESCE("class_id"::text, '——global——')
  );

-- ── 4. update custom_access_token_hook to handle students and parents ──────────
-- The original hook only checked the staff table, so students/parents got no JWT claims
-- and hit "Account not linked to a school role" on login.

CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb")
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id   UUID;
  v_role      TEXT;
  v_school_id UUID;
  v_staff_id  TEXT;
  v_name      TEXT;
BEGIN
  v_user_id := (event->>'user_id')::uuid;

  -- 1. Check staff table first (all staff roles)
  SELECT s.role::text, s.school_id, s.id::text,
         (s.first_name || ' ' || s.last_name)
  INTO   v_role, v_school_id, v_staff_id, v_name
  FROM   public.staff s
  WHERE  s.auth_user_id = v_user_id
  LIMIT  1;

  -- 2. Check students table
  IF v_role IS NULL THEN
    SELECT 'student', st.school_id, NULL, (st.first_name || ' ' || st.last_name)
    INTO   v_role, v_school_id, v_staff_id, v_name
    FROM   public.students st
    WHERE  st.auth_user_id = v_user_id
    LIMIT  1;
  END IF;

  -- 3. Check parent_accounts table
  IF v_role IS NULL THEN
    SELECT 'parent', pa.school_id, NULL, pa.full_name
    INTO   v_role, v_school_id, v_staff_id, v_name
    FROM   public.parent_accounts pa
    WHERE  pa.auth_user_id = v_user_id
    LIMIT  1;
  END IF;

  -- Inject claims if a role was found
  IF v_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
    event := jsonb_set(event, '{claims,school_id}', to_jsonb(v_school_id::text));
    IF v_name     IS NOT NULL THEN
      event := jsonb_set(event, '{claims,full_name}', to_jsonb(v_name));
    END IF;
    IF v_staff_id IS NOT NULL THEN
      event := jsonb_set(event, '{claims,staff_id}',  to_jsonb(v_staff_id));
    END IF;
  END IF;

  RETURN event;
END;
$$;

-- Keep same permissions
REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT  ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT  ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";

-- ── 5. Notifications RLS — allow students and parents to read their own ─────────
-- (Staff RLS is already correct from 00002; this adds portal-user access)

DROP POLICY IF EXISTS "notifications_student_parent_select" ON "public"."notifications";

CREATE POLICY "notifications_student_parent_select"
  ON "public"."notifications" FOR SELECT TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND "user_id" = "auth"."uid"()
  );

DROP POLICY IF EXISTS "notifications_student_parent_update" ON "public"."notifications";

CREATE POLICY "notifications_student_parent_update"
  ON "public"."notifications" FOR UPDATE TO "authenticated"
  USING  ("user_id" = "auth"."uid"())
  WITH CHECK ("user_id" = "auth"."uid"());

-- ── 6. fee_payments — ensure imports with NULL fee_structure_id are not blocked ─
-- The original unique index (student_id, fee_structure_id, term, academic_year_id)
-- would block a second import for the same student+term if fee_structure_id is different
-- (or same). Replace with a partial unique index that only fires when fee_structure_id
-- is NOT NULL, so imported rows (NULL) are never constrained.

DROP INDEX IF EXISTS "public"."fee_payments_student_fee_term_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_struct_student_term_idx"
  ON "public"."fee_payments" ("student_id", "fee_structure_id", "term", "academic_year_id")
  WHERE "fee_structure_id" IS NOT NULL;

-- ── 7. Backfill app_metadata for existing students and parents ──────────────────
-- This is safe to run multiple times (idempotent because of the WHERE clause).
-- It patches raw_app_meta_data so existing accounts can log in without needing
-- the JWT hook to hit the DB (belt-and-suspenders approach).

UPDATE "auth"."users" u
SET    "raw_app_meta_data" = "raw_app_meta_data"
         || jsonb_build_object('user_role', 'student', 'school_id', s.school_id::text)
FROM   "public"."students" s
WHERE  u.id = s.auth_user_id
  AND  s.auth_user_id IS NOT NULL
  AND  (u.raw_app_meta_data->>'user_role' IS NULL
     OR u.raw_app_meta_data->>'school_id' IS NULL);

UPDATE "auth"."users" u
SET    "raw_app_meta_data" = "raw_app_meta_data"
         || jsonb_build_object('user_role', 'parent', 'school_id', pa.school_id::text)
FROM   "public"."parent_accounts" pa
WHERE  u.id = pa.auth_user_id
  AND  pa.auth_user_id IS NOT NULL
  AND  (u.raw_app_meta_data->>'user_role' IS NULL
     OR u.raw_app_meta_data->>'school_id' IS NULL);
