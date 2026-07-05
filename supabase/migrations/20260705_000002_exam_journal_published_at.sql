-- Tracks when an exam_journal was first published, so the app can compute a
-- grace-period lock on its marks (edits allowed freely for N days after
-- publish; after that, an audited override reason is required). Existing
-- already-published journals get NULL, which the app treats as "never
-- locked" — preserving today's freely-editable behavior for historical data;
-- only journals published going forward start the grace-period clock.
ALTER TABLE exam_journal ADD COLUMN IF NOT EXISTS published_at timestamptz;
