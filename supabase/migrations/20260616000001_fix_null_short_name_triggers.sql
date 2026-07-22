-- Fix: when school_profile.short_name is NULL, triggers generated NULL admission/staff numbers
-- causing NOT NULL constraint violations. Use COALESCE to fall back to 'STU'/'STF'.

CREATE OR REPLACE FUNCTION generate_admission_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_short TEXT;
  v_year  INT  := EXTRACT(YEAR FROM CURRENT_DATE);
  v_seq   INT;
BEGIN
  IF NEW.admission_number IS NULL OR trim(NEW.admission_number) = '' THEN
    SELECT COALESCE(sp.short_name, 'STU') INTO v_short
    FROM   public.school_profile sp
    WHERE  sp.id = NEW.school_id
    LIMIT  1;

    SELECT COALESCE(MAX(
      CASE WHEN admission_number ~ ('^' || v_short || '/' || v_year || '/[0-9]+$')
           THEN (regexp_match(admission_number, '[0-9]+$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_seq
    FROM public.students WHERE school_id = NEW.school_id;

    NEW.admission_number := v_short || '/' || v_year || '/' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_staff_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_short TEXT;
  v_seq   INT;
BEGIN
  IF NEW.staff_number IS NULL OR trim(NEW.staff_number) = '' THEN
    SELECT COALESCE(sp.short_name, 'STF') INTO v_short
    FROM   public.school_profile sp
    WHERE  sp.id = NEW.school_id
    LIMIT  1;

    SELECT COALESCE(MAX(
      CASE WHEN staff_number ~ ('^' || v_short || '/STAFF/[0-9]+$')
           THEN (regexp_match(staff_number, '[0-9]+$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_seq
    FROM public.staff WHERE school_id = NEW.school_id;

    NEW.staff_number := v_short || '/STAFF/' || lpad(v_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;
