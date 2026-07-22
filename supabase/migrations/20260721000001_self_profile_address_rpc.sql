-- Root cause of "Failed to load profile" (403 on the ProfilePage GET):
-- migration 20260720_000003 revoked table-wide SELECT on staff and granted
-- back only a safe column list — address was left out on the assumption
-- that "nothing in the app renders these fields." That assumption missed
-- useProfile.ts's useMyProfile, which every role uses to view/edit their
-- OWN address on /profile. Column-level GRANT has no row scoping, so we
-- can't re-grant "address, but only your own row" directly — the fix is
-- the SECURITY DEFINER RPC pattern the prior migration itself recommended,
-- scoped to auth.uid()'s own staff row only.
--
-- Same problem exists one level deeper for the UPDATE side: the only staff
-- UPDATE policy (staff_update_admin) restricts WITH CHECK to
-- principal/secretary/it_admin/dos — a teacher/bursar/etc. editing their
-- own phone/email/address on this same page has never been able to save
-- (pre-existing, unrelated to the 20260720 migration). Fixed the same way:
-- a SECURITY DEFINER RPC scoped to the caller's own row, rather than
-- widening the general UPDATE policy (which would let any staff member
-- edit any column on their own row, including role/is_active).

CREATE OR REPLACE FUNCTION public.get_my_staff_address()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT address FROM staff WHERE auth_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_address() TO authenticated;

-- Sentinel default distinguishes "argument omitted → leave column
-- unchanged" from "argument explicitly NULL → clear the column" —
-- mirrors the partial-update semantics useProfile.ts already builds
-- client-side (only changed fields are included in the call).
CREATE OR REPLACE FUNCTION public.update_my_staff_contact(
  p_phone   text DEFAULT '__no_change__',
  p_email   text DEFAULT '__no_change__',
  p_address text DEFAULT '__no_change__'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE staff SET
    phone   = CASE WHEN p_phone   = '__no_change__' THEN phone   ELSE p_phone   END,
    email   = CASE WHEN p_email   = '__no_change__' THEN email   ELSE p_email   END,
    address = CASE WHEN p_address = '__no_change__' THEN address ELSE p_address END
  WHERE auth_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff record not found for current user';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_staff_contact(text, text, text) TO authenticated;
