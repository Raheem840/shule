# SHULE — Database Schema (Ground Truth)
# Audited: 2026-05-28 | RLS policies applied: 2026-06-02
# This file is the single source of truth. Never query a column not listed here.

---

## RLS Helper Functions (created 2026-06-02)

Run once in Supabase SQL Editor (already done):

```sql
-- Returns the user_role claim from the JWT (checks both top-level and app_metadata)
CREATE OR REPLACE FUNCTION public.user_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'user_role', auth.jwt() -> 'app_metadata' ->> 'user_role')
$$;

-- Returns the school_id claim from the JWT as uuid
CREATE OR REPLACE FUNCTION public.user_school_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'school_id', auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
$$;
```

All RLS policies use these two functions. The JWT claims are set by the custom
access-token hook in AuthContext.tsx which reads `user_role` and `school_id` from
`app_metadata` on every sign-in.

---

## Edge Functions (supabase/functions/)

| Function | Purpose | Auth required |
|---|---|---|
| `create-staff-auth-user` | Creates Supabase Auth user + sets staff.auth_user_id | secretary, principal, it_admin |
| `create-student-auth-user` | Creates Supabase Auth user + sets students.auth_user_id | secretary, principal, it_admin |
| `create-parent-auth-user` | Creates Supabase Auth user + sets parent_accounts.auth_user_id | secretary, principal, it_admin |
| `reset-staff-password` | Resets password via service role | it_admin, principal |
| `reset-student-password` | Resets student password via service role | secretary, it_admin, principal |
| `reset-parent-password` | Resets parent password, persists new temp_password to DB | secretary, it_admin, principal |
| `send-sms` | Africa's Talking SMS delivery | any authenticated |
| `send-whatsapp` | WhatsApp message delivery | any authenticated |
| `broadcast-announcement` | Sends announcement to multiple users | secretary, principal |
| `upload-staff-photo` | Stores photo to staff-photos bucket | all staff roles |

Default initial password for created accounts: **`Shule@2025`** (staff) / **`Parent@2025`** (parents)

Student login email format: `{firstInit}{lastInit}{numericAdmSeq}@{schoolShortName}.ug`
(e.g., admission KJA/2025/0049 → `na49@stmarys.ug` for Nakato Aisha)

---

## academic_years | RLS: ON
id, school_id, label, name, start_date, end_date,
term1_start, term1_end, term2_start, term2_end, term3_start, term3_end,
is_active (bool), survey_active (bool), created_at

---

## attendance | RLS: ON
id, school_id, student_id, class_id, recorded_by,
date, status, notes, created_at

---

## audit_log | RLS: ON
id, school_id, user_id, role, action, table_name, record_id,
entity_name, old_value, new_value, old_data, new_data, created_at

---

## classes | RLS: ON
id, school_id, academic_year_id (required), name, level, created_at

---

## curriculum_plan | RLS: ON
id, school_id, subject_id, class_id, term (text), year (int),
topic, expected_date, covered (bool), covered_at, covered_by, created_at, updated_at

---

## departments | RLS: ON
id, school_id, name, description, accent_color, head_teacher_id,
archived (bool), created_at

---

## discipline_records | RLS: ON
id, school_id, student_id, class_id, recorded_by,
incident_date, nature, resolution, notes, created_at, updated_at

---

## error_log | RLS: ON (deny all school JWTs)
id, school_id, school_name, error_type, error_message,
severity, status, resolved_by, resolution_notes, created_at

---

## exam_journal | RLS: ON
id, school_id, teacher_id, subject_id, class_id, stream_id, academic_year_id,
assessment_type, name, term (text), year (int), total_marks, pass_mark,
**date_given** ← NOT 'date',
**teacher_notes** ← NOT 'notes',
status ('draft'|'published'),
ca_label, ca_component, ca_weighting,
learning_area, competency, integration_theme, trade_area, dit_module_code,
created_at

---

## exam_results | RLS: ON
id, school_id, exam_journal_id, student_id, teacher_id, subject_id,
term (text), year (int), score, grade, is_absent (bool), remarks,
created_at, updated_at

---

## fee_payments | RLS: ON
id, school_id, student_id,
**fee_structure_id** ← NOT 'fee_type_id',
academic_year_id, term (int 1/2/3), amount_due, amount_paid (DEFAULT 0),
balance, payment_date, receipt_number, notes, imported (bool),
created_by, created_at, updated_at

**NO 'amount' column. NO 'status' column — compute from amounts.**
Status: balance <= 0 → 'paid' | amount_paid > 0 → 'partial' | else → 'unpaid'

---

## fee_structure | RLS: ON
id, school_id, name, amount, applies_to, term (int), academic_year_id,
is_active (bool), created_at

---

## messages | RLS: ON
id, school_id, from_user_id, to_user_id,
is_announcement (bool),
body, attachment_url, attachment_name, attachment_type,
sent_at, read_at

Filter announcements: `.eq('is_announcement', true)`
Filter DMs: `.eq('is_announcement', false)`

---

## notifications | RLS: ON
id, school_id, user_id, type, title, body, read (bool),
read_at, link, from_user, target_role, created_at

---

