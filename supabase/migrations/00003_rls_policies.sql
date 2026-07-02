-- Migration: 00003_rls_policies
-- Renumbered from 00002 → 00003: these policies call auth_school_id()/auth_role(),
-- which are defined in 00002_functions_triggers.sql — must load after it.
-- Source: supabase db dump --linked --schema public (2026-06-02)
-- Contents: ENABLE ROW LEVEL SECURITY + all CREATE POLICY statements

-- ── ENABLE RLS ────────────────────────────────────────────────────────────────

ALTER TABLE "public"."academic_years"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."attendance"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_log"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."classes"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."curriculum_plan"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."departments"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discipline_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."error_log"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."exam_journal"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."exam_results"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fee_payments"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fee_structure"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."parent_accounts"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."report_cards"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."school_events"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."school_registry"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."send_queue"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sms_reminders"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff_documents"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."streams"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."student_guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."student_surveys"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."students"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subjects"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."survey_responses"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sync_queue"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."teacher_remarks"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."timetable_slots"   ENABLE ROW LEVEL SECURITY;

-- ── ACADEMIC YEARS ────────────────────────────────────────────────────────────

CREATE POLICY "academic_years: admin can insert" ON "public"."academic_years" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "academic_years: admin can update" ON "public"."academic_years" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "academic_years: principal can delete" ON "public"."academic_years" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "academic_years: school members can view" ON "public"."academic_years" FOR SELECT USING (("school_id" = "public"."auth_school_id"()));
CREATE POLICY "academic_years_insert" ON "public"."academic_years" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "academic_years_select" ON "public"."academic_years" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "academic_years_update" ON "public"."academic_years" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));

-- ── ATTENDANCE ────────────────────────────────────────────────────────────────

CREATE POLICY "attendance: principal can delete" ON "public"."attendance" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "attendance: staff can insert" ON "public"."attendance" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text", 'secretary'::"text", 'principal'::"text"]))));
CREATE POLICY "attendance: staff can update own" ON "public"."attendance" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND (("recorded_by" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))) OR ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"]))))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND (("recorded_by" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))) OR ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"])))));
CREATE POLICY "attendance: teacher sees own records" ON "public"."attendance" FOR SELECT USING ((("school_id" = "public"."auth_school_id"()) AND (("recorded_by" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))) OR ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'dos'::"text", 'deputy'::"text", 'secretary'::"text"])))));
CREATE POLICY "attendance_insert" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text", 'secretary'::"text", 'principal'::"text"]))));
CREATE POLICY "attendance_select" ON "public"."attendance" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "attendance_update" ON "public"."attendance" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text", 'secretary'::"text", 'principal'::"text"]))));

-- ── AUDIT LOG ────────────────────────────────────────────────────────────────

CREATE POLICY "audit_log_insert_all" ON "public"."audit_log" FOR INSERT TO "authenticated" WITH CHECK (("school_id" = "public"."user_school_id"()));
CREATE POLICY "audit_log_principal_read" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'principal'::"text")));
CREATE POLICY "principal_can_view_audit_log" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'principal'::"text")));
CREATE POLICY "staff_can_insert_audit_log" ON "public"."audit_log" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("user_id" = "auth"."uid"())));

-- ── CLASSES ──────────────────────────────────────────────────────────────────

CREATE POLICY "classes: admin can insert" ON "public"."classes" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"]))));
CREATE POLICY "classes: admin can update" ON "public"."classes" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text"]))));
CREATE POLICY "classes: principal can delete" ON "public"."classes" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "classes: school members can view" ON "public"."classes" FOR SELECT USING (("school_id" = "public"."auth_school_id"()));
CREATE POLICY "classes_insert" ON "public"."classes" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));
CREATE POLICY "classes_select" ON "public"."classes" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "classes_update" ON "public"."classes" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));

-- ── CURRICULUM PLAN ──────────────────────────────────────────────────────────

