-- Migration: 00001_initial_schema
-- Source: supabase db dump --linked --schema public (2026-06-02)
-- Contents: CREATE TABLE, views, primary keys, unique constraints, indexes,
--           foreign keys, table grants, default privileges
-- (Functions/triggers → 00003 | RLS/policies → 00002)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "public";
ALTER SCHEMA "public" OWNER TO "pg_database_owner";
COMMENT ON SCHEMA "public" IS 'standard public schema';

SET default_tablespace = '';
SET default_table_access_method = "heap";

-- ── TABLES ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."academic_years" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "term1_start" "date",
    "term1_end" "date",
    "term2_start" "date",
    "term2_end" "date",
    "term3_start" "date",
    "term3_end" "date",
    "is_active" boolean DEFAULT false,
    "survey_active" boolean DEFAULT false,
    "name" "text" GENERATED ALWAYS AS ("label") STORED
);
ALTER TABLE "public"."academic_years" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'absent'::"text", 'late'::"text", 'excused'::"text"])))
);
ALTER TABLE "public"."attendance" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role" "text",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "old_data" "jsonb" GENERATED ALWAYS AS ("old_value") STORED,
    "new_data" "jsonb" GENERATED ALWAYS AS ("new_value") STORED,
    "entity_name" "text"
);
ALTER TABLE "public"."audit_log" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."classes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."curriculum_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "term" "text" NOT NULL,
    "year" integer NOT NULL,
    "topic" "text" NOT NULL,
    "expected_date" "date",
    "covered" boolean DEFAULT false,
    "covered_at" timestamp with time zone,
    "covered_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "curriculum_plan_term_check" CHECK (("term" = ANY (ARRAY['1'::"text", '2'::"text", '3'::"text"])))
);
ALTER TABLE "public"."curriculum_plan" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accent_color" "text",
    "head_teacher_id" "uuid",
    "archived" boolean DEFAULT false
);
ALTER TABLE "public"."departments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."discipline_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "incident_date" "date" NOT NULL,
    "nature" "text" NOT NULL,
    "resolution" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "class_id" "uuid",
    "notes" "text"
);
ALTER TABLE "public"."discipline_records" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."error_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "school_name" "text",
    "error_type" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "severity" "text" DEFAULT 'low'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_by" "text",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "error_log_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "error_log_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'investigating'::"text", 'resolved'::"text"])))
);
ALTER TABLE "public"."error_log" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."exam_journal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "stream_id" "uuid",
    "academic_year_id" "uuid" NOT NULL,
    "assessment_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "term" "text" NOT NULL,
    "total_marks" integer DEFAULT 100 NOT NULL,
    "pass_mark" integer DEFAULT 50 NOT NULL,
    "date_given" "date",
    "teacher_notes" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "year" integer DEFAULT (EXTRACT(year FROM "now"()))::integer NOT NULL,
    "ca_label" "text",
    "ca_component" "text",
    "ca_weighting" numeric,
    "learning_area" "text",
    "competency" "text",
    "integration_theme" "text",
    "trade_area" "text",
    "dit_module_code" "text",
    CONSTRAINT "exam_journal_assessment_type_check" CHECK (("assessment_type" = ANY (ARRAY['beginning_of_term'::"text", 'mid_term'::"text", 'end_of_term'::"text", 'continuous_assessment'::"text", 'aoi'::"text", 'dit'::"text", 'practical'::"text", 'class_test'::"text", 'assignment'::"text"]))),
    CONSTRAINT "exam_journal_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text"])))
);
ALTER TABLE "public"."exam_journal" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."exam_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "exam_journal_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "score" numeric(6,2),
    "grade" "text",
    "is_absent" boolean DEFAULT false NOT NULL,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subject_id" "uuid",
    "term" "text",
    "year" integer
);
ALTER TABLE "public"."exam_results" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."fee_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "fee_structure_id" "uuid",
    "academic_year_id" "uuid" NOT NULL,
    "term" integer NOT NULL,
    "amount_due" numeric(12,2) NOT NULL,
    "amount_paid" numeric(12,2) DEFAULT 0 NOT NULL,
    "balance" numeric(12,2) GENERATED ALWAYS AS (("amount_due" - "amount_paid")) STORED,
    "payment_date" "date",
    "receipt_number" "text",
    "notes" "text",
    "imported" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fee_payments_term_check" CHECK (("term" = ANY (ARRAY[1, 2, 3])))
);
ALTER TABLE "public"."fee_payments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."fee_structure" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "applies_to" "text" DEFAULT 'all'::"text" NOT NULL,
    "term" integer NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fee_structure_applies_to_check" CHECK (("applies_to" = ANY (ARRAY['all'::"text", 'day'::"text", 'boarder'::"text"]))),
    CONSTRAINT "fee_structure_term_check" CHECK (("term" = ANY (ARRAY[1, 2, 3])))
);
ALTER TABLE "public"."fee_structure" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid",
    "is_announcement" boolean DEFAULT false,
    "body" "text" NOT NULL,
    "attachment_url" "text",
    "attachment_name" "text",
    "attachment_type" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone
);
ALTER TABLE "public"."messages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "body" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "link" "text",
    "read_at" timestamp with time zone,
    "from_user" "uuid",
    "target_role" "text",
    "title" "text"
);
ALTER TABLE "public"."notifications" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."parent_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "auth_user_id" "uuid",
    "email" "text" NOT NULL,
    "student_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "temp_password" "text",
    "full_name" "text",
    "phone" "text"
);
ALTER TABLE "public"."parent_accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."report_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "term" "text" NOT NULL,
    "year" integer NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "principal_remarks" "text",
    "generated_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "released_at" timestamp with time zone,
    "released_by" "uuid",
    "pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "unlock_reason" "text",
    "unlock_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "report_cards_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text", 'approved'::"text", 'released'::"text"]))),
    CONSTRAINT "report_cards_term_check" CHECK (("term" = ANY (ARRAY['1'::"text", '2'::"text", '3'::"text"])))
);
ALTER TABLE "public"."report_cards" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."school_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "title" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_type" "text" DEFAULT 'general'::"text",
    "description" "text",
    "created_by" "uuid",
    "term" "text",
    "year" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subject_id" "uuid",
    "class_id" "uuid",
    "stream_id" "uuid",
    "total_marks" numeric,
    "pass_mark" numeric,
    "journaled" boolean DEFAULT false,
    "journal_id" "uuid"
);
ALTER TABLE "public"."school_events" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."school_profile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_name" "text" NOT NULL,
    "short_name" "text",
    "logo_url" "text",
    "motto" "text",
    "primary_color" "text" DEFAULT '#1a6b3c'::"text",
    "curriculum" "text" DEFAULT 'ncdc_uganda'::"text",
    "deployment_mode" "text" DEFAULT 'cloud'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "at_api_key" "text",
    "at_username" "text",
    "at_sender_id" "text",
    "wa_phone_number_id" "text",
    "wa_access_token" "text",
    "currency" "text" DEFAULT 'UGX'::"text" NOT NULL,
    "report_template_url" "text",
    "sms_api_key" "text",
    "sms_username" "text",
    "sms_sender_id" "text",
    "sms_environment" "text" DEFAULT 'sandbox'::"text",
    "wa_business_account_id" "text",
    "timezone" "text" DEFAULT 'Africa/Kampala'::"text",
    "language" "text" DEFAULT 'en'::"text",
    CONSTRAINT "school_profile_deployment_mode_check" CHECK (("deployment_mode" = ANY (ARRAY['cloud'::"text", 'local'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "school_profile_sms_environment_check" CHECK (("sms_environment" = ANY (ARRAY['sandbox'::"text", 'production'::"text"])))
);
ALTER TABLE "public"."school_profile" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."school_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "deployment_type" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "installation_notes" "text",
    "assigned_team_member" "text",
    "cloud_backup_enabled" boolean DEFAULT false,
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "school_registry_deployment_type_check" CHECK (("deployment_type" = ANY (ARRAY['local'::"text", 'cloud'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "school_registry_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'scheduled'::"text", 'active_local'::"text", 'active_cloud'::"text", 'active_hybrid'::"text", 'needs_attention'::"text", 'inactive'::"text", 'trial'::"text"])))
);
ALTER TABLE "public"."school_registry" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."send_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0,
    "last_attempted_at" timestamp with time zone,
    "queued_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    CONSTRAINT "send_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "send_queue_type_check" CHECK (("type" = ANY (ARRAY['sms'::"text", 'whatsapp'::"text"])))
);
ALTER TABLE "public"."send_queue" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."sms_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "parent_phone" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sms_reminders_channel_check" CHECK (("channel" = ANY (ARRAY['sms'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "sms_reminders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'failed'::"text"])))
);
ALTER TABLE "public"."sms_reminders" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "auth_user_id" "uuid",
    "staff_number" "text",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "department_id" "uuid",
    "subjects" "text"[],
    "classes" "uuid"[],
    "qualification_level" integer,
    "employment_type" "text",
    "salary_band" "text",
    "photo_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "join_date" "date",
    "email" "text",
    "phone" "text",
    "national_id" "text",
    "address" "text",
    "employment_date" "date",
    "qualification_title" "text",
    "institution" "text",
    "graduation_year" integer,
    "date_of_birth" "date",
    "gender" "text",
    "last_login_at" timestamp with time zone,
    CONSTRAINT "staff_employment_type_check" CHECK (("employment_type" = ANY (ARRAY['permanent'::"text", 'contract'::"text", 'volunteer'::"text"]))),
    CONSTRAINT "staff_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "staff_role_check" CHECK (("role" = ANY (ARRAY['principal'::"text", 'deputy'::"text", 'dos'::"text", 'secretary'::"text", 'bursar'::"text", 'class_teacher'::"text", 'teacher'::"text", 'it_admin'::"text"])))
);
ALTER TABLE "public"."staff" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."staff_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['national_id'::"text", 'transcript'::"text", 'certificate'::"text", 'teaching_certificate'::"text", 'nin'::"text", 'other'::"text"])))
);
ALTER TABLE "public"."staff_documents" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."streams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "class_teacher_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."streams" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."student_guardians" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "relationship" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "do_not_contact" boolean DEFAULT false NOT NULL,
    "comms_preference" "text" DEFAULT 'sms'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_guardians_comms_preference_check" CHECK (("comms_preference" = ANY (ARRAY['sms'::"text", 'whatsapp'::"text", 'both'::"text"])))
);
ALTER TABLE "public"."student_guardians" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."student_surveys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "student_id" "uuid",
    "academic_year_id" "uuid",
    "term" "text" NOT NULL,
    "year" integer NOT NULL,
    "rating" integer,
    "hardest_subject_id" "uuid",
    "favourite_subject_id" "uuid",
    "teacher_rating" integer,
    "suggestions" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_surveys_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "student_surveys_teacher_rating_check" CHECK ((("teacher_rating" >= 1) AND ("teacher_rating" <= 5)))
);
ALTER TABLE "public"."student_surveys" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "class_id" "uuid",
    "stream_id" "uuid",
    "admission_number" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "dob" "date",
    "gender" "text",
    "nationality" "text" DEFAULT 'Ugandan'::"text",
    "religion" "text",
    "photo_url" "text",
    "medical_notes" "text",
    "student_type" "text" DEFAULT 'day'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "enrolled_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "previous_school" "text",
    "academic_year_id" "uuid",
    CONSTRAINT "students_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "students_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'expelled'::"text"]))),
    CONSTRAINT "students_student_type_check" CHECK (("student_type" = ANY (ARRAY['day'::"text", 'boarder'::"text"])))
);
ALTER TABLE "public"."students" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "department_id" "uuid",
    "name" "text" NOT NULL,
    "curriculum_code" "text",
    "level" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."subjects" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."survey_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "student_id" "uuid",
    "academic_year_id" "uuid",
    "term" integer NOT NULL,
    "rating" integer NOT NULL,
    "enjoyed" "text",
    "improve" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "survey_responses_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "survey_responses_term_check" CHECK (("term" = ANY (ARRAY[1, 2, 3])))
);
ALTER TABLE "public"."survey_responses" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."sync_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "synced_at" timestamp with time zone,
    CONSTRAINT "sync_queue_action_type_check" CHECK (("action_type" = ANY (ARRAY['insert'::"text", 'update'::"text", 'delete'::"text"]))),
    CONSTRAINT "sync_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'syncing'::"text", 'synced'::"text", 'failed'::"text"])))
);
ALTER TABLE "public"."sync_queue" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."teacher_remarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "term" "text" NOT NULL,
    "year" integer NOT NULL,
    "remarks" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "teacher_remarks_term_check" CHECK (("term" = ANY (ARRAY['1'::"text", '2'::"text", '3'::"text"])))
);
ALTER TABLE "public"."teacher_remarks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."timetable_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "class_id" "uuid",
    "stream_id" "uuid",
    "subject_id" "uuid",
    "teacher_id" "uuid",
    "day_of_week" integer NOT NULL,
    "period_number" integer NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "term" "text",
    "year" integer,
    "is_published" boolean DEFAULT false,
    CONSTRAINT "timetable_slots_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5))),
    CONSTRAINT "timetable_slots_period_number_check" CHECK ((("period_number" >= 1) AND ("period_number" <= 8)))
);
ALTER TABLE "public"."timetable_slots" OWNER TO "postgres";