## parent_accounts | RLS: ON ✅ (policies applied 2026-06-02)
id, school_id, auth_user_id, email, full_name, phone,
student_ids (uuid[]), temp_password, created_by, created_at, updated_at

RLS policies:
- SELECT: any authenticated user from same school
- INSERT | UPDATE: secretary | principal | it_admin

---

## report_cards | RLS: ON
id, school_id, student_id,
**term (TEXT)** ← NOT integer,
year (int), status ('draft'|'ready'|'approved'|'released'),
principal_remarks, generated_at, approved_at, approved_by,
released_at, released_by, pdf_url,
unlock_reason, unlock_count (int DEFAULT 0),
created_at, updated_at

---

## school_events | RLS: ON
id, school_id, title, event_date, event_type, description,
subject_id, class_id, stream_id, total_marks, pass_mark,
journaled (bool), journal_id, term (text), year (int),
created_by, created_at

---

## school_profile | RLS: OFF (readable by all authenticated)
id, school_name, short_name, logo_url, motto, primary_color,
curriculum, deployment_mode, currency,
**at_api_key, at_username, at_sender_id** ← use these for Africa's Talking,
sms_api_key, sms_username, sms_sender_id, sms_environment,
wa_phone_number_id, wa_access_token, wa_business_account_id,
report_template_url, timezone, language, created_at

---

## school_registry | RLS: ON (deny all school JWTs — service_role only)
id, school_id, contact_name, contact_email, contact_phone,
deployment_type, status, installation_notes,
assigned_team_member, cloud_backup_enabled, last_seen_at, created_at

---

## send_queue | RLS: ON
id, school_id, type, payload (jsonb), status,
attempts (int DEFAULT 0), last_attempted_at, queued_at, sent_at

Insert format: `{ school_id, type: channel, payload: { to, message, student_id }, status: 'pending' }`

---

## sms_reminders | RLS: ON
id, school_id, student_id, parent_phone, channel, message,
status, sent_at, delivered_at, created_at

---

## staff | RLS: ON ✅ (policies applied 2026-06-02)
id, school_id, auth_user_id, staff_number, first_name, last_name, role,
department_id, subjects (text[]), classes (uuid[]),
qualification_level, qualification_title, institution, graduation_year,
employment_type, employment_date, join_date,
photo_url, is_active (bool DEFAULT true),
email, phone, national_id, address, date_of_birth, gender,
last_login_at, created_at

**NOTE: `salary_band` column exists in DB but is NOT used in the application.
Do NOT query or display it. Salary data is out of scope for the current build.**

RLS policies:
- SELECT: any authenticated user from same school
- INSERT: secretary | principal | it_admin
- UPDATE: secretary | principal | it_admin
- DELETE: principal | it_admin

---

## staff_documents | RLS: ON
id, school_id, staff_id, doc_type, file_url, file_name, uploaded_by, uploaded_at

---

## streams | RLS: ON
id, school_id, class_id, name, class_teacher_id, created_at

---

## student_guardians | RLS: ON ✅ (policies applied 2026-06-02)
id, school_id, student_id,
**full_name** ← NOT 'guardian_name',
relationship, phone, email,
do_not_contact (bool), comms_preference ('sms'|'whatsapp'|'both'), is_primary (bool),
created_at

RLS policies:
- SELECT: any authenticated user from same school
- INSERT | UPDATE | DELETE: secretary | principal | it_admin

---

## student_surveys | RLS: ON  ← PRIMARY survey table
id, school_id, student_id, academic_year_id, term (text), year (int),
rating (1–5), hardest_subject_id, favourite_subject_id,
teacher_rating (1–5), suggestions, submitted_at

---

## students | RLS: ON ✅ (policies applied 2026-06-02)
id, school_id, class_id, stream_id, academic_year_id, admission_number,
first_name, last_name, dob, gender, nationality (DEFAULT 'Ugandan'),
religion, photo_url, medical_notes, student_type ('day'|'boarder'),
previous_school, status ('active'|'suspended'|'expelled'),
auth_user_id, enrolled_at, created_by, created_at, updated_at

RLS policies:
- SELECT: any authenticated user from same school
- INSERT: secretary | principal | it_admin
- UPDATE: secretary | principal | it_admin | class_teacher
- DELETE: principal | it_admin

---

## subjects | RLS: ON
id, school_id, department_id, name, curriculum_code,
level, is_active (bool DEFAULT true), created_at

Join for department name: `.select('id, name, curriculum_code, level, is_active, departments(name, accent_color)')`

---

## survey_responses | RLS: ON  ← simpler secondary table, prefer student_surveys
id, school_id, student_id, academic_year_id, term (int), rating,
enjoyed, improve, submitted_at

---

## sync_queue | RLS: ON
id, school_id, action_type, table_name, record_id, payload (jsonb),
status, created_at, synced_at

---

## teacher_remarks | RLS: ON
id, school_id, student_id, teacher_id, term (text), year (int),
remarks, created_at, updated_at

---

## timetable_slots | RLS: ON
id, school_id, class_id, stream_id, subject_id, teacher_id,
day_of_week (int 1–5), period_number (int),
start_time (time), end_time (time),
term (text), year (int), is_published (bool DEFAULT false)
