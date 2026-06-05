# Shule — Supabase Migrations

## What this folder is
Every SQL change to the Shule schema lives here as a numbered migration file.
Single source of truth for database structure across all schools.

## File naming
- Legacy: `00001_initial_schema.sql` (early sessions)
- Current: `20260605_000002_description.sql` (YYYYMMDD_NNNNNN_description)

## What migrations contain
- CREATE TABLE / ALTER TABLE
- CREATE INDEX
- Row Level Security (ENABLE ROW LEVEL SECURITY + CREATE POLICY)
- Helper functions (user_role, user_school_id, custom_access_token_hook)
- Triggers (audit log, auto-generate admission/staff numbers)

## What migrations do NOT contain
- INSERT statements (no seed data)
- Demo school data
- Hardcoded UUIDs for specific schools

Demo seed data → `supabase/seed/demo_seed.sql` (never deployed to schools)

## Deploy to a new school
1. `supabase link --project-ref [SCHOOL-REF]`
2. `supabase db push`
3. Register JWT hook manually: Dashboard → Authentication → Hooks → Custom Access Token → `custom_access_token_hook`
4. `supabase link --project-ref [DEMO-REF]` ← always switch back

## Add a new migration
1. `npm run migrate:new descriptive_name`
2. Edit generated file
3. Test on demo: `supabase db push`
4. Deploy to schools when ready
