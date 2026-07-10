-- The app's AssessmentType union and all 10 files that reference it
-- (ASSESSMENT_LABELS, filters, badges, useNextCALabel, report card PDF, etc.)
-- use the short value 'ca' for Continuous Assessment, but the original
-- CHECK constraint only allowed 'continuous_assessment' — every attempt to
-- create a CA journal (the default assessment type in the create modal)
-- failed at insert time. No exam_journal rows exist yet, so this fixes the
-- constraint to match the app rather than renaming 'ca' everywhere.
ALTER TABLE public.exam_journal DROP CONSTRAINT exam_journal_assessment_type_check;
ALTER TABLE public.exam_journal
  ADD CONSTRAINT exam_journal_assessment_type_check
  CHECK (assessment_type = ANY (ARRAY[
    'beginning_of_term'::text, 'mid_term'::text, 'end_of_term'::text,
    'ca'::text, 'aoi'::text, 'dit'::text, 'practical'::text,
    'class_test'::text, 'assignment'::text
  ]));
