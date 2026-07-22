-- Adds the school-level Primary/Secondary toggle that drives which grading
-- family (CBC O-level/A-level vs PLE Primary) and which report card layout
-- applies to a school. Defaults to 'secondary' — every school in production
-- today is secondary, this must not silently change their grading.
ALTER TABLE public.school_profile
  ADD COLUMN IF NOT EXISTS education_level TEXT NOT NULL DEFAULT 'secondary'
  CHECK (education_level IN ('primary', 'secondary'));

-- Explicit flag for the 4 subjects PLE actually examines (English,
-- Mathematics, Science, Social Studies) — set once by the school rather
-- than fuzzy-matched by subject name, since a text matcher risks mismatching
-- locally-worded subject names (e.g. "Integrated Science" vs "Science").
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_ple_core BOOLEAN NOT NULL DEFAULT false;
