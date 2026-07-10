-- exam_journal_status_check only allowed 'draft'/'ready', but the entire app
-- (usePublishJournal, MarkEntryPage, ExamJournalPage, useReportCards, DoS
-- analytics) writes/reads 'published' — 'ready' is never used anywhere.
-- Every "Publish" click has always failed at the DB constraint; only 'draft'
-- rows exist live, so it's safe to fix the constraint to match the app
-- rather than rename 'published' across the whole codebase.
ALTER TABLE public.exam_journal DROP CONSTRAINT exam_journal_status_check;
ALTER TABLE public.exam_journal
  ADD CONSTRAINT exam_journal_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]));
