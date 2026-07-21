-- Batch fix for Medium findings M2, M3, M4, M5, M6 (docs/audit-findings-2026-07-21.md).

-- M2: student_surveys INSERT had no student_id ownership check — any
-- authenticated user could submit a survey response impersonating an
-- arbitrary student.
DROP POLICY IF EXISTS "student_submits_own_survey" ON "public"."student_surveys";
CREATE POLICY "student_submits_own_survey" ON "public"."student_surveys" FOR INSERT TO "authenticated"
  WITH CHECK (
    "school_id" = "public"."user_school_id"()
    AND "public"."user_role"() = 'student'
    AND "student_id" = (SELECT "id" FROM "public"."students" WHERE "auth_user_id" = "auth"."uid"())
  );

-- M3: custom_access_token_hook only checked staff.is_active — an expelled
-- or suspended student kept a fully working session.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id     UUID;
  v_role        TEXT;
  v_school_id   UUID;
  v_staff_id    TEXT;
  v_name        TEXT;
  v_student_ids UUID[];
  v_is_active   BOOLEAN;
  v_status      TEXT;
BEGIN
  v_user_id := (event->>'user_id')::uuid;

  SELECT s.role::text, s.school_id, s.id::text,
         (s.first_name || ' ' || s.last_name), s.is_active
  INTO   v_role, v_school_id, v_staff_id, v_name, v_is_active
  FROM   public.staff s
  WHERE  s.auth_user_id = v_user_id
  LIMIT  1;

  IF v_role IS NOT NULL AND v_is_active = false THEN
    event := jsonb_set(event, '{claims,account_status}', to_jsonb('deactivated'::text));
    RETURN event;
  END IF;

  IF v_role IS NULL THEN
    SELECT 'student', st.school_id, NULL, (st.first_name || ' ' || st.last_name), st.status
    INTO   v_role, v_school_id, v_staff_id, v_name, v_status
    FROM   public.students st
    WHERE  st.auth_user_id = v_user_id
    LIMIT  1;

    IF v_role IS NOT NULL AND v_status IN ('suspended', 'expelled') THEN
      event := jsonb_set(event, '{claims,account_status}', to_jsonb('deactivated'::text));
      RETURN event;
    END IF;
  END IF;

  IF v_role IS NULL THEN
    SELECT 'parent', pa.school_id, NULL, pa.full_name, pa.student_ids
    INTO   v_role, v_school_id, v_staff_id, v_name, v_student_ids
    FROM   public.parent_accounts pa
    WHERE  pa.auth_user_id = v_user_id
    LIMIT  1;
  END IF;

  IF v_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
    event := jsonb_set(event, '{claims,school_id}', to_jsonb(v_school_id::text));
    IF v_name IS NOT NULL THEN
      event := jsonb_set(event, '{claims,full_name}', to_jsonb(v_name));
    END IF;
    IF v_staff_id IS NOT NULL THEN
      event := jsonb_set(event, '{claims,staff_id}',  to_jsonb(v_staff_id));
    END IF;
    IF v_student_ids IS NOT NULL AND array_length(v_student_ids, 1) > 0 THEN
      event := jsonb_set(event, '{claims,student_ids}', to_jsonb(v_student_ids));
    END IF;
  END IF;

  RETURN event;
END;
$function$;

-- M4: fee_payments.receipt_number had no uniqueness guarantee — duplicate
-- or reused receipt numbers were possible within a school.
CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_school_receipt_idx
  ON public.fee_payments (school_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

-- M5/M6: templates/documents storage RLS checked role only, never
-- school_id — not exploitable under today's one-project-per-school
-- deployment, but inconsistent with every table-level policy and a real
-- cross-tenant gap if ever run multi-tenant. Both buckets are keyed
-- {school_id}/... as their first path segment (see uploadTemplate() /
-- uploadDocument() in src/lib/storage.ts) so this is a cheap tightening.
-- Also closes template_read's separate gap: it required no auth at all.
DROP POLICY IF EXISTS "template_read" ON storage.objects;
CREATE POLICY "template_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'templates'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
);

DROP POLICY IF EXISTS "template_upload" ON storage.objects;
CREATE POLICY "template_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'templates'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal']))
);

DROP POLICY IF EXISTS "template_update" ON storage.objects;
CREATE POLICY "template_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'templates'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal']))
);

DROP POLICY IF EXISTS "document_upload" ON storage.objects;
CREATE POLICY "document_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
);

DROP POLICY IF EXISTS "document_update" ON storage.objects;
CREATE POLICY "document_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
);

DROP POLICY IF EXISTS "document_delete" ON storage.objects;
CREATE POLICY "document_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = 'principal')
);

DROP POLICY IF EXISTS "document_read" ON storage.objects;
CREATE POLICY "document_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
  AND (
    ((current_setting('request.jwt.claims', true)::json ->> 'user_role') = ANY (ARRAY['it_admin', 'principal', 'secretary']))
    OR ((storage.foldername(name))[2] = (SELECT id::text FROM public.staff WHERE auth_user_id = auth.uid()))
  )
);
