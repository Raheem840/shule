-- Migration: 00003_functions_triggers
-- Source: supabase db dump --linked --schema public (2026-06-02)
-- Contents: all functions, triggers, and function grants

-- ── FUNCTIONS ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."auth_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'user_role';
$$;
ALTER FUNCTION "public"."auth_role"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "service_role";


CREATE OR REPLACE FUNCTION "public"."auth_school_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid;
$$;
ALTER FUNCTION "public"."auth_school_id"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."auth_school_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_school_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_school_id"() TO "service_role";


CREATE OR REPLACE FUNCTION "public"."auto_grade_exam_result"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_marks INT;
  v_assessment_type TEXT;
BEGIN
  SELECT assessment_type, total_marks
  INTO v_assessment_type, v_total_marks
  FROM exam_journal
  WHERE id = NEW.exam_journal_id;

  -- End of term scores are stored raw (out of 80)
  -- Grade calculated at report card generation combining CA + exam
  IF v_assessment_type = 'end_of_term' THEN
    NEW.grade := NULL;
  ELSE
    -- Grade CA scores as percentage of total_marks using UNEB CBC scale
    NEW.grade := CASE
      WHEN v_total_marks = 0 THEN NULL
      WHEN (NEW.score::NUMERIC / v_total_marks * 100) >= 80 THEN 'A'
      WHEN (NEW.score::NUMERIC / v_total_marks * 100) >= 70 THEN 'B'
      WHEN (NEW.score::NUMERIC / v_total_marks * 100) >= 60 THEN 'C'
      WHEN (NEW.score::NUMERIC / v_total_marks * 100) >= 50 THEN 'D'
      ELSE 'E'
    END;
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."auto_grade_exam_result"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."auto_grade_exam_result"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_grade_exam_result"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_grade_exam_result"() TO "service_role";