-- ── VIEWS ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW "public"."fee_status_for_secretary" AS
 SELECT "student_id", "term", "academic_year_id",
        CASE
            WHEN ("sum"("balance") <= (0)::numeric) THEN 'paid'::"text"
            WHEN ("sum"("amount_paid") = (0)::numeric) THEN 'unpaid'::"text"
            ELSE 'partial'::"text"
        END AS "status"
   FROM "public"."fee_payments" "fp"
  GROUP BY "student_id", "term", "academic_year_id";
ALTER VIEW "public"."fee_status_for_secretary" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."fee_status_view" AS
 SELECT "student_id", "school_id", "term", "academic_year_id",
        CASE
            WHEN ("balance" = (0)::numeric) THEN 'paid'::"text"
            WHEN ("amount_paid" = (0)::numeric) THEN 'unpaid'::"text"
            ELSE 'partial'::"text"
        END AS "status"
   FROM "public"."fee_payments" "fp";
ALTER VIEW "public"."fee_status_view" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."fee_summary_for_principal" AS
 SELECT "school_id", "term", "academic_year_id",
    "count"(DISTINCT "student_id") AS "total_students",
    "sum"("amount_due") AS "total_expected",
    "sum"("amount_paid") AS "total_collected",
    "sum"("balance") AS "total_outstanding",
    "count"(DISTINCT CASE WHEN ("amount_paid" = (0)::numeric) THEN "student_id" ELSE NULL::"uuid" END) AS "fully_unpaid_count",
    "count"(DISTINCT CASE WHEN ("balance" <= (0)::numeric) THEN "student_id" ELSE NULL::"uuid" END) AS "fully_paid_count"
   FROM "public"."fee_payments" "fp"
  GROUP BY "school_id", "term", "academic_year_id";
