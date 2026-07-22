-- Fixes: curriculum_plan allowed far more than teachers to flip `covered`.
--   1. "curriculum_plan_update" had no role check at all — any authenticated
--      staff member in the school (bursar, secretary, deputy...) could UPDATE
--      any column, including covered/covered_at/covered_by.
--   2. "dos_principal_can_update_curriculum" explicitly let dos/principal mark
--      topics covered too — the DoS Curriculum Plan page is meant to be a
--      read-only oversight view (topic coverage is reported BY teachers, not
--      recorded BY the DoS). Only "teacher_can_mark_covered" should remain.
DROP POLICY IF EXISTS "curriculum_plan_update"               ON "public"."curriculum_plan";
DROP POLICY IF EXISTS "dos_principal_can_update_curriculum"  ON "public"."curriculum_plan";
