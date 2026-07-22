-- fee_structure only had a DELETE policy for 'principal'. Bursar already has
-- insert/update rights on this table (see the existing "bursar and principal
-- can insert/update" policies) but no delete policy at all, so a bursar
-- deleting a fee item hit RLS silently: Postgres/PostgREST treat a DELETE
-- matching zero rows as success (not an error), so the app showed "deleted"
-- while the row was never actually removed.
CREATE POLICY "fee_structure: bursar can delete"
  ON public.fee_structure
  FOR DELETE
  USING (school_id = auth_school_id() AND auth_role() = 'bursar');
