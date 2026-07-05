-- Migration: deputy_can_insert_promotion_tables
-- Created: Sun 05 Jul 2026
-- Author: Sinqura Dev Team
-- Description: The rewritten student-promotion flow (usePromoteStudents /
-- useSelectivePromote in src/hooks/useAdmin.ts) is app-gated to deputy and
-- secretary, and now creates the next academic year's row (if missing) plus
-- its classes/streams (mirrored forward from the active year) as part of a
-- single promotion click. But the live RLS policies on academic_years,
-- classes, and streams only allowed principal/it_admin/secretary(/dos for
-- classes+streams) to INSERT — 'deputy' was missing from ALL SIX policies
-- (both the auth_role()-based and user_role()-based family on each table).
-- A deputy-initiated promotion that needed to create the next year (the
-- common case — most schools won't have pre-created it) would fail with a
-- raw RLS violation, even though the app UI lets a deputy click "Promote".

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "academic_years: admin can insert" ON "public"."academic_years";
CREATE POLICY "academic_years: admin can insert" ON "public"."academic_years"
FOR INSERT
WITH CHECK ((("school_id" = "auth_school_id"()) AND ("auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "academic_years_insert" ON "public"."academic_years";
CREATE POLICY "academic_years_insert" ON "public"."academic_years"
FOR INSERT TO "authenticated"
WITH CHECK ((("school_id" = "user_school_id"()) AND ("user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "classes: admin can insert" ON "public"."classes";
CREATE POLICY "classes: admin can insert" ON "public"."classes"
FOR INSERT
WITH CHECK ((("school_id" = "auth_school_id"()) AND ("auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text", 'dos'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "classes_insert" ON "public"."classes";
CREATE POLICY "classes_insert" ON "public"."classes"
FOR INSERT TO "authenticated"
WITH CHECK ((("school_id" = "user_school_id"()) AND ("user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text", 'dos'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "streams: admin can insert" ON "public"."streams";
CREATE POLICY "streams: admin can insert" ON "public"."streams"
FOR INSERT
WITH CHECK ((("school_id" = "auth_school_id"()) AND ("auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text", 'dos'::"text", 'deputy'::"text"]))));

DROP POLICY IF EXISTS "streams_insert" ON "public"."streams";
CREATE POLICY "streams_insert" ON "public"."streams"
FOR INSERT TO "authenticated"
WITH CHECK ((("school_id" = "user_school_id"()) AND ("user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text", 'dos'::"text", 'deputy'::"text"]))));

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a deputy-role JWT: INSERT INTO academic_years (school_id, label) VALUES (<own school>, 'Test Year')
-- should now succeed (previously rejected by RLS). Same for classes/streams inserts scoped to own school.