-- CBC formula: max_points = assessed × 3 | out_of_20 = (total_points/max_points)×20
-- total = out_of_20 + exam_out_of_80 | A=80+ B=70+ C=60+ D=50+ E=0+
CREATE OR REPLACE FUNCTION "public"."calculate_cbc_grade"("total_points" integer, "assessed" integer, "exam_out_of_80" numeric)
RETURNS TABLE("max_points" integer, "out_of_20" numeric, "total" numeric, "grade" "text", "grade_points" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_max_points INT;
  v_out_of_20 NUMERIC;
  v_total NUMERIC;
  v_grade TEXT;
  v_grade_points INT;
BEGIN
  IF assessed = 0 THEN
    RAISE EXCEPTION 'assessed cannot be zero';
  END IF;

  v_max_points := assessed * 3;
  v_out_of_20 := ROUND((total_points::NUMERIC / v_max_points) * 20, 2);
  v_total := ROUND(v_out_of_20 + exam_out_of_80, 2);

  v_grade := CASE
    WHEN v_total >= 80 THEN 'A'
    WHEN v_total >= 70 THEN 'B'
    WHEN v_total >= 60 THEN 'C'
    WHEN v_total >= 50 THEN 'D'
    ELSE 'E'
  END;

  v_grade_points := CASE v_grade
    WHEN 'A' THEN 5
    WHEN 'B' THEN 4
    WHEN 'C' THEN 3
    WHEN 'D' THEN 2
    ELSE 1
  END;

  RETURN QUERY SELECT v_max_points, v_out_of_20, v_total, v_grade, v_grade_points;
END;
$$;
ALTER FUNCTION "public"."calculate_cbc_grade"("total_points" integer, "assessed" integer, "exam_out_of_80" numeric) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."calculate_cbc_grade"("total_points" integer, "assessed" integer, "exam_out_of_80" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_cbc_grade"("total_points" integer, "assessed" integer, "exam_out_of_80" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_cbc_grade"("total_points" integer, "assessed" integer, "exam_out_of_80" numeric) TO "service_role";


-- JWT hook: injects school_id + user_role into every token
-- Wire in: Dashboard → Auth → Hooks → custom_access_token_hook
CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role       TEXT;
  v_school_id  UUID;
BEGIN
  SELECT s.role, s.school_id
  INTO v_role, v_school_id
  FROM public.staff s
  WHERE s.auth_user_id = (event->>'user_id')::uuid;

  IF v_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
    event := jsonb_set(event, '{claims,school_id}', to_jsonb(v_school_id::text));
  END IF;

  RETURN event;
END;
$$;
ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "public"."dos_assign_class_teacher"("p_stream_id" "uuid", "p_teacher_id" "uuid", "p_school_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'user_role';

  IF v_role NOT IN ('principal', 'secretary', 'it_admin', 'dos') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE staff
  SET role = 'class_teacher'
  WHERE id = p_teacher_id
    AND school_id = p_school_id;

  UPDATE streams
  SET class_teacher_id = p_teacher_id
  WHERE id = p_stream_id
    AND school_id = p_school_id;
END;
$$;
ALTER FUNCTION "public"."dos_assign_class_teacher"("p_stream_id" "uuid", "p_teacher_id" "uuid", "p_school_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."dos_assign_class_teacher"("p_stream_id" "uuid", "p_teacher_id" "uuid", "p_school_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dos_assign_class_teacher"("p_stream_id" "uuid", "p_teacher_id" "uuid", "p_school_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dos_assign_class_teacher"("p_stream_id" "uuid", "p_teacher_id" "uuid", "p_school_id" "uuid") TO "service_role";


CREATE OR REPLACE FUNCTION "public"."dos_assign_classes"("p_staff_id" "uuid", "p_classes" "uuid"[], "p_school_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'user_role';

  IF v_role NOT IN ('principal', 'secretary', 'it_admin', 'dos') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE staff
  SET classes = p_classes
  WHERE id = p_staff_id
    AND school_id = p_school_id;
END;
$$;
ALTER FUNCTION "public"."dos_assign_classes"("p_staff_id" "uuid", "p_classes" "uuid"[], "p_school_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."dos_assign_classes"("p_staff_id" "uuid", "p_classes" "uuid"[], "p_school_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dos_assign_classes"("p_staff_id" "uuid", "p_classes" "uuid"[], "p_school_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dos_assign_classes"("p_staff_id" "uuid", "p_classes" "uuid"[], "p_school_id" "uuid") TO "service_role";


CREATE OR REPLACE FUNCTION "public"."dos_assign_subjects"("p_staff_id" "uuid", "p_subjects" "text"[], "p_school_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'user_role';

  IF v_role NOT IN ('principal', 'secretary', 'it_admin', 'dos') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE staff
  SET subjects = p_subjects
  WHERE id = p_staff_id
    AND school_id = p_school_id;
END;
$$;
ALTER FUNCTION "public"."dos_assign_subjects"("p_staff_id" "uuid", "p_subjects" "text"[], "p_school_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."dos_assign_subjects"("p_staff_id" "uuid", "p_subjects" "text"[], "p_school_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dos_assign_subjects"("p_staff_id" "uuid", "p_subjects" "text"[], "p_school_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dos_assign_subjects"("p_staff_id" "uuid", "p_subjects" "text"[], "p_school_id" "uuid") TO "service_role";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json->>'user_role',
    ''
  )
$$;
ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";


CREATE OR REPLACE FUNCTION "public"."get_user_school_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT (
    current_setting('request.jwt.claims', true)::json->>'school_id'
  )::uuid
$$;
ALTER FUNCTION "public"."get_user_school_id"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."get_user_school_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_school_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_school_id"() TO "service_role";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_school_id   uuid;
  v_entity_name text;
  v_user_id     uuid;
  v_role        text;
BEGIN
  v_user_id := auth.uid();

  v_role := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_role',
    'system'
  );

  v_school_id := COALESCE(
    (NEW.school_id)::uuid,
    (OLD.school_id)::uuid
  );

  v_entity_name := COALESCE(
    NEW.first_name || ' ' || NEW.last_name,
    OLD.first_name || ' ' || OLD.last_name,
    'unknown'
  );

  INSERT INTO audit_log (
    school_id, user_id, role, action,
    table_name, record_id, entity_name, old_value, new_value
  ) VALUES (
    v_school_id,
    v_user_id,
    v_role,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_entity_name,
    CASE WHEN TG_OP IN ('DELETE','UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION "public"."log_audit_event"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "service_role";


CREATE OR REPLACE FUNCTION "public"."update_curriculum_plan_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_curriculum_plan_updated_at"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."update_curriculum_plan_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_curriculum_plan_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_curriculum_plan_updated_at"() TO "service_role";

CREATE OR REPLACE FUNCTION "public"."update_discipline_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_discipline_records_updated_at"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."update_discipline_records_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_discipline_records_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_discipline_records_updated_at"() TO "service_role";

CREATE OR REPLACE FUNCTION "public"."update_parent_accounts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_parent_accounts_updated_at"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."update_parent_accounts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_parent_accounts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_parent_accounts_updated_at"() TO "service_role";

CREATE OR REPLACE FUNCTION "public"."update_report_cards_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_report_cards_updated_at"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."update_report_cards_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_report_cards_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_report_cards_updated_at"() TO "service_role";

CREATE OR REPLACE FUNCTION "public"."update_teacher_remarks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_teacher_remarks_updated_at"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."update_teacher_remarks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_teacher_remarks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_teacher_remarks_updated_at"() TO "service_role";


CREATE OR REPLACE FUNCTION "public"."user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'user_role'
  )
$$;
ALTER FUNCTION "public"."user_role"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_role"() TO "service_role";


CREATE OR REPLACE FUNCTION "public"."user_school_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'school_id',
    auth.jwt() -> 'app_metadata' ->> 'school_id'
  )::uuid
$$;
ALTER FUNCTION "public"."user_school_id"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."user_school_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_school_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_school_id"() TO "service_role";

-- ── TRIGGERS ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER "audit_discipline_records"
  AFTER INSERT OR DELETE OR UPDATE ON "public"."discipline_records"
  FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();

CREATE OR REPLACE TRIGGER "audit_exam_results"
  AFTER INSERT OR DELETE OR UPDATE ON "public"."exam_results"
  FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();

CREATE OR REPLACE TRIGGER "audit_fee_payments"
  AFTER INSERT OR UPDATE ON "public"."fee_payments"
  FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();

CREATE OR REPLACE TRIGGER "audit_report_cards"
  AFTER INSERT OR UPDATE ON "public"."report_cards"
  FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();

CREATE OR REPLACE TRIGGER "audit_staff"
  AFTER INSERT OR DELETE OR UPDATE ON "public"."staff"
  FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();

CREATE OR REPLACE TRIGGER "audit_students"
  AFTER INSERT OR DELETE OR UPDATE ON "public"."students"
  FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();

CREATE OR REPLACE TRIGGER "curriculum_plan_updated_at"
  BEFORE UPDATE ON "public"."curriculum_plan"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_curriculum_plan_updated_at"();

CREATE OR REPLACE TRIGGER "discipline_records_updated_at"
  BEFORE UPDATE ON "public"."discipline_records"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_discipline_records_updated_at"();

CREATE OR REPLACE TRIGGER "parent_accounts_updated_at"
  BEFORE UPDATE ON "public"."parent_accounts"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_parent_accounts_updated_at"();

CREATE OR REPLACE TRIGGER "report_cards_updated_at"
  BEFORE UPDATE ON "public"."report_cards"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_report_cards_updated_at"();

CREATE OR REPLACE TRIGGER "teacher_remarks_updated_at"
  BEFORE UPDATE ON "public"."teacher_remarks"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_teacher_remarks_updated_at"();