CREATE POLICY "all_staff_can_view_curriculum" ON "public"."curriculum_plan" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'dos'::"text", 'secretary'::"text", 'bursar'::"text", 'class_teacher'::"text", 'teacher'::"text", 'it_admin'::"text"]))));
CREATE POLICY "curriculum_plan_insert" ON "public"."curriculum_plan" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'dos'::"text"]))));
CREATE POLICY "curriculum_plan_select" ON "public"."curriculum_plan" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "curriculum_plan_update" ON "public"."curriculum_plan" FOR UPDATE TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "dos_principal_can_insert_curriculum" ON "public"."curriculum_plan" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['dos'::"text", 'principal'::"text"]))));
CREATE POLICY "dos_principal_can_update_curriculum" ON "public"."curriculum_plan" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['dos'::"text", 'principal'::"text"])))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['dos'::"text", 'principal'::"text"]))));
CREATE POLICY "teacher_can_mark_covered" ON "public"."curriculum_plan" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text"])) AND ("covered" = false))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text"])) AND ("covered" = true)));

-- ── DEPARTMENTS ──────────────────────────────────────────────────────────────

CREATE POLICY "departments: admin can insert" ON "public"."departments" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "departments: admin can update" ON "public"."departments" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "departments: principal can delete" ON "public"."departments" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "departments: school members can view" ON "public"."departments" FOR SELECT USING (("school_id" = "public"."auth_school_id"()));
CREATE POLICY "departments_insert" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));
CREATE POLICY "departments_select" ON "public"."departments" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "departments_update" ON "public"."departments" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));

-- ── DISCIPLINE RECORDS ───────────────────────────────────────────────────────

CREATE POLICY "deputy_can_delete_discipline" ON "public"."discipline_records" FOR DELETE TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['deputy'::"text", 'principal'::"text"]))));
CREATE POLICY "deputy_principal_can_insert_discipline" ON "public"."discipline_records" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['deputy'::"text", 'principal'::"text"]))));
CREATE POLICY "deputy_principal_can_update_discipline" ON "public"."discipline_records" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['deputy'::"text", 'principal'::"text"])))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['deputy'::"text", 'principal'::"text"]))));
CREATE POLICY "discipline_records_delete" ON "public"."discipline_records" FOR DELETE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("public"."user_role"() = 'principal'::"text") OR (("public"."user_role"() = 'deputy'::"text") AND ("recorded_by" = "auth"."uid"())))));
CREATE POLICY "discipline_records_insert" ON "public"."discipline_records" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text"]))));
CREATE POLICY "discipline_records_select" ON "public"."discipline_records" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'secretary'::"text"]))));
CREATE POLICY "discipline_records_update" ON "public"."discipline_records" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text"]))));
CREATE POLICY "senior_staff_can_view_discipline" ON "public"."discipline_records" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'secretary'::"text"]))));

-- ── ERROR LOG (deny all school JWTs) ─────────────────────────────────────────

CREATE POLICY "error_log_deny_all" ON "public"."error_log" TO "authenticated" USING (false);
CREATE POLICY "no_school_access" ON "public"."error_log" TO "authenticated" USING (false) WITH CHECK (false);

-- ── EXAM JOURNAL & RESULTS ───────────────────────────────────────────────────

CREATE POLICY "exam_results: principal can delete" ON "public"."exam_results" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "exam_results: teacher can insert" ON "public"."exam_results" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text", 'principal'::"text"]))));
CREATE POLICY "exam_results: teacher can update own" ON "public"."exam_results" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND (("teacher_id" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))) OR ("public"."auth_role"() = 'principal'::"text")))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND (("teacher_id" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))) OR ("public"."auth_role"() = 'principal'::"text"))));
CREATE POLICY "exam_results: teacher sees own" ON "public"."exam_results" FOR SELECT USING ((("school_id" = "public"."auth_school_id"()) AND (("teacher_id" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))) OR ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'dos'::"text", 'secretary'::"text"])))));

-- ── FEE PAYMENTS ─────────────────────────────────────────────────────────────

CREATE POLICY "fee_payments: bursar and principal can insert" ON "public"."fee_payments" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "fee_payments: bursar and principal can update" ON "public"."fee_payments" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "fee_payments: bursar and principal can view" ON "public"."fee_payments" FOR SELECT USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "fee_payments: principal can delete" ON "public"."fee_payments" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));

-- ── FEE STRUCTURE ─────────────────────────────────────────────────────────────

CREATE POLICY "fee_structure: bursar and principal can insert" ON "public"."fee_structure" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "fee_structure: bursar and principal can update" ON "public"."fee_structure" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "fee_structure: bursar and principal can view" ON "public"."fee_structure" FOR SELECT USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "fee_structure: principal can delete" ON "public"."fee_structure" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "fee_structure_insert" ON "public"."fee_structure" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "fee_structure_select" ON "public"."fee_structure" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "fee_structure_update" ON "public"."fee_structure" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));

