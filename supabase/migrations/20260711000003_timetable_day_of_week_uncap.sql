-- Same class of bug as the period_number cap fixed in 20260711_000002: the
-- DOS timetable UI already supports Saturday/Sunday (DAYS array + the
-- dayOfWeek: 1|2|3|4|5|6|7 type in DosTimetablePage.tsx), since some schools
-- do run Saturday classes/preps — but this CHECK constraint hardcoded
-- Mon-Fri only (1-5), silently rejecting any Sat/Sun slot a school actually
-- wants. Widened to the full 1-7 week.
alter table timetable_slots drop constraint timetable_slots_day_of_week_check;
alter table timetable_slots add constraint timetable_slots_day_of_week_check
  check (day_of_week >= 1 and day_of_week <= 7);
