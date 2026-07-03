-- Migration: standardize_staff_number_format
-- Description: Staff numbers were inconsistent because two INSERT paths
-- (StaffRegistrationWizard's manual entry, ImportDataPage's CSV import)
-- either explicitly supplied a value or left it blank in different formats,
-- so the DB trigger's old {short_name}/STAFF/{seq} generator only ever
-- caught some of them. Standardizing the generator to match the
-- admission_number pattern: {short_name}/STAFF/{YEAR}/{seq}, year-scoped
-- sequence, per product decision. Existing staff_number values are left
-- untouched (new hires only) — they're already in use (emails, printed IDs).

-- ── CHANGES ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_staff_number()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_year text; v_seq int; v_short text;
BEGIN
  IF NEW.staff_number IS NULL OR trim(NEW.staff_number) = '' THEN
    v_year := to_char(NOW(), 'YYYY');
    SELECT COALESCE(short_name, 'STF') INTO v_short FROM school_profile WHERE id = NEW.school_id;
    SELECT COALESCE(MAX(
      CASE WHEN staff_number ~ ('^' || v_short || '/STAFF/' || v_year || '/[0-9]+$')
           THEN (regexp_match(staff_number, '[0-9]+$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_seq FROM staff WHERE school_id = NEW.school_id;
    NEW.staff_number := v_short || '/STAFF/' || v_year || '/' || lpad(v_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ── VERIFICATION ─────────────────────────────────────────────
-- Run after applying to confirm it worked:
-- INSERT a test staff row with staff_number left NULL and confirm the
-- generated value matches {short_name}/STAFF/{current_year}/{seq}.
-- Existing rows are untouched:
-- SELECT staff_number FROM staff WHERE staff_number !~ '/STAFF/[0-9]{4}/[0-9]+$';
-- (returns pre-existing old-format numbers, expected and left as-is)