ALTER VIEW "public"."fee_summary_for_principal" OWNER TO "postgres";

-- ── PRIMARY KEYS ──────────────────────────────────────────────────────────────

ALTER TABLE ONLY "public"."academic_years"    ADD CONSTRAINT "academic_years_pkey"    PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."attendance"        ADD CONSTRAINT "attendance_pkey"        PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."audit_log"         ADD CONSTRAINT "audit_log_pkey"         PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."classes"           ADD CONSTRAINT "classes_pkey"           PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."curriculum_plan"   ADD CONSTRAINT "curriculum_plan_pkey"   PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."departments"       ADD CONSTRAINT "departments_pkey"       PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."discipline_records" ADD CONSTRAINT "discipline_records_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."error_log"         ADD CONSTRAINT "error_log_pkey"         PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."exam_journal"      ADD CONSTRAINT "exam_journal_pkey"      PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."exam_results"      ADD CONSTRAINT "exam_results_pkey"      PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."fee_payments"      ADD CONSTRAINT "fee_payments_pkey"      PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."fee_structure"     ADD CONSTRAINT "fee_structure_pkey"     PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."messages"          ADD CONSTRAINT "messages_pkey"          PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."notifications"     ADD CONSTRAINT "notifications_pkey"     PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."parent_accounts"   ADD CONSTRAINT "parent_accounts_pkey"   PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."report_cards"      ADD CONSTRAINT "report_cards_pkey"      PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."school_events"     ADD CONSTRAINT "school_events_pkey"     PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."school_profile"    ADD CONSTRAINT "school_profile_pkey"    PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."school_registry"   ADD CONSTRAINT "school_registry_pkey"   PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."send_queue"        ADD CONSTRAINT "send_queue_pkey"        PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."sms_reminders"     ADD CONSTRAINT "sms_reminders_pkey"     PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."staff"             ADD CONSTRAINT "staff_pkey"             PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."staff_documents"   ADD CONSTRAINT "staff_documents_pkey"   PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."streams"           ADD CONSTRAINT "streams_pkey"           PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."student_guardians" ADD CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."student_surveys"   ADD CONSTRAINT "student_surveys_pkey"   PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_pkey"          PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."subjects"          ADD CONSTRAINT "subjects_pkey"          PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."survey_responses"  ADD CONSTRAINT "survey_responses_pkey"  PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."sync_queue"        ADD CONSTRAINT "sync_queue_pkey"        PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."teacher_remarks"   ADD CONSTRAINT "teacher_remarks_pkey"   PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."timetable_slots"   ADD CONSTRAINT "timetable_slots_pkey"   PRIMARY KEY ("id");

