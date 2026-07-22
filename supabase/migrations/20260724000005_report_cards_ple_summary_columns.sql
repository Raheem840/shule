-- Adds PLE-specific summary columns to report_cards, populated only for
-- Primary schools (education_level='primary') — left null for Secondary,
-- whose summary lives in the existing generated PDF's CBC total/avgGrade
-- fields instead. Nullable, no backfill needed for existing rows.
ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS aggregate_points INTEGER NULL,
  ADD COLUMN IF NOT EXISTS division TEXT NULL;
