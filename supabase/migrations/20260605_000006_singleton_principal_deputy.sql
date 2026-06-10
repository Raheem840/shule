-- Enforce one principal and one deputy per school at the database level.
-- Uses partial unique indexes so the constraint only applies to active staff.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_principal_per_school
  ON public.staff(school_id)
  WHERE role = 'principal' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_deputy_per_school
  ON public.staff(school_id)
  WHERE role = 'deputy' AND is_active = true;