-- ── UNIQUE CONSTRAINTS ────────────────────────────────────────────────────────

ALTER TABLE ONLY "public"."curriculum_plan"   ADD CONSTRAINT "curriculum_plan_unique_topic" UNIQUE ("school_id", "subject_id", "class_id", "term", "year", "topic");
ALTER TABLE ONLY "public"."parent_accounts"   ADD CONSTRAINT "parent_accounts_auth_user_id_key" UNIQUE ("auth_user_id");
ALTER TABLE ONLY "public"."report_cards"      ADD CONSTRAINT "report_cards_school_id_student_id_term_year_key" UNIQUE ("school_id", "student_id", "term", "year");
ALTER TABLE ONLY "public"."staff"             ADD CONSTRAINT "staff_auth_user_id_key" UNIQUE ("auth_user_id");
ALTER TABLE ONLY "public"."student_surveys"   ADD CONSTRAINT "student_surveys_school_id_student_id_term_year_key" UNIQUE ("school_id", "student_id", "term", "year");
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_auth_user_id_key" UNIQUE ("auth_user_id");
ALTER TABLE ONLY "public"."survey_responses"  ADD CONSTRAINT "survey_responses_student_id_academic_year_id_term_key" UNIQUE ("student_id", "academic_year_id", "term");
ALTER TABLE ONLY "public"."teacher_remarks"   ADD CONSTRAINT "teacher_remarks_school_id_student_id_teacher_id_term_year_key" UNIQUE ("school_id", "student_id", "teacher_id", "term", "year");
ALTER TABLE ONLY "public"."timetable_slots"   ADD CONSTRAINT "timetable_slots_school_id_class_id_stream_id_day_of_week_pe_key" UNIQUE ("school_id", "class_id", "stream_id", "day_of_week", "period_number", "term", "year");

-- ── INDEXES ──────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "academic_years_school_label_idx"    ON "public"."academic_years"  USING "btree" ("school_id", "label");
CREATE UNIQUE INDEX "attendance_student_date_idx"         ON "public"."attendance"      USING "btree" ("student_id", "date");
CREATE UNIQUE INDEX "classes_school_year_name_idx"        ON "public"."classes"         USING "btree" ("school_id", "academic_year_id", "name");
CREATE UNIQUE INDEX "departments_school_name_idx"         ON "public"."departments"     USING "btree" ("school_id", "name");
CREATE UNIQUE INDEX "exam_results_journal_student_idx"    ON "public"."exam_results"    USING "btree" ("exam_journal_id", "student_id");
CREATE UNIQUE INDEX "fee_payments_student_fee_term_idx"   ON "public"."fee_payments"    USING "btree" ("student_id", "fee_structure_id", "term", "academic_year_id");
CREATE UNIQUE INDEX "fee_structure_school_term_name_idx"  ON "public"."fee_structure"   USING "btree" ("school_id", "academic_year_id", "term", "name");
CREATE UNIQUE INDEX "streams_class_name_idx"              ON "public"."streams"         USING "btree" ("class_id", "name");
CREATE UNIQUE INDEX "students_school_admission_idx"       ON "public"."students"        USING "btree" ("school_id", "admission_number");
CREATE UNIQUE INDEX "subjects_school_name_idx"            ON "public"."subjects"        USING "btree" ("school_id", "name");

-- ── FOREIGN KEYS ──────────────────────────────────────────────────────────────

