-- Migration: escape_short_name_in_staff_number_regex
-- Created: Fri 03 Jul 2026 02:19:21 PM EAT
-- Author: Sinqura Dev Team
-- Description: generate_staff_number() (added in 20260703_000001) built its
-- regex match by raw string-concatenating school_profile.short_name, so a
-- short_name containing a regex metacharacter (e.g. '.', '(', '+') would
-- either throw an invalid-regex error on every staff INSERT for that school,
-- or silently match the wrong rows. Escape metacharacters before building
-- the pattern.

-- ── CHANGES ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_staff_number()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_year text; v_seq int; v_short text; v_short_escaped text;
BEGIN
  IF NEW.staff_number IS NULL OR trim(NEW.staff_number) = '' THEN
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

-- ── VERIFICATION ─────────────────────────────────────────────
-- Run after applying: set a school's short_name to something with a regex
-- metacharacter (e.g. 'ST.MARY') and confirm a new staff INSERT with a blank
-- staff_number succeeds and produces 'ST.MARY/STAFF/{year}/001' rather than
-- throwing or matching an unrelated row.
