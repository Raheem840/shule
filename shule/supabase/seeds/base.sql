-- base.sql — Neutral reference data safe for any Ugandan secondary school
-- Run on every installation (cloud + local).
-- No school-specific or personally identifiable data.

-- ── USAGE ────────────────────────────────────────────────────────────────────
-- Called automatically by scripts/apply-migrations.sh (default, no --with-demo)
-- Manual: supabase db execute --file supabase/seeds/base.sql --project-ref $REF

-- ── NOTES ────────────────────────────────────────────────────────────────────
-- All inserts are school-agnostic reference data.
-- School-specific data (classes, staff, students) is entered through the app UI.
-- Subjects below match Uganda NCDC CBC curriculum for O-Level secondary.

-- This seed is intentionally minimal.
-- Subjects are seeded as school_id = NULL (template rows).
-- The app creates school-specific copies when the school is onboarded.

DO $$
BEGIN
  -- Only seed if no subjects exist yet (idempotent)
  IF NOT EXISTS (SELECT 1 FROM subjects LIMIT 1) THEN

    -- Core subjects (O-Level Uganda NCDC)
    INSERT INTO subjects (id, school_id, name, curriculum_code, level, is_active) VALUES
      (gen_random_uuid(), NULL, 'Mathematics',                  'MTH',  'O-Level', true),
      (gen_random_uuid(), NULL, 'English Language',             'ENG',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Physics',                      'PHY',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Chemistry',                    'CHE',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Biology',                      'BIO',  'O-Level', true),
      (gen_random_uuid(), NULL, 'History',                      'HIS',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Geography',                    'GEO',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Christian Religious Education','CRE',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Islamic Religious Education',  'IRE',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Commerce',                     'COM',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Entrepreneurship',             'ENT',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Agriculture',                  'AGR',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Computer Studies',             'CMP',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Fine Art',                     'ART',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Music',                        'MUS',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Physical Education',           'PE',   'O-Level', true),
      (gen_random_uuid(), NULL, 'Literature in English',        'LIT',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Technical Drawing',            'TDR',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Food and Nutrition',           'FDN',  'O-Level', true),
      (gen_random_uuid(), NULL, 'Home Economics',               'HEC',  'O-Level', true),
      -- A-Level
      (gen_random_uuid(), NULL, 'Economics',                    'ECO',  'A-Level', true),
      (gen_random_uuid(), NULL, 'General Paper',                'GP',   'A-Level', true),
      (gen_random_uuid(), NULL, 'Subsidiary Mathematics',       'SubM', 'A-Level', true),
      (gen_random_uuid(), NULL, 'Divinity',                     'DIV',  'A-Level', true);

    RAISE NOTICE 'Base subjects seeded: 24 rows';
  ELSE
    RAISE NOTICE 'Subjects already exist — skipping base seed';
  END IF;
END $$;
