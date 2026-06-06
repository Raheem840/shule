-- Fix log_audit_event: use to_jsonb(NEW/OLD) to read first_name/last_name so the
-- trigger doesn't crash on tables that don't have those columns (fee_payments, etc.)
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
    (to_jsonb(NEW) ->> 'school_id')::uuid,
    (to_jsonb(OLD) ->> 'school_id')::uuid
  );

  v_entity_name := COALESCE(
    NULLIF(trim(CONCAT(to_jsonb(NEW) ->> 'first_name', ' ', to_jsonb(NEW) ->> 'last_name')), ''),
    NULLIF(trim(CONCAT(to_jsonb(OLD) ->> 'first_name', ' ', to_jsonb(OLD) ->> 'last_name')), ''),
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
    COALESCE((to_jsonb(NEW) ->> 'id')::uuid, (to_jsonb(OLD) ->> 'id')::uuid),
    v_entity_name,
    CASE WHEN TG_OP IN ('DELETE','UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
