-- Add DELETE RLS policy for parent_accounts.
-- Without this, orphan rollback in CreateUserWizard is silently blocked:
-- the delete executes but RLS returns 0 rows affected, leaving a ghost row.
-- Allows the creating user (secretary / IT admin) to delete their own inserts.
CREATE POLICY "owner can delete parent_account"
  ON public.parent_accounts
  FOR DELETE
  USING (created_by = auth.uid());
