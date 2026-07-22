-- Found during a manual deputy-role audit: runPromotion (src/hooks/useAdmin.ts,
-- shared by usePromoteStudents/useSelectivePromote — both deputy-callable via
-- PromoteStudentsSection) sets status: 'completed' for any student already at
-- the school's highest configured class level (the terminal-level branch —
-- e.g. S.4/S.6 graduating). "students_status_check" never allowed that value
-- (only 'active'/'suspended'/'expelled'), so every end-of-year promotion run
-- hit a CHECK-constraint violation for exactly the batch of students it
-- matters most for — the graduating class. A test already asserts this exact
-- patch (src/test/hooks/usePromoteStudents.test.tsx), confirming 'completed'
-- is the intended value, not a typo for one of the existing three.
ALTER TABLE "public"."students" DROP CONSTRAINT IF EXISTS "students_status_check";
ALTER TABLE "public"."students" ADD CONSTRAINT "students_status_check"
  CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'expelled'::"text", 'completed'::"text"])));