-- ── STUDENT GUARDIANS ────────────────────────────────────────────────────────

CREATE POLICY "guardians: principal can delete" ON "public"."student_guardians" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "guardians: secretary and principal can insert" ON "public"."student_guardians" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"]))));
CREATE POLICY "guardians: secretary and principal can update" ON "public"."student_guardians" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"]))));
CREATE POLICY "guardians: secretary and principal can view" ON "public"."student_guardians" FOR SELECT USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'bursar'::"text"]))));
CREATE POLICY "guardians_delete" ON "public"."student_guardians" FOR DELETE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "guardians_insert" ON "public"."student_guardians" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "guardians_select" ON "public"."student_guardians" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "guardians_update" ON "public"."student_guardians" FOR UPDATE TO "authenticated" USING (("school_id" = "public"."user_school_id"())) WITH CHECK (("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text"])));

-- ── MESSAGES ──────────────────────────────────────────────────────────────────

CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("from_user_id" = "auth"."uid"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'dos'::"text", 'secretary'::"text", 'bursar'::"text", 'class_teacher'::"text", 'teacher'::"text", 'it_admin'::"text"]))));
CREATE POLICY "messages_select" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("from_user_id" = "auth"."uid"()) OR ("to_user_id" = "auth"."uid"()) OR ("public"."user_role"() = 'principal'::"text"))));
CREATE POLICY "messages_update_read" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("to_user_id" = "auth"."uid"())));
CREATE POLICY "recipient_can_mark_read" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("to_user_id" = "auth"."uid"()))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("to_user_id" = "auth"."uid"())));
CREATE POLICY "senior_staff_can_post_announcements" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("is_announcement" = true) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'dos'::"text", 'secretary'::"text", 'bursar'::"text", 'it_admin'::"text"])) AND ("from_user_id" = "auth"."uid"())));
CREATE POLICY "staff_can_send_messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'dos'::"text", 'secretary'::"text", 'bursar'::"text", 'class_teacher'::"text", 'teacher'::"text", 'it_admin'::"text"])) AND ("from_user_id" = "auth"."uid"())));
CREATE POLICY "staff_can_view_messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("public"."user_role"() = 'principal'::"text") OR ("from_user_id" = "auth"."uid"()) OR ("to_user_id" = "auth"."uid"()) OR ("is_announcement" = true))));
CREATE POLICY "staff_read_own_messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND (("from_user_id" = "auth"."uid"()) OR ("to_user_id" = "auth"."uid"()) OR ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = 'principal'::"text"))));

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("school_id" = "public"."user_school_id"()));
CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("user_id" = "auth"."uid"()) OR ("user_id" IS NULL) OR ("target_role" = 'all_staff'::"text") OR ("target_role" = "public"."user_role"()))));
CREATE POLICY "notifications_update_read" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("user_id" = "auth"."uid"())));
CREATE POLICY "system_can_insert_notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("school_id" = "public"."user_school_id"()));
CREATE POLICY "users_see_own_notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("user_id" = "auth"."uid"())));
CREATE POLICY "users_update_own_notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("user_id" = "auth"."uid"())));

-- ── PARENT ACCOUNTS ───────────────────────────────────────────────────────────

CREATE POLICY "parent_accounts_insert" ON "public"."parent_accounts" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "parent_accounts_select" ON "public"."parent_accounts" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "parent_accounts_update" ON "public"."parent_accounts" FOR UPDATE TO "authenticated" USING (("school_id" = "public"."user_school_id"())) WITH CHECK (("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text"])));
CREATE POLICY "parent_can_view_own_account" ON "public"."parent_accounts" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'parent'::"text") AND ("auth_user_id" = "auth"."uid"())));
CREATE POLICY "parent_reads_own_account" ON "public"."parent_accounts" FOR SELECT TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ("email" = "auth"."email"())));
CREATE POLICY "secretary_manages_parent_accounts" ON "public"."parent_accounts" TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['secretary'::"text", 'principal'::"text"])))) WITH CHECK ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['secretary'::"text", 'principal'::"text"]))));
CREATE POLICY "secretary_principal_can_insert_parent_accounts" ON "public"."parent_accounts" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text"]))));
CREATE POLICY "secretary_principal_can_update_parent_accounts" ON "public"."parent_accounts" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text"])))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text"]))));
CREATE POLICY "secretary_principal_can_view_parent_accounts" ON "public"."parent_accounts" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text"]))));

