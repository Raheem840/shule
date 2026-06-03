-- Migration: 20260603000001_rls_and_hook_fixes
-- Fixes:
--   1. curriculum_plan — add teacher INSERT/DELETE policies
--   2. exam_journal    — add full CRUD policies for teachers
--   3. streams         — add dos to UPDATE policy
--   4. custom_access_token_hook — inject staff_id into JWT claims

-- ── 1. curriculum_plan: teacher INSERT ────────────────────────────────────────

CREATE POLICY "teacher_can_insert_curriculum" ON "public"."curriculum_plan"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() IN ('teacher', 'class_teacher', 'dos', 'principal')
  );

CREATE POLICY "teacher_can_delete_own_curriculum" ON "public"."curriculum_plan"
  FOR DELETE TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND (
      "public"."user_role"() IN ('dos', 'principal')
      OR "covered_by" IN (SELECT "id" FROM "public"."staff" WHERE "auth_user_id" = "auth"."uid"())
    )
  );

-- ── 2. exam_journal: full CRUD for teachers ──────────────────────────────────

CREATE POLICY "exam_journal_teacher_select" ON "public"."exam_journal"
  FOR SELECT TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND (
      "public"."user_role"() IN ('principal', 'dos', 'secretary', 'deputy')
      OR "teacher_id" IN (SELECT "id" FROM "public"."staff" WHERE "auth_user_id" = "auth"."uid"())
    )
  );

CREATE POLICY "exam_journal_teacher_insert" ON "public"."exam_journal"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() IN ('teacher', 'class_teacher')
    AND "teacher_id" IN (SELECT "id" FROM "public"."staff" WHERE "auth_user_id" = "auth"."uid"())
  );

CREATE POLICY "exam_journal_teacher_update" ON "public"."exam_journal"
  FOR UPDATE TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND (
      "public"."user_role"() = 'principal'
      OR "teacher_id" IN (SELECT "id" FROM "public"."staff" WHERE "auth_user_id" = "auth"."uid"())
    )
  )
  WITH CHECK (
    "school_id" = "public"."user_school_id"()
  );

CREATE POLICY "exam_journal_teacher_delete" ON "public"."exam_journal"
  FOR DELETE TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND (
      "public"."user_role"() = 'principal'
      OR "teacher_id" IN (SELECT "id" FROM "public"."staff" WHERE "auth_user_id" = "auth"."uid"())
    )
  );

-- ── 3. streams: add dos to UPDATE ─────────────────────────────────────────────

DROP POLICY IF EXISTS "streams_update" ON "public"."streams";

CREATE POLICY "streams_update" ON "public"."streams"
  FOR UPDATE TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() IN ('principal', 'secretary', 'it_admin', 'dos')
  )
  WITH CHECK (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() IN ('principal', 'secretary', 'it_admin', 'dos')
  );

-- ── 4. JWT hook: also inject staff_id ────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb")
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_role      TEXT;
  v_school_id UUID;
  v_staff_id  UUID;
BEGIN
  SELECT s.role, s.school_id, s.id
  INTO v_role, v_school_id, v_staff_id
  FROM public.staff s
  WHERE s.auth_user_id = (event->>'user_id')::uuid;

  IF v_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}',  to_jsonb(v_role));
    event := jsonb_set(event, '{claims,school_id}',  to_jsonb(v_school_id::text));
    event := jsonb_set(event, '{claims,staff_id}',   to_jsonb(v_staff_id::text));
  END IF;

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."custom_access_token_hook" TO "supabase_auth_admin";

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT
  schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('curriculum_plan', 'exam_journal', 'streams')
  AND policyname IN (
    'teacher_can_insert_curriculum',
    'exam_journal_teacher_insert',
    'streams_update'
  )
ORDER BY tablename, policyname;
