-- Closes the "fee payment de-duplication has a NULL-value gap" limitation:
-- fee_payments_struct_student_term_idx only enforces uniqueness on
-- (student_id, fee_structure_id, term, academic_year_id) WHERE fee_structure_id
-- IS NOT NULL — a general/manual payment (fee_structure_id null, e.g. from
-- BursarImportPage's "leave blank for a general/manual payment" column, or
-- useAddPayment's own null-fee_structure_id branch) had zero DB-level
-- protection. Both the import's pre-fetch dedupe and useAddPayment's
-- check-then-insert are check-then-act races without a constraint backing
-- them — two concurrent imports/adds could both pass the app-layer check and
-- both insert. Confirmed zero existing violations live before adding this.
create unique index fee_payments_null_struct_student_term_idx
on fee_payments (student_id, term, academic_year_id)
where fee_structure_id is null;
