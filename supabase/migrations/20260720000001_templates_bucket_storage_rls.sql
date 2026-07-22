-- The "templates" storage bucket (report-card letterhead uploads, IT Admin
-- → /admin/templates) had zero RLS policies on storage.objects at all —
-- every other bucket in active use (staff-photos, student-photos,
-- report-cards, staff-attachments) has matching INSERT/SELECT policies, but
-- templates was apparently never wired up when the page was built. With no
-- matching policy, Postgres RLS denies by default, so every upload attempt
-- failed with a raw storage RLS error and no way to ever succeed.
-- /admin/templates is gated to it_admin/principal (see App.tsx ProtectedRoute).

CREATE POLICY "template_read" ON storage.objects
FOR SELECT
USING (bucket_id = 'templates');

CREATE POLICY "template_upload" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'templates'
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal']))
);

CREATE POLICY "template_update" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'templates'
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal']))
);
