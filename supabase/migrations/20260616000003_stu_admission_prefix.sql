-- Rename existing SCH/ and SCHOOL/ admission numbers to STU/
-- and update the trigger to always generate STU/ prefixes.

UPDATE public.students
SET admission_number = regexp_replace(admission_number, '^[^/]+', 'STU')
WHERE admission_number ~ '^(SCH|SCHOOL)/';

-- Update trigger: always use STU as the student prefix (not school short_name)
CREATE OR REPLACE FUNCTION generate_admission_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
  v_seq  INT;
BEGIN
  IF NEW.admission_number IS NULL OR trim(NEW.admission_number) = '' THEN
    SELECT COALESCE(MAX(
      CASE WHEN admission_number ~ ('^STU/' || v_year || '/[0-9]+$')
           THEN (regexp_match(admission_number, '[0-9]+$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_seq
    FROM public.students WHERE school_id = NEW.school_id;

    NEW.admission_number := 'STU/' || v_year || '/' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
