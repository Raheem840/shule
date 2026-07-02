-- Migration: prevent_teacher_double_booking
-- Description: timetable_slots only had a UNIQUE constraint on
-- (school_id, class_id, stream_id, day_of_week, period_number, term, year) —
-- the "class already booked" side of a collision. Nothing enforced the
-- "teacher already booked elsewhere" side at the database level; it was only
-- checked client-side (useCheckCollision) before insert/move, so a race
-- between two concurrent DOS sessions, or any direct API call bypassing the
-- UI, could still double-book a teacher. teacher_id is nullable (free/admin
-- periods), and Postgres UNIQUE constraints treat NULLs as distinct from each
-- other, so this is safe to add without a partial index.

-- ── CHANGES ──────────────────────────────────────────────────

ALTER TABLE public.timetable_slots
  ADD CONSTRAINT timetable_slots_teacher_no_double_booking
  UNIQUE (school_id, teacher_id, day_of_week, period_number, term, year);

-- ── VERIFICATION ─────────────────────────────────────────────
-- Run after applying to confirm it worked:
-- SELECT conname FROM pg_constraint WHERE conname = 'timetable_slots_teacher_no_double_booking';
-- Confirmed no existing violations before writing this migration:
-- SELECT school_id, teacher_id, day_of_week, period_number, term, year, count(*)
-- FROM timetable_slots WHERE teacher_id IS NOT NULL
-- GROUP BY 1,2,3,4,5,6 HAVING count(*) > 1;  -- returned 0 rows
