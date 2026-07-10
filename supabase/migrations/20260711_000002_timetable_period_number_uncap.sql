-- The DOS timetable UI lets a school add unlimited custom periods beyond the
-- 11-slot default (Assembly, Period 1-7, Break, Lunch, Preps) via "Add Period",
-- but this CHECK constraint hardcoded an upper bound of 8 — any class-type slot
-- landing on the afternoon periods (Period 6 = num 9, Period 7 = num 10) or any
-- custom-added period past 8 was rejected outright with a raw constraint-
-- violation error, surfacing to DOS as an inexplicable "can't add a second
-- class for this teacher today" when the failing slot happened to be in the
-- afternoon. Widened to just require a positive period number.
alter table timetable_slots drop constraint timetable_slots_period_number_check;
alter table timetable_slots add constraint timetable_slots_period_number_check
  check (period_number >= 1);
