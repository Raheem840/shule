-- Auto-generate staff_number on staff INSERT when blank
-- Generates format: {short_name}/STAFF/{seq} e.g. SCH/STAFF/001

CREATE OR REPLACE FUNCTION generate_staff_number()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_seq int; v_short text;
BEGIN
  IF NEW.staff_number IS NULL OR trim(NEW.staff_number) = '' THEN
    SELECT COALESCE(short_name, 'STF') INTO v_short FROM school_profile WHERE id = NEW.school_id;
    SELECT COALESCE(MAX(
      CASE WHEN staff_number ~ ('^' || v_short || '/STAFF/[0-9]+$')
           THEN (regexp_match(staff_number, '[0-9]+$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_seq FROM staff WHERE school_id = NEW.school_id;
    NEW.staff_number := v_short || '/STAFF/' || lpad(v_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gen_staff_number
  BEFORE INSERT ON staff
  FOR EACH ROW EXECUTE FUNCTION generate_staff_number();
