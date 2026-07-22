-- Migration: deputy_can_create_departments
-- Created: Sat 04 Jul 2026 01:51:39 AM EAT
-- Author: Sinqura Dev Team
-- Description: DeputyDepartmentsPage.tsx has a working "Create Department"
-- button and edit flow (useCreateDepartment/useUpdateDepartment), but neither
-- the legacy auth_role()-based nor the current user_role()-based INSERT/UPDATE
-- policies on `departments` included 'deputy' — every deputy-side create/edit
-- was silently rejected by RLS ("new row violates row-level security policy").

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "departments: admin can insert" ON "public"."departments";
CREATE POLICY "departments: admin can insert" ON "public"."departments" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "departments: admin can update" ON "public"."departments";
CREATE POLICY "departments: admin can update" ON "public"."departments" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'deputy'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "departments_insert" ON "public"."departments";
CREATE POLICY "departments_insert" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "departments_update" ON "public"."departments";
CREATE POLICY "departments_update" ON "public"."departments" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text", 'deputy'::"text"]))));

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a deputy-role JWT: INSERT INTO departments (school_id, name) VALUES (<own school>, 'Test Dept')
-- should now succeed (previously blocked by RLS with 0 matching policies for deputy).
