-- Fixes five Critical/High findings from the 2026-07-21 audit
-- (docs/audit-findings-2026-07-21.md, C2/C3/C4/C5/H3/H4). All are the same
-- root cause repeated across tables: an overly-broad "school_id matches"
-- SELECT policy makes every narrower, correctly-scoped policy on the same
-- table moot, since Postgres ORs all permissive RLS policies together.

-- ── C2: students — any authenticated user could read every student's
-- plaintext temp_password/auth_email, because students_select_own_school
-- had no role/ownership restriction at all. Staff legitimately need to
-- browse students in their school; student/parent should only ever see
-- their own record(s). (App-side fix — stripping temp_password/auth_email
-- from useStudents.ts's general-purpose LIST_COLS — lands in the same
-- change as this migration.)
DROP POLICY IF EXISTS "students_select_own_school" ON "public"."students";

CREATE POLICY "students_select_staff" ON "public"."students" FOR SELECT TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() <> ALL (ARRAY['student', 'parent'])
  );

CREATE POLICY "students_select_own" ON "public"."students" FOR SELECT TO "authenticated"
  USING (
    "public"."user_role"() = 'student'
    AND "auth_user_id" = "auth"."uid"()
  );

CREATE POLICY "students_select_parent_child" ON "public"."students" FOR SELECT TO "authenticated"
  USING (
    "public"."user_role"() = 'parent'
    AND ("auth"."jwt"() -> 'student_ids') ? ("id"::"text")
  );

-- ── C3: parent_accounts — parent_accounts_select had the identical
-- unscoped shape, silently making the already-correct narrower policies
-- (parent_can_view_own_account, secretary_principal_can_view_parent_accounts,
-- secretary_manages_parent_accounts, parent_reads_own_account) redundant.
-- Those cover every legitimate access pattern already — just drop the
-- broad one.
DROP POLICY IF EXISTS "parent_accounts_select" ON "public"."parent_accounts";

-- ── C4: attendance — attendance_select had no role restriction, silently
-- overriding "attendance: teacher sees own records" (which correctly
-- restricts teachers to their own recorded entries, admin roles to their
-- school). No student/parent-facing page reads this table directly today,
-- so excluding those two roles here is a pure tightening, not a
-- regression. Every staff-facing consumer keeps working exactly as before
-- — this only removes the student/parent leak path.
DROP POLICY IF EXISTS "attendance_select" ON "public"."attendance";

CREATE POLICY "attendance_select" ON "public"."attendance" FOR SELECT TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() <> ALL (ARRAY['student', 'parent'])
  );

-- ── C5: school_profile — school_profile_select_public is USING (true) so
-- pre-login branding (school name/logo/colors) can render before a
-- session exists. RLS is row-level, not column-level, so it also exposes
-- live Africa's Talking / WhatsApp Cloud API secrets to anyone with the
-- public anon key, and separately to every logged-in user regardless of
-- role once authenticated (checked: every consumer of this table in the
-- app selects only branding columns except useAdmin.ts's
-- useApiConfigStatus, which already only ever surfaces booleans to the UI
-- — the raw values it fetches were being sent to the browser and thrown
-- away unused). Column-level REVOKE works correctly here because anon vs
-- authenticated are genuinely distinct Postgres roles (unlike the app's
-- staff/student/parent sub-roles, which all collapse into one
-- `authenticated` Postgres role via JWT claims + RLS).
REVOKE SELECT (
  "at_api_key", "at_username", "at_sender_id",
  "wa_phone_number_id", "wa_access_token", "wa_business_account_id",
  "sms_api_key", "sms_username", "sms_sender_id"
) ON "public"."school_profile" FROM "anon", "authenticated";

-- Presence-only status check for the API Config settings page (useAdmin.ts
-- useApiConfigStatus / src/pages/admin/ApiConfigPage.tsx) — never returns
-- the secret values themselves, only whether each individual field is set
-- (matching the existing per-field ApiConfig shape in src/types/week9.ts),
-- and restricted to the roles that manage this page.
CREATE OR REPLACE FUNCTION "public"."get_messaging_config_status"()
RETURNS TABLE (
  at_api_key_set        boolean,
  at_username_set       boolean,
  at_sender_id_set      boolean,
  wa_phone_number_id_set boolean,
  wa_access_token_set   boolean
)
LANGUAGE "sql" STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (at_api_key        IS NOT NULL AND at_api_key <> ''),
    (at_username       IS NOT NULL AND at_username <> ''),
    (at_sender_id      IS NOT NULL AND at_sender_id <> ''),
    (wa_phone_number_id IS NOT NULL AND wa_phone_number_id <> ''),
    (wa_access_token   IS NOT NULL AND wa_access_token <> '')
  FROM public.school_profile
  WHERE id = public.user_school_id()
    AND public.user_role() = ANY (ARRAY['principal', 'it_admin']);
$$;
GRANT EXECUTE ON FUNCTION "public"."get_messaging_config_status"() TO "authenticated";

-- ── H3: teacher_remarks — teacher_remarks_insert let any
-- teacher/class_teacher/principal/dos in the school insert a remark
-- attributed to ANY teacher_id, not just their own. The already-correct
-- ownership pattern exists on this exact table for UPDATE
-- (teacher_remarks_update, teacher_id IN (SELECT staff.id ...)) — INSERT
-- never got the same fix. Also drops three dead policies that compare
-- teacher_id (an FK to staff.id) directly against auth.uid(), which can
-- never match — the same bug class already fixed for attendance and
-- discipline_records, just never swept from this table.
DROP POLICY IF EXISTS "teacher_remarks_insert" ON "public"."teacher_remarks";
DROP POLICY IF EXISTS "teacher_can_insert_own_remarks" ON "public"."teacher_remarks";
DROP POLICY IF EXISTS "teacher_can_update_own_remarks" ON "public"."teacher_remarks";
DROP POLICY IF EXISTS "teachers_manage_own_remarks" ON "public"."teacher_remarks";

CREATE POLICY "teacher_remarks_insert" ON "public"."teacher_remarks" FOR INSERT TO "authenticated"
  WITH CHECK (
    "school_id" = "public"."user_school_id"()
    AND (
      "public"."user_role"() = ANY (ARRAY['principal', 'dos'])
      OR (
        "public"."user_role"() = ANY (ARRAY['class_teacher', 'teacher'])
        AND "teacher_id" IN (SELECT "staff"."id" FROM "public"."staff" WHERE "staff"."auth_user_id" = "auth"."uid"())
      )
    )
  );

-- ── H4: parent_accounts DELETE — same FK-vs-auth.uid() bug as H3: the
-- policy compared created_by (FK to staff.id) against auth.uid(), so it
-- could never match and every delete silently affected 0 rows — the exact
-- ghost-row problem this policy was written to prevent. Scoped to the
-- same roles that already manage parent_accounts elsewhere on this table
-- (insert/update), rather than "only the original creator."
DROP POLICY IF EXISTS "owner can delete parent_account" ON "public"."parent_accounts";

CREATE POLICY "parent_accounts_delete_admin" ON "public"."parent_accounts" FOR DELETE TO "authenticated"
  USING (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() = ANY (ARRAY['secretary', 'principal', 'it_admin'])
  );