-- ── REPORT CARDS ──────────────────────────────────────────────────────────────

CREATE POLICY "parent_can_view_released_report_cards" ON "public"."report_cards" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("status" = 'released'::"text") AND ("public"."user_role"() = 'parent'::"text") AND ("student_id" IN ( SELECT "unnest"("parent_accounts"."student_ids") AS "unnest" FROM "public"."parent_accounts" WHERE ("parent_accounts"."auth_user_id" = "auth"."uid"())))));
CREATE POLICY "principal_can_update_report_cards" ON "public"."report_cards" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'principal'::"text"))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'principal'::"text")));
CREATE POLICY "secretary_can_mark_ready" ON "public"."report_cards" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'secretary'::"text") AND ("status" = 'draft'::"text"))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'secretary'::"text") AND ("status" = 'ready'::"text")));
CREATE POLICY "secretary_principal_can_insert_report_cards" ON "public"."report_cards" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text"]))));
CREATE POLICY "staff_can_view_report_cards" ON "public"."report_cards" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'dos'::"text", 'class_teacher'::"text", 'teacher'::"text"]))));
CREATE POLICY "student_can_view_own_released_report_card" ON "public"."report_cards" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("status" = 'released'::"text") AND ("public"."user_role"() = 'student'::"text") AND ("student_id" IN ( SELECT "parent_accounts"."id" FROM "public"."parent_accounts" WHERE (("parent_accounts"."auth_user_id" = "auth"."uid"()) AND ("report_cards"."student_id" = ANY ("parent_accounts"."student_ids")))))));

-- ── SCHOOL EVENTS ─────────────────────────────────────────────────────────────

CREATE POLICY "all_staff_view_events" ON "public"."school_events" FOR SELECT TO "authenticated" USING (("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid"));
CREATE POLICY "staff_manage_own_events" ON "public"."school_events" TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND (((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'dos'::"text", 'secretary'::"text"])) OR ("created_by" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()) LIMIT 1))))) WITH CHECK (("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid"));

-- ── SCHOOL REGISTRY (deny all school JWTs) ───────────────────────────────────

CREATE POLICY "school_registry_deny_all" ON "public"."school_registry" TO "authenticated" USING (false);

-- ── SEND QUEUE ────────────────────────────────────────────────────────────────

CREATE POLICY "bursar_can_queue_messages" ON "public"."send_queue" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'bursar'::"text")));
CREATE POLICY "bursar_can_update_queue" ON "public"."send_queue" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'bursar'::"text"))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'bursar'::"text")));
CREATE POLICY "bursar_principal_can_view_queue" ON "public"."send_queue" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "send_queue_access" ON "public"."send_queue" TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'bursar'::"text", 'it_admin'::"text"])))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'bursar'::"text", 'it_admin'::"text"]))));

-- ── SMS REMINDERS ─────────────────────────────────────────────────────────────

CREATE POLICY "bursar_can_insert_reminders" ON "public"."sms_reminders" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'bursar'::"text")));
CREATE POLICY "bursar_can_update_reminder_status" ON "public"."sms_reminders" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'bursar'::"text"))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = 'bursar'::"text")));
CREATE POLICY "bursar_principal_can_view_reminders" ON "public"."sms_reminders" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['bursar'::"text", 'principal'::"text"]))));
CREATE POLICY "sms_reminders_access" ON "public"."sms_reminders" TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'bursar'::"text"])))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'bursar'::"text"]))));

-- ── STAFF ─────────────────────────────────────────────────────────────────────

CREATE POLICY "staff_delete_principal" ON "public"."staff" FOR DELETE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "staff_insert_secretary" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "staff_select_own_school" ON "public"."staff" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "staff_update_admin" ON "public"."staff" FOR UPDATE TO "authenticated" USING (("school_id" = "public"."user_school_id"())) WITH CHECK (("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text", 'dos'::"text"])));

-- ── STAFF DOCUMENTS ───────────────────────────────────────────────────────────

