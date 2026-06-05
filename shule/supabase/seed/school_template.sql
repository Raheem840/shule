-- ============================================================
-- SHULE — NEW SCHOOL ONBOARDING TEMPLATE
-- ============================================================
-- 1. Replace ALL [REPLACE] values with real school data
-- 2. Run in the new school's Supabase SQL Editor
-- 3. Create IT Admin auth account: Dashboard → Auth → Users → Invite user
-- 4. Update staff INSERT below with their auth_user_id
-- ============================================================

-- Step 1: School profile
INSERT INTO public.school_profile (
  id, school_name, short_name, motto, primary_color, curriculum, deployment_mode, parent_portal_open
) VALUES (
  gen_random_uuid(),
  '[REPLACE: Full school name e.g. St. Mary''s College Kisubi]',
  '[REPLACE: Abbreviation e.g. SMACK]',
  '[REPLACE: School motto]',
  '#0d9488',
  'ncdc_uganda',
  'cloud',
  true
) RETURNING id;
-- ↑ Copy this UUID for the next step

-- Step 2: IT Admin staff record
-- (Replace SCHOOL_ID_HERE with the UUID returned above)
-- (Replace AUTH_USER_ID_HERE with the auth user ID from Supabase Auth)
INSERT INTO public.staff (
  school_id, auth_user_id, first_name, last_name, role, is_active
) VALUES (
  '[REPLACE: school_id from RETURNING above]',
  '[REPLACE: auth_user_id from Supabase Auth → Users]',
  '[REPLACE: First name]',
  '[REPLACE: Last name]',
  'it_admin',
  true
);
