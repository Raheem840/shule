-- RPC: save_school_api_key
-- Called by IT admin API Config page to persist AT / WhatsApp credentials.
-- Uses SECURITY DEFINER so the function can write school_profile regardless of RLS,
-- but only allows the 5 known key names (no dynamic SQL — no injection surface).

CREATE OR REPLACE FUNCTION public.save_school_api_key(
  p_school_id  uuid,
  p_key_name   text,
  p_key_value  text,
  p_enabled    boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text := CASE WHEN p_enabled AND p_key_value <> '' THEN p_key_value ELSE NULL END;
BEGIN
  IF p_key_name = 'at_api_key' THEN
    UPDATE school_profile SET at_api_key     = v_value WHERE id = p_school_id;
  ELSIF p_key_name = 'at_username' THEN
    UPDATE school_profile SET at_username    = v_value WHERE id = p_school_id;
  ELSIF p_key_name = 'at_sender_id' THEN
    UPDATE school_profile SET at_sender_id   = v_value WHERE id = p_school_id;
  ELSIF p_key_name = 'wa_phone_number_id' THEN
    UPDATE school_profile SET wa_phone_number_id = v_value WHERE id = p_school_id;
  ELSIF p_key_name = 'wa_access_token' THEN
    UPDATE school_profile SET wa_access_token = v_value WHERE id = p_school_id;
  ELSE
    RAISE EXCEPTION 'Unknown key name: %', p_key_name;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'school_profile row not found for id %', p_school_id;
  END IF;
END;
$$;

-- Only authenticated school users may call this
REVOKE ALL ON FUNCTION public.save_school_api_key(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_school_api_key(uuid, text, text, boolean) TO authenticated;