CREATE POLICY "staff_docs: own documents" ON "public"."staff_documents" FOR SELECT USING ((("school_id" = "public"."auth_school_id"()) AND ("staff_id" = ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"())))));
CREATE POLICY "staff_docs: principal and secretary can view" ON "public"."staff_documents" FOR SELECT USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));
CREATE POLICY "staff_docs: principal can delete" ON "public"."staff_documents" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "staff_docs: secretary and principal can insert" ON "public"."staff_documents" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"]))));
CREATE POLICY "staff_documents_insert" ON "public"."staff_documents" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));
CREATE POLICY "staff_documents_select" ON "public"."staff_documents" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"])) OR ("staff_id" IN ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))))));

-- ── STREAMS ───────────────────────────────────────────────────────────────────

CREATE POLICY "streams: admin can insert" ON "public"."streams" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text", 'dos'::"text"]))));
CREATE POLICY "streams: admin can update" ON "public"."streams" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text", 'dos'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'secretary'::"text", 'dos'::"text"]))));
CREATE POLICY "streams: principal can delete" ON "public"."streams" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "streams: school members can view" ON "public"."streams" FOR SELECT USING (("school_id" = "public"."auth_school_id"()));
CREATE POLICY "streams_insert" ON "public"."streams" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));
CREATE POLICY "streams_select" ON "public"."streams" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "streams_update" ON "public"."streams" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'it_admin'::"text"]))));

-- ── STUDENT SURVEYS ───────────────────────────────────────────────────────────

CREATE POLICY "dos_views_all_surveys" ON "public"."student_surveys" FOR SELECT TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['dos'::"text", 'principal'::"text"]))));
CREATE POLICY "student_submits_own_survey" ON "public"."student_surveys" FOR INSERT TO "authenticated" WITH CHECK (("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid"));
CREATE POLICY "student_views_own_survey" ON "public"."student_surveys" FOR SELECT TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ("student_id" = ( SELECT "students"."id" FROM "public"."students" WHERE ("students"."auth_user_id" = "auth"."uid"()) LIMIT 1))));

-- ── STUDENTS ──────────────────────────────────────────────────────────────────

CREATE POLICY "students: principal can delete" ON "public"."students" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "students: school staff can view" ON "public"."students" FOR SELECT USING (("school_id" = "public"."auth_school_id"()));
CREATE POLICY "students: secretary and principal can insert" ON "public"."students" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"]))));
CREATE POLICY "students: secretary and principal can update" ON "public"."students" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text"]))));
CREATE POLICY "students_delete_by_principal" ON "public"."students" FOR DELETE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "students_insert_by_secretary" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text"]))));
CREATE POLICY "students_select_own_school" ON "public"."students" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "students_update_by_secretary" ON "public"."students" FOR UPDATE TO "authenticated" USING (("school_id" = "public"."user_school_id"())) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'principal'::"text", 'it_admin'::"text", 'class_teacher'::"text"]))));

-- ── SUBJECTS ──────────────────────────────────────────────────────────────────

CREATE POLICY "subjects: admin can insert" ON "public"."subjects" FOR INSERT WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'dos'::"text"]))));
CREATE POLICY "subjects: admin can update" ON "public"."subjects" FOR UPDATE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'dos'::"text"])))) WITH CHECK ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text", 'dos'::"text"]))));
CREATE POLICY "subjects: principal can delete" ON "public"."subjects" FOR DELETE USING ((("school_id" = "public"."auth_school_id"()) AND ("public"."auth_role"() = 'principal'::"text")));
CREATE POLICY "subjects: school members can view" ON "public"."subjects" FOR SELECT USING (("school_id" = "public"."auth_school_id"()));
CREATE POLICY "subjects_insert" ON "public"."subjects" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'dos'::"text", 'secretary'::"text", 'it_admin'::"text"]))));
CREATE POLICY "subjects_select" ON "public"."subjects" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "subjects_update" ON "public"."subjects" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'dos'::"text", 'secretary'::"text", 'it_admin'::"text"]))));

-- ── SURVEY RESPONSES ──────────────────────────────────────────────────────────

