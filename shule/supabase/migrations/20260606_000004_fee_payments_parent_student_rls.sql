-- Allow parents to read fee_payments for their linked children
CREATE POLICY "fee_payments: parent can view own child"
ON "public"."fee_payments" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND student_id IN (
    SELECT unnest(student_ids)
    FROM public.parent_accounts
    WHERE school_id = public.auth_school_id()
      AND auth_user_id = auth.uid()
  )
);

-- Allow students to read their own fee_payments
CREATE POLICY "fee_payments: student can view own"
ON "public"."fee_payments" FOR SELECT
USING (
  school_id = public.auth_school_id()
  AND student_id = (
    SELECT id FROM public.students
    WHERE school_id = public.auth_school_id()
      AND auth_user_id = auth.uid()
    LIMIT 1
  )
);
