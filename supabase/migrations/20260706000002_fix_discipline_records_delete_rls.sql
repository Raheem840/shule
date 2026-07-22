-- discipline_records DELETE had two problems, confirmed live:
-- 1. Two permissive DELETE policies existed ("deputy_can_delete_discipline"
--    and "discipline_records_delete"). Postgres ORs permissive policies for
--    the same command together, so the broader one ("deputy_can_delete_
--    discipline" — any deputy/principal, no ownership check) made the
--    narrower one's ownership restriction a dead no-op. Same class of bug
--    already found and fixed once for `attendance` UPDATE (2026-07-04).
-- 2. The narrower policy's own ownership check was ALSO wrong on its own
--    terms: `recorded_by = auth.uid()` compares a staff.id FK column against
--    the auth user's UUID — these are different id spaces (recorded_by
--    stores staff.id, not auth_user_id), so it would essentially never
--    match even without the OR-widening bug above.
--
-- Fixed by dropping both and replacing with one correct policy: principal
-- can delete any record in their school; deputy can only delete records
-- where recorded_by resolves (via staff.auth_user_id) to their own staff row.

DROP POLICY IF EXISTS "deputy_can_delete_discipline" ON discipline_records;
DROP POLICY IF EXISTS "discipline_records_delete" ON discipline_records;

CREATE POLICY "discipline_records_delete_own_or_principal" ON discipline_records
  FOR DELETE TO authenticated
  USING (
    school_id = public.user_school_id()
    AND (
      public.user_role() = 'principal'
      OR (
        public.user_role() = 'deputy'
        AND recorded_by = (
          SELECT id FROM staff
          WHERE auth_user_id = auth.uid() AND school_id = public.user_school_id()
        )
      )
    )
  );