CREATE POLICY "students_own_survey" ON "public"."survey_responses" TO "authenticated" USING (("student_id" IN ( SELECT "students"."id" FROM "public"."students" WHERE (("students"."auth_user_id" = "auth"."uid"()) AND ("students"."school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid")))));
CREATE POLICY "survey_responses_read" ON "public"."survey_responses" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("public"."user_role"() = ANY (ARRAY['principal'::"text", 'dos'::"text", 'secretary'::"text"])) OR ("student_id" IN ( SELECT "students"."id" FROM "public"."students" WHERE ("students"."auth_user_id" = "auth"."uid"()))))));
CREATE POLICY "survey_responses_student_insert" ON "public"."survey_responses" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("student_id" IN ( SELECT "students"."id" FROM "public"."students" WHERE ("students"."auth_user_id" = "auth"."uid"())))));

-- ── SYNC QUEUE ────────────────────────────────────────────────────────────────

CREATE POLICY "staff_can_delete_synced_items" ON "public"."sync_queue" FOR DELETE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("status" = 'synced'::"text")));
CREATE POLICY "staff_can_insert_sync_queue" ON "public"."sync_queue" FOR INSERT TO "authenticated" WITH CHECK (("school_id" = "public"."user_school_id"()));
CREATE POLICY "staff_can_update_sync_queue" ON "public"."sync_queue" FOR UPDATE TO "authenticated" USING (("school_id" = "public"."user_school_id"())) WITH CHECK (("school_id" = "public"."user_school_id"()));
CREATE POLICY "staff_can_view_sync_queue" ON "public"."sync_queue" FOR SELECT TO "authenticated" USING (("school_id" = "public"."user_school_id"()));
CREATE POLICY "sync_queue_access" ON "public"."sync_queue" TO "authenticated" USING (("school_id" = "public"."user_school_id"())) WITH CHECK (("school_id" = "public"."user_school_id"()));

-- ── TEACHER REMARKS ───────────────────────────────────────────────────────────

CREATE POLICY "senior_staff_read_remarks" ON "public"."teacher_remarks" FOR SELECT TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['principal'::"text", 'dos'::"text", 'secretary'::"text"]))));
CREATE POLICY "staff_can_view_remarks" ON "public"."teacher_remarks" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("public"."user_role"() = ANY (ARRAY['principal'::"text", 'secretary'::"text", 'dos'::"text"])) OR (("public"."user_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text"])) AND ("teacher_id" = "auth"."uid"())))));
CREATE POLICY "teacher_can_insert_own_remarks" ON "public"."teacher_remarks" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text"])) AND ("teacher_id" = "auth"."uid"())));
CREATE POLICY "teacher_can_update_own_remarks" ON "public"."teacher_remarks" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['teacher'::"text", 'class_teacher'::"text"])) AND ("teacher_id" = "auth"."uid"()))) WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("teacher_id" = "auth"."uid"())));
CREATE POLICY "teacher_remarks_insert" ON "public"."teacher_remarks" FOR INSERT TO "authenticated" WITH CHECK ((("school_id" = "public"."user_school_id"()) AND ("public"."user_role"() = ANY (ARRAY['class_teacher'::"text", 'teacher'::"text", 'principal'::"text", 'dos'::"text"]))));
CREATE POLICY "teacher_remarks_select" ON "public"."teacher_remarks" FOR SELECT TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND (("public"."user_role"() = ANY (ARRAY['principal'::"text", 'dos'::"text", 'secretary'::"text"])) OR ("teacher_id" IN ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"()))))));
CREATE POLICY "teacher_remarks_update" ON "public"."teacher_remarks" FOR UPDATE TO "authenticated" USING ((("school_id" = "public"."user_school_id"()) AND ("teacher_id" IN ( SELECT "staff"."id" FROM "public"."staff" WHERE ("staff"."auth_user_id" = "auth"."uid"())))));
CREATE POLICY "teachers_manage_own_remarks" ON "public"."teacher_remarks" TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ("teacher_id" = "auth"."uid"()))) WITH CHECK ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ("teacher_id" = "auth"."uid"())));

-- ── TIMETABLE SLOTS ───────────────────────────────────────────────────────────

CREATE POLICY "all_staff_view_timetable" ON "public"."timetable_slots" FOR SELECT TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ("is_published" = true)));
CREATE POLICY "dos_manages_timetable" ON "public"."timetable_slots" TO "authenticated" USING ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['dos'::"text", 'principal'::"text"])))) WITH CHECK ((("school_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'school_id'::"text"))::"uuid") AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'user_role'::"text") = ANY (ARRAY['dos'::"text", 'principal'::"text"]))));
