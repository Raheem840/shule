-- Migration: unify_employment_type_enum
-- Description: The staff.employment_type CHECK constraint only allowed
-- 'permanent' | 'contract' | 'volunteer', but multiple UI surfaces
-- (SecretaryStaffPage's edit modal, ImportDataPage's CSV import default) had
-- already drifted to sending 'full_time' / 'part_time' — values that VIOLATE
-- this constraint, so every edit-staff save defaulting to 'full_time' would
-- fail outright. Standardizing on full_time | part_time | intern | contract
-- per product decision (no more "permanent").
--
-- Existing data remap (verified live counts before writing this: 5 rows
-- 'permanent', 1 'contract', 1 null, 0 'volunteer'):
--   permanent -> full_time (closest fit: permanent staff are the core
--     full-time staff)
--   volunteer -> intern (closest fit: informal/short-term arrangement)
--   contract  -> contract (unchanged)

-- ── CHANGES ──────────────────────────────────────────────────
-- Constraint must be swapped BEFORE remapping data — the old constraint
-- doesn't allow 'full_time'/'intern' so an UPDATE to those values fails
-- immediately if run against the still-old constraint.

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_employment_type_check
  CHECK (employment_type = ANY (ARRAY['permanent'::text, 'part_time'::text, 'contract'::text, 'volunteer'::text, 'full_time'::text, 'intern'::text]));

UPDATE public.staff SET employment_type = 'full_time' WHERE employment_type = 'permanent';
UPDATE public.staff SET employment_type = 'intern'    WHERE employment_type = 'volunteer';

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_employment_type_check
  CHECK (employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'intern'::text, 'contract'::text]));

-- ── VERIFICATION ─────────────────────────────────────────────
-- Run after applying to confirm it worked:
-- SELECT employment_type, count(*) FROM staff GROUP BY employment_type;
-- Expect: only full_time / part_time / intern / contract / null, no permanent or volunteer.
