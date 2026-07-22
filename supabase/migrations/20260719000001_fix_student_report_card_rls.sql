-- student_can_view_own_released_report_card (00003_rls_policies.sql:188) was
-- copy-pasted from the parent policy right above it and never updated to
-- reference the right table: it checked parent_accounts.auth_user_id
-- against auth.uid(), but a logged-in student's auth UUID lives on
-- students.auth_user_id, not parent_accounts.auth_user_id — so the policy
-- could never match a real student session. Every released report card
-- silently returned zero rows to the student portal (no error, RLS just
-- filters rows), even though the same query worked correctly for the
-- parent portal. Fixed to check students.auth_user_id instead.

DROP POLICY IF EXISTS "student_can_view_own_released_report_card" ON "public"."report_cards";

CREATE POLICY "student_can_view_own_released_report_card" ON "public"."report_cards"
FOR SELECT TO "authenticated"
USING (
  ("school_id" = "public"."user_school_id"())
  AND ("status" = 'released'::"text")
  AND ("public"."user_role"() = 'student'::"text")
  AND ("student_id" IN (
    SELECT "id" FROM "public"."students" WHERE "auth_user_id" = "auth"."uid"()
  ))
);