ALTER TABLE ONLY "public"."academic_years"    ADD CONSTRAINT "academic_years_school_id_fkey"           FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."attendance"        ADD CONSTRAINT "attendance_class_id_fkey"                FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id")        ON DELETE CASCADE;
ALTER TABLE ONLY "public"."attendance"        ADD CONSTRAINT "attendance_recorded_by_fkey"             FOREIGN KEY ("recorded_by")      REFERENCES "public"."staff"("id")          ON DELETE CASCADE;
ALTER TABLE ONLY "public"."attendance"        ADD CONSTRAINT "attendance_school_id_fkey"               FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."attendance"        ADD CONSTRAINT "attendance_student_id_fkey"              FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."audit_log"         ADD CONSTRAINT "audit_log_school_id_fkey"                FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."audit_log"         ADD CONSTRAINT "audit_log_user_id_fkey"                  FOREIGN KEY ("user_id")          REFERENCES "auth"."users"("id")            ON DELETE CASCADE;
ALTER TABLE ONLY "public"."classes"           ADD CONSTRAINT "classes_academic_year_id_fkey"           FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."classes"           ADD CONSTRAINT "classes_school_id_fkey"                  FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."curriculum_plan"   ADD CONSTRAINT "curriculum_plan_class_id_fkey"           FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id")        ON DELETE CASCADE;
ALTER TABLE ONLY "public"."curriculum_plan"   ADD CONSTRAINT "curriculum_plan_covered_by_fkey"         FOREIGN KEY ("covered_by")       REFERENCES "public"."staff"("id")          ON DELETE SET NULL;
ALTER TABLE ONLY "public"."curriculum_plan"   ADD CONSTRAINT "curriculum_plan_school_id_fkey"          FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."curriculum_plan"   ADD CONSTRAINT "curriculum_plan_subject_id_fkey"         FOREIGN KEY ("subject_id")       REFERENCES "public"."subjects"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."departments"       ADD CONSTRAINT "departments_head_teacher_id_fkey"        FOREIGN KEY ("head_teacher_id")  REFERENCES "public"."staff"("id")          ON DELETE SET NULL;
ALTER TABLE ONLY "public"."departments"       ADD CONSTRAINT "departments_school_id_fkey"              FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."discipline_records" ADD CONSTRAINT "discipline_records_class_id_fkey"       FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id");
ALTER TABLE ONLY "public"."discipline_records" ADD CONSTRAINT "discipline_records_recorded_by_fkey"    FOREIGN KEY ("recorded_by")      REFERENCES "public"."staff"("id")          ON DELETE CASCADE;
ALTER TABLE ONLY "public"."discipline_records" ADD CONSTRAINT "discipline_records_school_id_fkey"      FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."discipline_records" ADD CONSTRAINT "discipline_records_student_id_fkey"     FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."error_log"         ADD CONSTRAINT "error_log_school_id_fkey"                FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."exam_journal"      ADD CONSTRAINT "exam_journal_academic_year_id_fkey"      FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_journal"      ADD CONSTRAINT "exam_journal_class_id_fkey"              FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id")        ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_journal"      ADD CONSTRAINT "exam_journal_school_id_fkey"             FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_journal"      ADD CONSTRAINT "exam_journal_stream_id_fkey"             FOREIGN KEY ("stream_id")        REFERENCES "public"."streams"("id")        ON DELETE SET NULL;
ALTER TABLE ONLY "public"."exam_journal"      ADD CONSTRAINT "exam_journal_subject_id_fkey"            FOREIGN KEY ("subject_id")       REFERENCES "public"."subjects"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_journal"      ADD CONSTRAINT "exam_journal_teacher_id_fkey"            FOREIGN KEY ("teacher_id")       REFERENCES "public"."staff"("id")          ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_results"      ADD CONSTRAINT "exam_results_exam_journal_id_fkey"       FOREIGN KEY ("exam_journal_id")  REFERENCES "public"."exam_journal"("id")   ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_results"      ADD CONSTRAINT "exam_results_school_id_fkey"             FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_results"      ADD CONSTRAINT "exam_results_student_id_fkey"            FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."exam_results"      ADD CONSTRAINT "exam_results_subject_id_fkey"            FOREIGN KEY ("subject_id")       REFERENCES "public"."subjects"("id")       ON DELETE SET NULL;
ALTER TABLE ONLY "public"."exam_results"      ADD CONSTRAINT "exam_results_teacher_id_fkey"            FOREIGN KEY ("teacher_id")       REFERENCES "public"."staff"("id")          ON DELETE CASCADE;
ALTER TABLE ONLY "public"."fee_payments"      ADD CONSTRAINT "fee_payments_academic_year_id_fkey"      FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."fee_payments"      ADD CONSTRAINT "fee_payments_created_by_fkey"            FOREIGN KEY ("created_by")       REFERENCES "public"."staff"("id")          ON DELETE SET NULL;
ALTER TABLE ONLY "public"."fee_payments"      ADD CONSTRAINT "fee_payments_fee_structure_id_fkey"      FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structure"("id")  ON DELETE CASCADE;
ALTER TABLE ONLY "public"."fee_payments"      ADD CONSTRAINT "fee_payments_school_id_fkey"             FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."fee_payments"      ADD CONSTRAINT "fee_payments_student_id_fkey"            FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."fee_structure"     ADD CONSTRAINT "fee_structure_academic_year_id_fkey"     FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."fee_structure"     ADD CONSTRAINT "fee_structure_school_id_fkey"            FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."messages"          ADD CONSTRAINT "messages_from_user_id_fkey"              FOREIGN KEY ("from_user_id")     REFERENCES "auth"."users"("id")            ON DELETE CASCADE;
ALTER TABLE ONLY "public"."messages"          ADD CONSTRAINT "messages_school_id_fkey"                 FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."messages"          ADD CONSTRAINT "messages_to_user_id_fkey"                FOREIGN KEY ("to_user_id")       REFERENCES "auth"."users"("id")            ON DELETE SET NULL;
ALTER TABLE ONLY "public"."notifications"     ADD CONSTRAINT "notifications_from_user_fkey"            FOREIGN KEY ("from_user")        REFERENCES "auth"."users"("id");
ALTER TABLE ONLY "public"."notifications"     ADD CONSTRAINT "notifications_school_id_fkey"            FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."notifications"     ADD CONSTRAINT "notifications_user_id_fkey"              FOREIGN KEY ("user_id")          REFERENCES "auth"."users"("id")            ON DELETE CASCADE;
ALTER TABLE ONLY "public"."parent_accounts"   ADD CONSTRAINT "parent_accounts_auth_user_id_fkey"       FOREIGN KEY ("auth_user_id")     REFERENCES "auth"."users"("id")            ON DELETE SET NULL;
ALTER TABLE ONLY "public"."parent_accounts"   ADD CONSTRAINT "parent_accounts_created_by_fkey"         FOREIGN KEY ("created_by")       REFERENCES "public"."staff"("id")          ON DELETE SET NULL;
ALTER TABLE ONLY "public"."parent_accounts"   ADD CONSTRAINT "parent_accounts_school_id_fkey"          FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."report_cards"      ADD CONSTRAINT "report_cards_approved_by_fkey"           FOREIGN KEY ("approved_by")      REFERENCES "public"."staff"("id");
ALTER TABLE ONLY "public"."report_cards"      ADD CONSTRAINT "report_cards_released_by_fkey"           FOREIGN KEY ("released_by")      REFERENCES "public"."staff"("id");
ALTER TABLE ONLY "public"."report_cards"      ADD CONSTRAINT "report_cards_school_id_fkey"             FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."report_cards"      ADD CONSTRAINT "report_cards_student_id_fkey"            FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."school_events"     ADD CONSTRAINT "school_events_class_id_fkey"             FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id");
ALTER TABLE ONLY "public"."school_events"     ADD CONSTRAINT "school_events_created_by_fkey"           FOREIGN KEY ("created_by")       REFERENCES "public"."staff"("id");
ALTER TABLE ONLY "public"."school_events"     ADD CONSTRAINT "school_events_journal_id_fkey"           FOREIGN KEY ("journal_id")       REFERENCES "public"."exam_journal"("id");
ALTER TABLE ONLY "public"."school_events"     ADD CONSTRAINT "school_events_school_id_fkey"            FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id");
ALTER TABLE ONLY "public"."school_events"     ADD CONSTRAINT "school_events_stream_id_fkey"            FOREIGN KEY ("stream_id")        REFERENCES "public"."streams"("id");
ALTER TABLE ONLY "public"."school_events"     ADD CONSTRAINT "school_events_subject_id_fkey"           FOREIGN KEY ("subject_id")       REFERENCES "public"."subjects"("id");
ALTER TABLE ONLY "public"."school_registry"   ADD CONSTRAINT "school_registry_school_id_fkey"          FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id");
ALTER TABLE ONLY "public"."send_queue"        ADD CONSTRAINT "send_queue_school_id_fkey"               FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."sms_reminders"     ADD CONSTRAINT "sms_reminders_school_id_fkey"            FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."sms_reminders"     ADD CONSTRAINT "sms_reminders_student_id_fkey"           FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."staff"             ADD CONSTRAINT "staff_auth_user_id_fkey"                 FOREIGN KEY ("auth_user_id")     REFERENCES "auth"."users"("id")            ON DELETE SET NULL;
ALTER TABLE ONLY "public"."staff_documents"   ADD CONSTRAINT "staff_documents_school_id_fkey"          FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."staff_documents"   ADD CONSTRAINT "staff_documents_staff_id_fkey"           FOREIGN KEY ("staff_id")         REFERENCES "public"."staff"("id")          ON DELETE CASCADE;
ALTER TABLE ONLY "public"."staff_documents"   ADD CONSTRAINT "staff_documents_uploaded_by_fkey"        FOREIGN KEY ("uploaded_by")      REFERENCES "public"."staff"("id")          ON DELETE SET NULL;
ALTER TABLE ONLY "public"."staff"             ADD CONSTRAINT "staff_school_id_fkey"                    FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."streams"           ADD CONSTRAINT "streams_class_id_fkey"                   FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id")        ON DELETE CASCADE;
ALTER TABLE ONLY "public"."streams"           ADD CONSTRAINT "streams_class_teacher_id_fkey"           FOREIGN KEY ("class_teacher_id") REFERENCES "public"."staff"("id")          ON DELETE SET NULL;
ALTER TABLE ONLY "public"."streams"           ADD CONSTRAINT "streams_school_id_fkey"                  FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."student_guardians" ADD CONSTRAINT "student_guardians_school_id_fkey"        FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."student_guardians" ADD CONSTRAINT "student_guardians_student_id_fkey"       FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."student_surveys"   ADD CONSTRAINT "student_surveys_academic_year_id_fkey"   FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");
ALTER TABLE ONLY "public"."student_surveys"   ADD CONSTRAINT "student_surveys_favourite_subject_id_fkey" FOREIGN KEY ("favourite_subject_id") REFERENCES "public"."subjects"("id");
ALTER TABLE ONLY "public"."student_surveys"   ADD CONSTRAINT "student_surveys_hardest_subject_id_fkey" FOREIGN KEY ("hardest_subject_id") REFERENCES "public"."subjects"("id");
ALTER TABLE ONLY "public"."student_surveys"   ADD CONSTRAINT "student_surveys_school_id_fkey"          FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id");
ALTER TABLE ONLY "public"."student_surveys"   ADD CONSTRAINT "student_surveys_student_id_fkey"         FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id");
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_academic_year_id_fkey"          FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_auth_user_id_fkey"              FOREIGN KEY ("auth_user_id")     REFERENCES "auth"."users"("id")            ON DELETE SET NULL;
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_class_id_fkey"                  FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id")        ON DELETE SET NULL;
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_created_by_fkey"                FOREIGN KEY ("created_by")       REFERENCES "public"."staff"("id")          ON DELETE SET NULL;
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_school_id_fkey"                 FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."students"          ADD CONSTRAINT "students_stream_id_fkey"                 FOREIGN KEY ("stream_id")        REFERENCES "public"."streams"("id")        ON DELETE SET NULL;
ALTER TABLE ONLY "public"."subjects"          ADD CONSTRAINT "subjects_department_id_fkey"             FOREIGN KEY ("department_id")    REFERENCES "public"."departments"("id")    ON DELETE SET NULL;
ALTER TABLE ONLY "public"."subjects"          ADD CONSTRAINT "subjects_school_id_fkey"                 FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."survey_responses"  ADD CONSTRAINT "survey_responses_academic_year_id_fkey"  FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");
ALTER TABLE ONLY "public"."survey_responses"  ADD CONSTRAINT "survey_responses_school_id_fkey"         FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."survey_responses"  ADD CONSTRAINT "survey_responses_student_id_fkey"        FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."sync_queue"        ADD CONSTRAINT "sync_queue_school_id_fkey"               FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."teacher_remarks"   ADD CONSTRAINT "teacher_remarks_school_id_fkey"          FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."teacher_remarks"   ADD CONSTRAINT "teacher_remarks_student_id_fkey"         FOREIGN KEY ("student_id")       REFERENCES "public"."students"("id")       ON DELETE CASCADE;
ALTER TABLE ONLY "public"."teacher_remarks"   ADD CONSTRAINT "teacher_remarks_teacher_id_fkey"         FOREIGN KEY ("teacher_id")       REFERENCES "public"."staff"("id")          ON DELETE CASCADE;
ALTER TABLE ONLY "public"."timetable_slots"   ADD CONSTRAINT "timetable_slots_class_id_fkey"           FOREIGN KEY ("class_id")         REFERENCES "public"."classes"("id");
ALTER TABLE ONLY "public"."timetable_slots"   ADD CONSTRAINT "timetable_slots_school_id_fkey"          FOREIGN KEY ("school_id")        REFERENCES "public"."school_profile"("id");
ALTER TABLE ONLY "public"."timetable_slots"   ADD CONSTRAINT "timetable_slots_stream_id_fkey"          FOREIGN KEY ("stream_id")        REFERENCES "public"."streams"("id");
ALTER TABLE ONLY "public"."timetable_slots"   ADD CONSTRAINT "timetable_slots_subject_id_fkey"         FOREIGN KEY ("subject_id")       REFERENCES "public"."subjects"("id");
ALTER TABLE ONLY "public"."timetable_slots"   ADD CONSTRAINT "timetable_slots_teacher_id_fkey"         FOREIGN KEY ("teacher_id")       REFERENCES "public"."staff"("id");

