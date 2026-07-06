-- CRITICAL: dos_assign_class_teacher / dos_assign_classes / dos_assign_subjects
-- are SECURITY DEFINER (bypass RLS entirely) and were scoping their UPDATEs by
-- a CLIENT-SUPPLIED p_school_id parameter with zero verification it matches
-- the caller's own school. Any dos/secretary/it_admin/principal user could
-- call these RPCs directly (e.g. via devtools) with an arbitrary school_id
-- and silently rewrite another school's staff.role/classes/subjects or a
-- stream's class_teacher_id — a full cross-tenant write bypass on the one
-- code path in the app that skips RLS. Fixed by deriving the school id from
-- the caller's own JWT claim (same source already used for the role check)
-- instead of trusting the parameter.

CREATE OR REPLACE FUNCTION public.dos_assign_class_teacher(p_stream_id uuid, p_teacher_id uuid, p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role text;
  v_school_id uuid;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'user_role';
  v_school_id := (current_setting('request.jwt.claims', true)::jsonb->>'school_id')::uuid;

  IF v_role NOT IN ('principal', 'secretary', 'it_admin', 'dos') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE staff
  SET role = 'class_teacher'
  WHERE id = p_teacher_id
    AND school_id = v_school_id;

  UPDATE streams
  SET class_teacher_id = p_teacher_id
  WHERE id = p_stream_id
    AND school_id = v_school_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dos_assign_classes(p_staff_id uuid, p_classes uuid[], p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role text;
  v_school_id uuid;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'user_role';
  v_school_id := (current_setting('request.jwt.claims', true)::jsonb->>'school_id')::uuid;

  IF v_role NOT IN ('principal', 'secretary', 'it_admin', 'dos') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE staff
  SET classes = p_classes
  WHERE id = p_staff_id
    AND school_id = v_school_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dos_assign_subjects(p_staff_id uuid, p_subjects text[], p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role text;
  v_school_id uuid;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'user_role';
  v_school_id := (current_setting('request.jwt.claims', true)::jsonb->>'school_id')::uuid;

  IF v_role NOT IN ('principal', 'secretary', 'it_admin', 'dos') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE staff
  SET subjects = p_subjects
  WHERE id = p_staff_id
    AND school_id = v_school_id;
END;
$function$;

-- Found while auditing the above: save_school_api_key (writes SMS/WhatsApp
-- API secrets to school_profile) had NO role check at all — any
-- authenticated user, any role, any school, could overwrite ANY school's
-- API secrets by calling this RPC directly with an arbitrary p_school_id.
-- Even worse than the three functions above (those at least checked role).
CREATE OR REPLACE FUNCTION public.save_school_api_key(p_school_id uuid, p_key_name text, p_key_value text, p_enabled boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_value text := CASE WHEN p_enabled AND p_key_value <> '' THEN p_key_value ELSE NULL END;
  v_role text;
  v_school_id uuid;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'user_role';
  v_school_id := (current_setting('request.jwt.claims', true)::jsonb->>'school_id')::uuid;

  IF v_role NOT IN ('principal', 'it_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_key_name = 'at_api_key' THEN
    UPDATE school_profile SET at_api_key     = v_value WHERE id = v_school_id;
  ELSIF p_key_name = 'at_username' THEN
    UPDATE school_profile SET at_username    = v_value WHERE id = v_school_id;
  ELSIF p_key_name = 'at_sender_id' THEN
    UPDATE school_profile SET at_sender_id   = v_value WHERE id = v_school_id;
  ELSIF p_key_name = 'wa_phone_number_id' THEN
    UPDATE school_profile SET wa_phone_number_id = v_value WHERE id = v_school_id;
  ELSIF p_key_name = 'wa_access_token' THEN
    UPDATE school_profile SET wa_access_token = v_value WHERE id = v_school_id;
  ELSE
    RAISE EXCEPTION 'Unknown key name: %', p_key_name;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'school_profile row not found for id %', v_school_id;
  END IF;
END;
$function$;
