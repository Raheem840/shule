-- Found while auditing the on-prem/cloud installer: none of the app's 6
-- storage buckets were ever created by a migration — bucket creation had
-- been a manual, undocumented Supabase Dashboard step. On a fresh install
-- (local or cloud) every photo upload, document upload, report-card PDF,
-- and message attachment fails immediately, since RLS policies on
-- storage.objects (20260720_000001/2, 20260721_000003, 20260722_000001)
-- all assume these buckets already exist. Idempotent — safe to re-run on
-- an already-provisioned project (e.g. this one, where buckets already
-- exist from manual creation).
--
-- Public/private split matches CLAUDE.md's Storage Buckets table exactly.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('staff-photos',      'staff-photos',      true),
  ('student-photos',    'student-photos',    false),
  ('documents',         'documents',         false),
  ('report-cards',      'report-cards',      true),
  ('templates',         'templates',         false),
  ('staff-attachments', 'staff-attachments', true)
ON CONFLICT (id) DO NOTHING;
