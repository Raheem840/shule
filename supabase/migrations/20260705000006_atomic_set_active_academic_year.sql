-- useSetActiveYear (src/pages/principal/AcademicYearPage.tsx) previously did two
-- separate, sequential update() calls from the client: deactivate all years, then
-- activate the target year. This was not atomic (two network round trips, no
-- transaction) and the first call's error was never even read — if it failed
-- silently, the second call still ran and the school could end up with two
-- active years; if the second call failed after the first succeeded, the school
-- could end up with zero active years. A single UPDATE statement using a CASE
-- expression sets is_active for every row in one atomic operation, exposed as
-- an RPC so the client makes exactly one call and any failure aborts the whole
-- operation with a normal error the UI already handles.
CREATE OR REPLACE FUNCTION set_active_academic_year(p_school_id uuid, p_year_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE academic_years
  SET is_active = (id = p_year_id)
  WHERE school_id = p_school_id;
END;
$$;
