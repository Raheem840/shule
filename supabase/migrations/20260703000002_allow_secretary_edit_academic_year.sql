-- Migration: allow_secretary_edit_academic_year
-- Created: Fri 03 Jul 2026 09:16:01 AM EAT
-- Author: Sinqura Dev Team
-- Description: AcademicYearPage (shared with principal) shows Create/Edit
-- Academic Year buttons to secretary (canManageYear = isPrincipal || isSecretary),
-- but the RLS policies gating INSERT/UPDATE on academic_years only allowed
-- 'principal'/'it_admin', so every secretary mutation silently failed at the DB.
-- There are two overlapping policy families on this table (legacy auth_role()-based
-- and current user_role()-based); both need 'secretary' added so the UI and DB agree.

-- ── CHANGES ──────────────────────────────────────────────────

-- ── RLS UPDATES ──────────────────────────────────────────────

DROP POLICY IF EXISTS "academic_years: admin can insert" ON "public"."academic_years";
CREATE POLICY "academic_years: admin can insert" ON "public"."academic_years" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"]))));

DROP POLICY IF EXISTS "academic_years: admin can update" ON "public"."academic_years";
CREATE POLICY "academic_years: admin can update" ON "public"."academic_years" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"]))));

DROP POLICY IF EXISTS "academic_years_insert" ON "public"."academic_years";
CREATE POLICY "academic_years_insert" ON "public"."academic_years" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"]))));

DROP POLICY IF EXISTS "academic_years_update" ON "public"."academic_years";
CREATE POLICY "academic_years_update" ON "public"."academic_years" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"]))));

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a secretary-role JWT: UPDATE academic_years SET label = label WHERE id = <any row in own school>
-- should now succeed (previously blocked silently by RLS, 0 rows affected, no error surfaced to UI).
