-- Deactivated staff (staff.is_active = false) must not receive a working session.
-- Previously the hook issued role/school_id claims regardless of is_active, so a
-- deactivated staff member could still sign in (or keep refreshing an existing
-- session) as long as no auth-level ban had been separately applied. This closes
-- that gap: no role/school_id claims are issued for inactive staff, and an
-- `account_status: deactivated` claim is added so the frontend can show a clear
-- message instead of the generic "not linked to a school role" one.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id     UUID;
  v_role        TEXT;
  v_school_id   UUID;
  v_staff_id    TEXT;
  v_name        TEXT;
  v_student_ids UUID[];
  v_is_active   BOOLEAN;
BEGIN
  v_user_id := (event->>'user_id')::uuid;

  -- 1. Check staff table first (all staff roles)
  SELECT s.role::text, s.school_id, s.id::text,
         (s.first_name || ' ' || s.last_name), s.is_active
  INTO   v_role, v_school_id, v_staff_id, v_name, v_is_active
  FROM   public.staff s
  WHERE  s.auth_user_id = v_user_id
  LIMIT  1;

  IF v_role IS NOT NULL AND v_is_active = false THEN
    -- Deactivated — do not issue role/school_id claims, mark why.
    event := jsonb_set(event, '{claims,account_status}', to_jsonb('deactivated'::text));
    RETURN event;
  END IF;

  -- 2. Check students table
  IF v_role IS NULL THEN
    SELECT 'student', st.school_id, NULL, (st.first_name || ' ' || st.last_name)
    INTO   v_role, v_school_id, v_staff_id, v_name
    FROM   public.students st
    WHERE  st.auth_user_id = v_user_id
    LIMIT  1;
  END IF;

  -- 3. Check parent_accounts table (also inject student_ids)
  IF v_role IS NULL THEN
    SELECT 'parent', pa.school_id, NULL, pa.full_name, pa.student_ids
    INTO   v_role, v_school_id, v_staff_id, v_name, v_student_ids
    FROM   public.parent_accounts pa
    WHERE  pa.auth_user_id = v_user_id
    LIMIT  1;
  END IF;

  -- Inject claims if a role was found
  IF v_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
    event := jsonb_set(event, '{claims,school_id}', to_jsonb(v_school_id::text));
    IF v_name IS NOT NULL THEN
      event := jsonb_set(event, '{claims,full_name}', to_jsonb(v_name));
    END IF;
    IF v_staff_id IS NOT NULL THEN
      event := jsonb_set(event, '{claims,staff_id}',  to_jsonb(v_staff_id));
    END IF;
    IF v_student_ids IS NOT NULL AND array_length(v_student_ids, 1) > 0 THEN
      event := jsonb_set(event, '{claims,student_ids}', to_jsonb(v_student_ids));
    END IF;
  END IF;

  RETURN event;
END;
$function$;