-- ── GRANTS ───────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";

GRANT ALL ON TABLE "public"."academic_years"    TO "anon"; GRANT ALL ON TABLE "public"."academic_years"    TO "authenticated"; GRANT ALL ON TABLE "public"."academic_years"    TO "service_role";
GRANT ALL ON TABLE "public"."attendance"        TO "anon"; GRANT ALL ON TABLE "public"."attendance"        TO "authenticated"; GRANT ALL ON TABLE "public"."attendance"        TO "service_role";
GRANT ALL ON TABLE "public"."audit_log"         TO "anon"; GRANT ALL ON TABLE "public"."audit_log"         TO "authenticated"; GRANT ALL ON TABLE "public"."audit_log"         TO "service_role";
GRANT ALL ON TABLE "public"."classes"           TO "anon"; GRANT ALL ON TABLE "public"."classes"           TO "authenticated"; GRANT ALL ON TABLE "public"."classes"           TO "service_role";
GRANT ALL ON TABLE "public"."curriculum_plan"   TO "anon"; GRANT ALL ON TABLE "public"."curriculum_plan"   TO "authenticated"; GRANT ALL ON TABLE "public"."curriculum_plan"   TO "service_role";
GRANT ALL ON TABLE "public"."departments"       TO "anon"; GRANT ALL ON TABLE "public"."departments"       TO "authenticated"; GRANT ALL ON TABLE "public"."departments"       TO "service_role";
GRANT ALL ON TABLE "public"."discipline_records" TO "anon"; GRANT ALL ON TABLE "public"."discipline_records" TO "authenticated"; GRANT ALL ON TABLE "public"."discipline_records" TO "service_role";
GRANT ALL ON TABLE "public"."error_log"         TO "anon"; GRANT ALL ON TABLE "public"."error_log"         TO "authenticated"; GRANT ALL ON TABLE "public"."error_log"         TO "service_role";
GRANT ALL ON TABLE "public"."exam_journal"      TO "anon"; GRANT ALL ON TABLE "public"."exam_journal"      TO "authenticated"; GRANT ALL ON TABLE "public"."exam_journal"      TO "service_role";
GRANT ALL ON TABLE "public"."exam_results"      TO "anon"; GRANT ALL ON TABLE "public"."exam_results"      TO "authenticated"; GRANT ALL ON TABLE "public"."exam_results"      TO "service_role";
GRANT ALL ON TABLE "public"."fee_payments"      TO "anon"; GRANT ALL ON TABLE "public"."fee_payments"      TO "authenticated"; GRANT ALL ON TABLE "public"."fee_payments"      TO "service_role";
GRANT ALL ON TABLE "public"."fee_status_for_secretary" TO "anon"; GRANT ALL ON TABLE "public"."fee_status_for_secretary" TO "authenticated"; GRANT ALL ON TABLE "public"."fee_status_for_secretary" TO "service_role";
GRANT ALL ON TABLE "public"."fee_status_view"   TO "anon"; GRANT ALL ON TABLE "public"."fee_status_view"   TO "authenticated"; GRANT ALL ON TABLE "public"."fee_status_view"   TO "service_role";
GRANT ALL ON TABLE "public"."fee_structure"     TO "anon"; GRANT ALL ON TABLE "public"."fee_structure"     TO "authenticated"; GRANT ALL ON TABLE "public"."fee_structure"     TO "service_role";
GRANT ALL ON TABLE "public"."fee_summary_for_principal" TO "anon"; GRANT ALL ON TABLE "public"."fee_summary_for_principal" TO "authenticated"; GRANT ALL ON TABLE "public"."fee_summary_for_principal" TO "service_role";
GRANT ALL ON TABLE "public"."messages"          TO "anon"; GRANT ALL ON TABLE "public"."messages"          TO "authenticated"; GRANT ALL ON TABLE "public"."messages"          TO "service_role";
GRANT ALL ON TABLE "public"."notifications"     TO "anon"; GRANT ALL ON TABLE "public"."notifications"     TO "authenticated"; GRANT ALL ON TABLE "public"."notifications"     TO "service_role";
GRANT ALL ON TABLE "public"."parent_accounts"   TO "anon"; GRANT ALL ON TABLE "public"."parent_accounts"   TO "authenticated"; GRANT ALL ON TABLE "public"."parent_accounts"   TO "service_role";
GRANT ALL ON TABLE "public"."report_cards"      TO "anon"; GRANT ALL ON TABLE "public"."report_cards"      TO "authenticated"; GRANT ALL ON TABLE "public"."report_cards"      TO "service_role";
GRANT ALL ON TABLE "public"."school_events"     TO "anon"; GRANT ALL ON TABLE "public"."school_events"     TO "authenticated"; GRANT ALL ON TABLE "public"."school_events"     TO "service_role";
GRANT ALL ON TABLE "public"."school_profile"    TO "anon"; GRANT ALL ON TABLE "public"."school_profile"    TO "authenticated"; GRANT ALL ON TABLE "public"."school_profile"    TO "service_role"; GRANT SELECT ON TABLE "public"."school_profile" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."school_registry"   TO "anon"; GRANT ALL ON TABLE "public"."school_registry"   TO "authenticated"; GRANT ALL ON TABLE "public"."school_registry"   TO "service_role";
GRANT ALL ON TABLE "public"."send_queue"        TO "anon"; GRANT ALL ON TABLE "public"."send_queue"        TO "authenticated"; GRANT ALL ON TABLE "public"."send_queue"        TO "service_role";
GRANT ALL ON TABLE "public"."sms_reminders"     TO "anon"; GRANT ALL ON TABLE "public"."sms_reminders"     TO "authenticated"; GRANT ALL ON TABLE "public"."sms_reminders"     TO "service_role";
GRANT ALL ON TABLE "public"."staff"             TO "anon"; GRANT ALL ON TABLE "public"."staff"             TO "authenticated"; GRANT ALL ON TABLE "public"."staff"             TO "service_role"; GRANT SELECT ON TABLE "public"."staff" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."staff_documents"   TO "anon"; GRANT ALL ON TABLE "public"."staff_documents"   TO "authenticated"; GRANT ALL ON TABLE "public"."staff_documents"   TO "service_role";
GRANT ALL ON TABLE "public"."streams"           TO "anon"; GRANT ALL ON TABLE "public"."streams"           TO "authenticated"; GRANT ALL ON TABLE "public"."streams"           TO "service_role";
GRANT ALL ON TABLE "public"."student_guardians" TO "anon"; GRANT ALL ON TABLE "public"."student_guardians" TO "authenticated"; GRANT ALL ON TABLE "public"."student_guardians" TO "service_role";
GRANT ALL ON TABLE "public"."student_surveys"   TO "anon"; GRANT ALL ON TABLE "public"."student_surveys"   TO "authenticated"; GRANT ALL ON TABLE "public"."student_surveys"   TO "service_role";
GRANT ALL ON TABLE "public"."students"          TO "anon"; GRANT ALL ON TABLE "public"."students"          TO "authenticated"; GRANT ALL ON TABLE "public"."students"          TO "service_role";
GRANT ALL ON TABLE "public"."subjects"          TO "anon"; GRANT ALL ON TABLE "public"."subjects"          TO "authenticated"; GRANT ALL ON TABLE "public"."subjects"          TO "service_role";
GRANT ALL ON TABLE "public"."survey_responses"  TO "anon"; GRANT ALL ON TABLE "public"."survey_responses"  TO "authenticated"; GRANT ALL ON TABLE "public"."survey_responses"  TO "service_role";
GRANT ALL ON TABLE "public"."sync_queue"        TO "anon"; GRANT ALL ON TABLE "public"."sync_queue"        TO "authenticated"; GRANT ALL ON TABLE "public"."sync_queue"        TO "service_role";
GRANT ALL ON TABLE "public"."teacher_remarks"   TO "anon"; GRANT ALL ON TABLE "public"."teacher_remarks"   TO "authenticated"; GRANT ALL ON TABLE "public"."teacher_remarks"   TO "service_role";
GRANT ALL ON TABLE "public"."timetable_slots"   TO "anon"; GRANT ALL ON TABLE "public"."timetable_slots"   TO "authenticated"; GRANT ALL ON TABLE "public"."timetable_slots"   TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES     TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES     TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES     TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES     TO "service_role";
