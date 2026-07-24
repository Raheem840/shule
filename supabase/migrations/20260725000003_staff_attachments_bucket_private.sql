-- Migration: staff_attachments_bucket_private
-- Description: Final full-app code-review (2026-07-25) found staff-attachments
-- was created as a PUBLIC bucket (20260722000002_create_storage_buckets.sql).
-- Three later migrations (20260722000001, 20260723000001, 20260724000014)
-- added storage.objects RLS policies scoped by school_id, believing that
-- closed cross-school access to message attachments — but Supabase's
-- public-bucket object-serving route does not evaluate storage.objects RLS
-- at all. Those policies protected nothing for the getPublicUrl links the
-- app actually used: any message attachment's URL (school_id/staff_id/
-- timestamp path — guessable, potentially forwarded/cached/leaked via a DB
-- backup) was fetchable by anyone with the link, no auth required, RLS
-- notwithstanding.
--
-- Flips the bucket private. The app side (useUploadAttachment in
-- useMessaging.ts, and every UI that renders an attachment link) was updated
-- in the same pass to store/resolve a storage PATH via short-lived signed
-- URLs (getStaffAttachmentUrl in storage.ts) instead of a permanent public
-- URL — mirrors the pattern student-photos/documents/templates already use.
-- Already-sent messages have attachment_url values that are full public
-- URLs, not paths; getSignedUrl already has legacy-URL-extraction logic
-- (added for the same reason on other buckets) that handles this
-- transparently, so no data backfill is needed.

-- ── CHANGES ──────────────────────────────────────────────────

UPDATE storage.buckets SET public = false WHERE id = 'staff-attachments';

-- ── VERIFICATION ─────────────────────────────────────────────
-- As any unauthenticated request: GET the object's old getPublicUrl-style
-- URL (…/storage/v1/object/public/staff-attachments/<path>) → 400/404
-- (was previously 200, serving the file with zero auth).
-- As an authenticated staff/parent/student JWT that IS a party to the
-- message: supabase.storage.from('staff-attachments').createSignedUrl(path)
-- → succeeds (storage.objects RLS SELECT policy now actually applies).
