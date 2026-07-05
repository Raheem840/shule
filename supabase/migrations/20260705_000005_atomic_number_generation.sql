-- generate_staff_number() and generate_admission_number() both compute the
-- next sequence number via SELECT MAX(...)+1 with no locking. Under READ
-- COMMITTED (Postgres default), two concurrent INSERTs for the same school
-- can both run this SELECT before either commits, both read the same MAX,
-- and both generate the identical staff_number/admission_number — a real
-- risk during concurrent registration (e.g. a bulk-import batch, or two
-- secretaries enrolling students at the same time). Fixed by taking a
-- transaction-scoped advisory lock keyed on school_id before computing the
-- sequence, serializing concurrent inserts for the same school without
-- blocking inserts for different schools. Lock auto-releases at commit.

CREATE OR REPLACE FUNCTION generate_staff_number()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_year text; v_seq int; v_short text; v_short_escaped text;
BEGIN
  IF NEW.staff_number IS NULL OR trim(NEW.staff_number) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('staff_number:' || NEW.school_id::text, 0));
    v_year := to_char(NOW(), 'YYYY');
    SELECT COALESCE(short_name, 'STF') INTO v_short FROM school_profile WHERE id = NEW.school_id;
    v_short_escaped := regexp_replace(v_short, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
    SELECT COALESCE(MAX(
      CASE WHEN staff_number ~ ('^' || v_short_escaped || '/STAFF/' || v_year || '/[0-9]+$')
           THEN (regexp_match(staff_number, '[0-9]+$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_seq FROM staff WHERE school_id = NEW.school_id;
    NEW.staff_number := v_short || '/STAFF/' || v_year || '/' || lpad(v_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_admission_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
  v_seq  INT;
BEGIN
  IF NEW.admission_number IS NULL OR trim(NEW.admission_number) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('admission_number:' || NEW.school_id::text, 0));
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
