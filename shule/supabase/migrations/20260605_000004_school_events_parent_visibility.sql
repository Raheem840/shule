-- Add visible_to_parents boolean to school_events
-- Controls whether parents can see an event in the parent portal

ALTER TABLE school_events
  ADD COLUMN IF NOT EXISTS visible_to_parents boolean NOT NULL DEFAULT false;
