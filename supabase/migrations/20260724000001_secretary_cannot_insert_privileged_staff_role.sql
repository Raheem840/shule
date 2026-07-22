-- Found during a manual account-management audit: "staff_insert_secretary"
-- (00003_rls_policies.sql) lets secretary/principal/it_admin all INSERT into
-- staff with the exact same WITH CHECK — no restriction on the *value* of
-- the inserted role column. Every UI surface a secretary actually uses
-- (StaffRegistrationWizard's STAFF_ROLES, and this week's fix to
-- ImportDataPage's CSV import) already excludes 'principal'/'it_admin' from
-- what a secretary can create — but that was only enforced client-side.
-- Nothing stopped a secretary from calling
-- `supabase.from('staff').insert({ role: 'principal', ... })` directly
-- (e.g. via browser devtools) and having it succeed at the DB level, since
-- RLS is supposed to be the real enforcement boundary per CLAUDE.md's
-- Non-Negotiables, not the UI. Principal/it_admin still need to be able to
-- insert ANY role (e.g. IT Admin's CreateUserWizard legitimately creates
-- other principals/it_admins), so the restriction is conditional on the
-- caller's own role, not a blanket removal.
DROP POLICY IF EXISTS "staff_insert_secretary" ON "public"."staff";
CREATE POLICY "staff_insert_secretary" ON "public"."staff"
FOR INSERT TO "authenticated"
WITH CHECK (
  ("school_id" = "public"."user_school_id"())
  AND (
    ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))
    OR (
      "public"."user_role"() = 'secretary'::"text"
      AND "role" <> ALL (ARRAY['principal'::"text", 'it_admin'::"text"])
    )
  )
);

-- Same gap on the UPDATE side: "staff_update_admin" lets secretary/dos (as
-- well as principal/it_admin) UPDATE any column on any staff row in the
-- school, including role, with no restriction on the new value — a
-- secretary or dos could grant themselves or anyone else 'principal'/
-- 'it_admin' via a direct UPDATE call. Neither role has any legitimate UI
-- flow that sets role to principal/it_admin (dos's only role-mutating write,
-- useDos.ts's class-teacher assignment, only ever sets 'class_teacher').
DROP POLICY IF EXISTS "staff_update_admin" ON "public"."staff";
CREATE POLICY "staff_update_admin" ON "public"."staff"
FOR UPDATE TO "authenticated"
USING ("school_id" = "public"."user_school_id"())
WITH CHECK (
  ("public"."user_role"() = ANY (ARRAY['principal'::"text", 'it_admin'::"text"]))
  OR (
    ("public"."user_role"() = ANY (ARRAY['secretary'::"text", 'dos'::"text"]))
    AND "role" <> ALL (ARRAY['principal'::"text", 'it_admin'::"text"])
  )
);
