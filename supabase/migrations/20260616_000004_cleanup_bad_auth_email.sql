-- Clean up the one student activated before the STU/ migration ran.
-- Their Supabase auth user (sch20260003@gm.ug) was deleted via admin query;
-- this migration clears the stale auth fields so they can be re-activated cleanly.

UPDATE public.students
SET auth_user_id  = NULL,
    auth_email    = NULL,
    temp_password = NULL
WHERE auth_email IS NOT NULL
  AND auth_email NOT LIKE 'stu%'
  AND admission_number LIKE 'STU/%';
