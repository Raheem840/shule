# SHULE — Database Schema (Ground Truth)
# READ THIS FILE BEFORE WRITING ANY SUPABASE QUERY.
# Never query a column not listed here. If a column is missing from the DB,
# write `// DB NEEDS: ALTER TABLE x ADD COLUMN y` and use optional chaining.

---

## school_profile
id, school_name, short_name, logo_url, motto, primary_color, curriculum,
deployment_mode, created_at

**NOT in schema:** currency, timezone, address

---

## staff
id, school_id, auth_user_id, staff_number, first_name, last_name, role,
department_id, subjects (text[]), classes (uuid[]), qualification_level,
employment_type, salary_band, photo_url, is_active, created_at, join_date,
email, phone, national_id, address, employment_date

**NOT in schema:** qualification_title, institution, graduation_year,
last_login_at, date_of_birth, gender

---

## students
id, school_id, admission_number, first_name, last_name, dob, gender,
class_id, stream_id, photo_url, medical_notes, status, enrolled_at

**NOT in schema:** academic_year_id, nationality, religion, student_type,
previous_school

---

## student_guardians
id, school_id, student_id, guardian_name, relationship, phone, email, do_not_contact

---

## classes
id, school_id, name, level, academic_year_id

---

## streams
id, school_id, class_id, name, class_teacher_id

---

## departments
id, school_id, name, accent_color, head_teacher_id, archived

---

## academic_years
id, school_id, label, name (generated alias of label), start_date, end_date,
term1_start, term1_end, term2_start, term2_end, term3_start, term3_end,
is_active, survey_active, created_at

---

## subjects
id, school_id, name, curriculum_code, level

**NOT in schema:** is_active

---

## exam_journal
id, school_id, teacher_id, subject_id, class_id, stream_id,
assessment_type, name, date, total_marks, pass_mark, term, year,
notes, learning_area, competency, integration_theme, trade_area,
dit_module_code, ca_component, ca_weighting, ca_label

---

## exam_results
id, school_id, exam_journal_id, student_id, subject_id, score, grade, term, year, teacher_id

**NOT in schema:** is_absent

---

## attendance
id, school_id, student_id, class_id, date, status, recorded_by

---

## fee_structure
id, school_id, name, amount, applies_to, term, year

---

## fee_payments
id, school_id, student_id, fee_type_id, amount_due, amount_paid,
balance, payment_date, receipt_number, term, year, notes, imported

**NOT in schema:** amount, status
**Status computed client-side:**
  amount_paid >= amount_due → 'paid'
  amount_paid === 0         → 'unpaid'
  else                      → 'partial'

---

## report_cards
id, school_id, student_id, term, year, status, principal_remarks,
generated_at, approved_at, released_at, pdf_url

**NOT in schema:** unlock_reason, approved_by, released_by, unlock_count

---

## teacher_remarks
id, school_id, student_id, teacher_id, term, year, remarks

---

## messages
id, school_id, from_user_id, to_user_id, body, attachment_url, sent_at, read_at

---

## notifications
id, school_id, user_id, type, body, read, created_at, link, read_at,
from_user, target_role, title

---

## discipline_records
id, school_id, student_id, recorded_by, incident_date, nature,
resolution, created_at, updated_at, class_id, notes

---

## audit_log
id, school_id, user_id, role, action, table_name, record_id,
old_value, new_value, created_at

Note: old_data / new_data are generated aliases for old_value / new_value — both work.

---

## curriculum_plan
id, school_id, subject_id, class_id, term, year, topic,
expected_date, covered, covered_at, covered_by

---

## sms_reminders
id, school_id, student_id, parent_phone, channel, message, status, sent_at, delivered_at

---

## send_queue
id, school_id, type, payload, status, queued_at, sent_at

---

## sync_queue
id, school_id, action_type, table_name, record_id, payload, status, created_at, synced_at

---

## parent_accounts
id, school_id, email, student_ids (uuid[]), created_by, created_at

**NOT in schema:** full_name, phone, auth_user_id, temp_password, student_id
