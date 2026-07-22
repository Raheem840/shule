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

-- Step 3: Deployment/ops record for this install (Sinqura-internal — table is
-- deny-all to every school JWT, service_role only, so this never surfaces
-- inside the app). Run for every deployment type, Cloud included — it's
-- your own support/contact record, not just a backup flag. cloud_backup_enabled
-- starts false and only ever flips to true automatically, the first time
-- scripts/backup-upload.sh succeeds (Hybrid installs only) — leave it false
-- here even for a Hybrid school; it's a "has a backup actually landed" flag,
-- not a "was hybrid configured" flag. For a Cloud install it stays false
-- permanently and that's correct — Cloud schools rely on Supabase's own
-- hosted backups, not this mechanism.
INSERT INTO public.school_registry (
  school_id, contact_name, contact_email, contact_phone,
  deployment_type, status, installation_notes, assigned_team_member,
  cloud_backup_enabled
) VALUES (
  '[REPLACE: school_id from RETURNING above]',
  '[REPLACE: on-site contact name]',
  '[REPLACE: on-site contact email]',
  '[REPLACE: on-site contact phone]',
  '[REPLACE: local | cloud | hybrid]',
  '[REPLACE: active_local | active_cloud | active_hybrid]',
  '[REPLACE: any install notes — hardware specs, network setup, etc.]',
  '[REPLACE: your name]',
  false
);
