-- Auto-generate admission_number on students INSERT when blank
-- Generates format: {short_name}/{YYYY}/{seq} e.g. SCH/2026/0001

CREATE OR REPLACE FUNCTION generate_admission_number()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_year text; v_seq int; v_short text;
BEGIN
  IF NEW.admission_number IS NULL OR trim(NEW.admission_number) = '' THEN
    v_year := to_char(NOW(), 'YYYY');
    SELECT COALESCE(short_name, 'SCH') INTO v_short FROM school_profile WHERE id = NEW.school_id;
    SELECT COALESCE(MAX(
      CASE WHEN admission_number ~ ('^' || v_short || '/' || v_year || '/[0-9]+$')
           THEN (regexp_match(admission_number, '[0-9]+$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_seq FROM students WHERE school_id = NEW.school_id;
    NEW.admission_number := v_short || '/' || v_year || '/' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gen_admission_number
  BEFORE INSERT ON students
  FOR EACH ROW EXECUTE FUNCTION generate_admission_number();
