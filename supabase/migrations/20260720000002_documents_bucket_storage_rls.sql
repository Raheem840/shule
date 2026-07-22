-- The "documents" storage bucket (staff NIN/transcripts/certs, uploaded via
-- StaffRegistrationWizard.tsx's uploadDocument()) had zero RLS policies on
-- storage.objects, same class of bug as the templates bucket fixed in
-- 20260720_000001 — with no matching policy, Postgres denies by default,
-- so every upload/read attempt would fail. Mirrors the existing
-- staff_documents TABLE RLS policies (00003_rls_policies.sql) exactly:
-- principal/secretary/it_admin can insert and view any staff member's
-- documents; a staff member can also view their own. Path format is
-- {school_id}/{staff_id}/{doc_type}_{timestamp}.{ext} (see
-- uploadDocument() in src/lib/storage.ts), so ownership is checked via the
-- second path segment.

CREATE POLICY "document_upload" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
);

CREATE POLICY "document_update" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
);

CREATE POLICY "document_delete" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = 'principal')
);

CREATE POLICY "document_read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
    OR (
      (storage.foldername(name))[2] = (
        SELECT id::text FROM public.staff WHERE auth_user_id = auth.uid()
      )
    )
  )
);
