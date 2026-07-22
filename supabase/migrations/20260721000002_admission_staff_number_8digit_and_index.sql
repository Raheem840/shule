-- Fixes C7 and H1 from the 2026-07-21 audit (docs/audit-findings-2026-07-21.md).
--
-- C7: the agreed format is STU/year/00000xxx (8-digit sequence) for
-- students, and the same 8-digit rule for staff numbers, regardless of
-- which page/flow creates the record. Both generate_staff_number() and
-- generate_admission_number() currently pad to 3/4 digits instead of 8.
-- Existing rows are NOT rewritten (would break already-issued/printed
-- numbers still in use) — only the generator changes, going forward.
--
-- H1: staff has no uniqueness guarantee at all (students already have
-- students_school_admission_idx) — a race, a bug, or an explicit duplicate
-- CSV value can silently create two staff members sharing one number.

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
    NEW.staff_number := v_short || '/STAFF/' || v_year || '/' || lpad(v_seq::text, 8, '0');
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

    NEW.admission_number := 'STU/' || v_year || '/' || lpad(v_seq::text, 8, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- H1: staff_number uniqueness — mirrors students_school_admission_idx
-- exactly. Partial (WHERE staff_number IS NOT NULL) so it can't conflict
-- with any row mid-creation where the trigger hasn't assigned one yet.
CREATE UNIQUE INDEX IF NOT EXISTS staff_school_number_idx
  ON public.staff (school_id, staff_number)
  WHERE staff_number IS NOT NULL;

-- Reserves the next STU/{year}/{8-digit-seq} admission number for a given
-- school+year, using the same advisory lock as generate_admission_number()
-- so it's serialized against both the trigger and other calls to this RPC.
-- Needed for historical-year bulk imports (src/lib/studentImport.ts): the
-- trigger only ever computes a NEW.admission_number using the CURRENT
-- year, so back-dated imports must generate their own — previously via an
-- unlocked in-memory counter that could collide with a concurrent import
-- for the same school/year.
CREATE OR REPLACE FUNCTION reserve_admission_number(p_school_id uuid, p_year int)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_seq int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('admission_number:' || p_school_id::text, 0));
  SELECT COALESCE(MAX(
    CASE WHEN admission_number ~ ('^STU/' || p_year || '/[0-9]+$')
         THEN (regexp_match(admission_number, '[0-9]+$'))[1]::int ELSE 0 END
  ), 0) + 1 INTO v_seq
  FROM public.students WHERE school_id = p_school_id;

  RETURN 'STU/' || p_year || '/' || lpad(v_seq::text, 8, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION reserve_admission_number(uuid, int) TO authenticated;
