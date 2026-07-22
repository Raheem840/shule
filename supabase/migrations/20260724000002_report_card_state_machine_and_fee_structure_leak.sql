-- Found during a manual principal-role audit.

-- ── 1. report_cards: no server-side state-machine enforcement ──────────────
-- "principal_can_update_report_cards" let a principal UPDATE any column
-- (including status) to any value on any report_cards row in their school,
-- with zero constraint on the OLD->NEW status transition. The UI only ever
-- exposes Release on an already-approved card, but nothing at the DB layer
-- stopped a card being flipped straight from 'ready' (or even 'draft') to
-- 'released' — which is immediately visible to parents/students, since
-- "parent_can_view_released_report_cards" / "student_can_view_own_released_
-- report_card" gate only on status='released', not on any approval having
-- actually happened. Split into 3 policies, one per legal transition, same
-- USING(old-status)/WITH CHECK(new-status) pattern already used correctly
-- by "secretary_can_mark_ready" (draft -> ready).
DROP POLICY IF EXISTS "principal_can_update_report_cards" ON "public"."report_cards";

CREATE POLICY "principal_can_approve_report_cards" ON "public"."report_cards"
FOR UPDATE TO "authenticated"
USING (
  ("school_id" = "public"."user_school_id"())
  AND ("public"."user_role"() = 'principal'::"text")
  AND ("status" = 'ready'::"text")
)
WITH CHECK (
  ("school_id" = "public"."user_school_id"())
  AND ("public"."user_role"() = 'principal'::"text")
  AND ("status" = 'approved'::"text")
);

CREATE POLICY "principal_can_release_report_cards" ON "public"."report_cards"
FOR UPDATE TO "authenticated"
USING (
  ("school_id" = "public"."user_school_id"())
  AND ("public"."user_role"() = 'principal'::"text")
  AND ("status" = 'approved'::"text")
)
WITH CHECK (
  ("school_id" = "public"."user_school_id"())
  AND ("public"."user_role"() = 'principal'::"text")
  AND ("status" = 'released'::"text")
);

CREATE POLICY "principal_can_unlock_report_cards" ON "public"."report_cards"
FOR UPDATE TO "authenticated"
USING (
  ("school_id" = "public"."user_school_id"())
  AND ("public"."user_role"() = 'principal'::"text")
  AND ("status" = ANY (ARRAY['approved'::"text", 'released'::"text"]))
)
WITH CHECK (
  ("school_id" = "public"."user_school_id"())
  AND ("public"."user_role"() = 'principal'::"text")
  AND ("status" = 'draft'::"text")
);

-- ── 2. fee_structure_select had no role restriction ─────────────────────────
-- "fee_structure: bursar and principal can view" (auth_role() family)
-- correctly scopes SELECT to bursar/principal, but a newer duplicate policy
-- "fee_structure_select" (user_role() family) is unconditional — any
-- authenticated staff member in the school (deputy, dos, teacher,
-- class_teacher) can read fee_structure directly via the Supabase client.
-- RLS SELECT policies are OR'd, so the unrestricted one wins regardless of
-- the correct one existing alongside it. This violates the CLAUDE.md
-- non-negotiable that deputy/dos/teacher see ZERO financial data —
-- fee_structure (amounts, applicability per class/term) is financial data
-- even though it isn't a per-student payment record. parent/student stay
-- allowed — useStudentFeeBalance (useParentPortal.ts) and useStudentPortal.ts
-- both legitimately read fee_structure to show the NAME of a fee the
-- account holder's own child is being billed for; fee_payments RLS already
-- scopes which payment rows they can see to their own child only.
DROP POLICY IF EXISTS "fee_structure_select" ON "public"."fee_structure";
CREATE POLICY "fee_structure_select" ON "public"."fee_structure"
FOR SELECT TO "authenticated"
USING (
  ("school_id" = "public"."user_school_id"())
  AND ("public"."user_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text", 'parent'::"text", 'student'::"text"]))
);
