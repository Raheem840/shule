-- Found by /code-review ultra (bug_005): staff_attachments_upload
-- (20260722000001_fix_upload_bucket_rls_gap.sql) only checked staff
-- membership, but useUploadAttachment (src/hooks/useMessaging.ts) is the
-- SAME upload path used by PortalChatThread (src/components/shared/
-- PortalMessaging.tsx), rendered inside both ParentPortalPage and
-- StudentPortalPage's Messages tab. Parents live in parent_accounts,
-- students in students — neither ever has a public.staff row, so every
-- attachment upload from a parent/student reply silently 403'd while
-- plain-text replies kept working ("half-broken" symptom). The read
-- policy (staff_attachments_read) was already correctly unscoped by role
-- — this closes the asymmetry on the write side to match.
DROP POLICY IF EXISTS "staff_attachments_upload" ON storage.objects;
CREATE POLICY "staff_attachments_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'staff-attachments'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE auth_user_id = auth.uid()
        AND school_id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.parent_accounts
      WHERE auth_user_id = auth.uid()
        AND school_id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.students
      WHERE auth_user_id = auth.uid()
        AND school_id::text = (storage.foldername(name))[1]
    )
  )
);
