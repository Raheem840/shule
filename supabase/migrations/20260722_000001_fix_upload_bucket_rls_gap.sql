-- Found while writing the new-school install guide: of the app's 6 storage
-- buckets (src/lib/storage.ts BUCKETS), only 'templates' and 'documents' had
-- RLS policies anywhere in the migration history (fixed 2026-07-21). Postgres
-- storage RLS defaults to deny, so on any brand-new project three real upload
-- paths were silently broken:
--   - student-photos: written directly from the browser by
--     StudentRegistrationWizard.tsx / SecretaryStudentEditPage.tsx
--   - report-cards:   written directly from the browser by useReportCards.ts,
--     reachable only from /principal/report-cards and /secretary/report-cards
--   - staff-attachments: written directly from the browser by useMessaging.ts,
--     reachable by any staff role sending a message
-- 'staff-photos' needs no policy — it's written only by the upload-staff-photo
-- edge function using the service-role key, which bypasses RLS entirely.
-- All three buckets are keyed {school_id}/... as their first path segment,
-- same convention as templates/documents.

DROP POLICY IF EXISTS "student_photos_upload" ON storage.objects;
CREATE POLICY "student_photos_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
);

DROP POLICY IF EXISTS "student_photos_update" ON storage.objects;
CREATE POLICY "student_photos_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
);

-- student-photos is documented private (signed URLs only, see Avatar.tsx's
-- isPrivate check) — any authenticated member of the same school can view.
DROP POLICY IF EXISTS "student_photos_read" ON storage.objects;
CREATE POLICY "student_photos_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
);

DROP POLICY IF EXISTS "report_cards_upload" ON storage.objects;
CREATE POLICY "report_cards_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'report-cards'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['principal', 'secretary']))
);

DROP POLICY IF EXISTS "report_cards_update" ON storage.objects;
CREATE POLICY "report_cards_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'report-cards'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['principal', 'secretary']))
);

-- report-cards is documented public (BUCKETS comment) — students/parents view
-- their own via a plain public URL with no auth header, so this SELECT policy
-- only needs to scope by school_id, not require authentication.
DROP POLICY IF EXISTS "report_cards_read" ON storage.objects;
CREATE POLICY "report_cards_read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'report-cards'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
);

-- staff-attachments has no single-role gate — any staff role can message and
-- attach a file — so this checks real staff membership of the school instead
-- of a role whitelist.
DROP POLICY IF EXISTS "staff_attachments_upload" ON storage.objects;
CREATE POLICY "staff_attachments_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'staff-attachments'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_user_id = auth.uid()
      AND school_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "staff_attachments_read" ON storage.objects;
CREATE POLICY "staff_attachments_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'staff-attachments'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
);
