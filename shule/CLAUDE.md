# CLAUDE.md — Shule Project Memory

> Living brain. Update after every session. Full session history → `src/docs/SESSION_ARCHIVE.md`.

---

## Project: Shule — School Management System
Complete offline-capable school management platform for secondary schools in Uganda.
A real school is waiting. Bursar fee records, teacher exam marks, parent report card access.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + custom CSS tokens |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + custom JWT hook |
| Offline | IndexedDB via Dexie.js |
| PDF | jsPDF + jspdf-autotable |
| Charts | Recharts |
| Excel | ExcelJS |
| SMS | Africa's Talking API |
| Icons | Inline SVG ONLY |
| Fonts | Plus Jakarta Sans · Space Grotesk · JetBrains Mono |

---

## Design System (Canonical)
```css
--brand: #0d9488; --brand-dark: #0f766e; --brand-light: #f0fdfa;
--bg: #f8fafc; --surface: #ffffff; --surface2: #f1f5f9;
--sidebar-bg: #0f172a; --border: #e2e8f0;
--txt: #0f172a; --txt2: #475569; --txt3: #94a3b8;
--success: #10b981; --warning: #f59e0b; --danger: #f43f5e;
--info: #0ea5e9; --violet: #8b5cf6;
/* Dark: --bg: #070d1a; --brand: #0dd9c4; data-theme="dark" on .ar */
```
Radius: 6px badges · 10px inputs · 14px cards · 20px modals.
CSS class system: `sui-kpi-v2`, `sui-glass-card`, `sui-glass-panel`, `sui-tab-list-pill`,
`sui-page-enter`, `stagger-cards`, `sui-modal-dialog`, `gradient-text`.

---

## Storage Buckets (Supabase Storage)
All storage calls go through `src/lib/storage.ts`. No direct `supabase.storage` in components.

| Bucket | Public | Used for |
|--------|--------|---------|
| `staff-photos` | ✅ | Staff avatars — full public URL stored in `staff.photo_url` |
| `student-photos` | 🔒 | Student photos — **path** stored in `students.photo_url`, signed URLs for display |
| `documents` | 🔒 | Staff NIN / transcripts / certs — path in `staff_documents.file_url` |
| `report-cards` | ✅ | Generated PDFs — public URL stored in `report_cards.pdf_url` |
| `templates` | 🔒 | School report card templates |
| `staff-attachments` | ✅ | Message file attachments |

---

## The 9 User Roles
| Role | Finance | Create Students |
|------|---------|----------------|
| principal | Summary only | Yes |
| deputy | ZERO — hard block | No |
| dos | ZERO — hard block | No |
| secretary | Status flag only | Yes (primary) |
| bursar | Full ledger+salary | No |
| class_teacher / teacher | ZERO | No |
| student | Own fees only | No |
| parent | Child fees only | No |

Finance boundary: enforced at BOTH route guard AND Supabase RLS.

---

## CBC Grade Formula
```
max_points = assessed × 3
out_of_20  = (total_points / max_points) × 20
total      = out_of_20 + exam_out_of_80
A=80-100  B=70-79  C=60-69  D=50-59  E=0-49   ← UNEB official boundaries
```

---

## Folder Structure
```
src/
├── components/ui/          # Button, Input, Modal, Badge, DataTable…
├── components/layout/      # AppShell, Sidebar, TopBar, ProtectedRoute
├── components/shared/      # InitialsAvatar, Avatar, TermProgressTimeline, ImportWizard…
├── pages/{role}/           # One folder per role
├── pages/shared/           # ProfilePage, MessagingPage
├── hooks/                  # All DB ops — never raw supabase in pages
├── lib/                    # supabase.ts, queryClient.ts, storage.ts, db.ts, syncQueue.ts
├── types/                  # app.ts (custom), week9.ts
├── store/                  # AuthContext.tsx, BandwidthContext.tsx
└── docs/                   # THINKING.md, SESSION_ARCHIVE.md, DB_SCHEMA.md
```

---

## Definitive DB Schema (audited 2026-05-28)

```
TABLE: academic_years | RLS: ON
id, school_id, label, name, start_date, end_date,
term1_start, term1_end, term2_start, term2_end, term3_start, term3_end,
is_active(bool), survey_active(bool), created_at

TABLE: attendance | RLS: ON
id, school_id, student_id, class_id, recorded_by,
date, status, notes, created_at

TABLE: audit_log | RLS: ON
id, school_id, user_id, role, action, table_name, record_id,
entity_name, old_value, new_value, old_data, new_data, created_at

TABLE: classes | RLS: ON
id, school_id, academic_year_id(required), name, level, created_at

TABLE: curriculum_plan | RLS: ON
id, school_id, subject_id, class_id, term(text), year(int),
topic, expected_date, covered(bool), covered_at, covered_by, created_at, updated_at

TABLE: departments | RLS: ON
id, school_id, name, description, accent_color, head_teacher_id,
archived(bool), created_at

TABLE: discipline_records | RLS: ON
id, school_id, student_id, class_id, recorded_by,
incident_date, nature, resolution, notes, created_at, updated_at

TABLE: exam_journal | RLS: ON
id, school_id, teacher_id, subject_id, class_id, stream_id, academic_year_id,
assessment_type, name, term(text), year(int), total_marks, pass_mark,
date_given *** NOT 'date' ***,
teacher_notes *** NOT 'notes' ***,
status('draft'|'published'),
ca_label, ca_component, ca_weighting, learning_area, competency,
integration_theme, trade_area, dit_module_code, created_at

TABLE: exam_results | RLS: ON
id, school_id, exam_journal_id, student_id, teacher_id, subject_id,
term(text), year(int), score, grade, is_absent(bool), remarks, created_at, updated_at

TABLE: fee_payments | RLS: ON
id, school_id, student_id,
fee_structure_id *** NOT 'fee_type_id' ***,
academic_year_id, term(int 1/2/3), amount_due, amount_paid(DEFAULT 0),
balance, payment_date, receipt_number, notes, imported(bool),
created_by, created_at, updated_at

TABLE: fee_structure | RLS: ON
id, school_id, name, amount, applies_to, term(int), academic_year_id,
is_active(bool), is_compulsory(bool DEFAULT true), class_id(uuid nullable), created_at
-- fee_payments has NO year column — academic_year_id is the year reference

TABLE: messages | RLS: ON
id, school_id, from_user_id, to_user_id, is_announcement(bool),
body, attachment_url, attachment_name, attachment_type, sent_at, read_at

TABLE: notifications | RLS: ON
id, school_id, user_id, type, title, body, read(bool),
read_at, link, from_user, target_role, created_at

TABLE: parent_accounts | RLS: ON
id, school_id, auth_user_id, email, full_name, phone,
student_ids(uuid[]), temp_password, created_by, created_at, updated_at

TABLE: report_cards | RLS: ON
id, school_id, student_id,
term(TEXT) *** NOT integer ***,
year(int), status, principal_remarks,
generated_at, approved_at, approved_by, released_at, released_by,
pdf_url, unlock_reason, unlock_count(int DEFAULT 0), created_at, updated_at

TABLE: school_events | RLS: ON
id, school_id, title, event_date, event_type, description,
subject_id, class_id, stream_id, total_marks, pass_mark,
journaled(bool), journal_id, term(text), year(int), created_by, created_at,
visible_to_parents(bool DEFAULT false) *** column name is visible_to_parents — NOT viewable_by_parents ***

TABLE: school_profile | RLS: OFF (readable by all)
id, school_name, short_name, logo_url, motto, primary_color,
curriculum, deployment_mode, currency,
at_api_key, at_username, at_sender_id *** use these for Africa's Talking ***,
sms_api_key, sms_username, sms_sender_id, sms_environment,
wa_phone_number_id, wa_access_token, wa_business_account_id,
report_template_url, timezone, language,
parent_portal_open(bool NOT NULL DEFAULT true) *** controls parent portal access — toggled by IT admin + principal ***,
created_at

TABLE: school_registry | RLS: ON (deny all school JWTs)
id, school_id, contact_name, contact_email, contact_phone,
deployment_type, status, installation_notes,
assigned_team_member, cloud_backup_enabled, last_seen_at, created_at

TABLE: send_queue | RLS: ON
id, school_id, type, payload(jsonb), status,
attempts(int DEFAULT 0), last_attempted_at, queued_at, sent_at

TABLE: sms_reminders | RLS: ON
id, school_id, student_id, parent_phone, channel, message,
status, sent_at, delivered_at, created_at

TABLE: staff | RLS: OFF ⚠ MUST ENABLE — see useStaff.ts for SQL
-- staff_number auto-generated as {short_name}/STAFF/{seq} by trg_gen_staff_number when blank on INSERT
id, school_id, auth_user_id, staff_number, first_name, last_name, role,
department_id, subjects(text[]), classes(uuid[]),
qualification_level, qualification_title, institution, graduation_year,
employment_type, employment_date, join_date,
photo_url, is_active(bool DEFAULT true),
email, phone, national_id, address, date_of_birth, gender, last_login_at,
temp_password(text) *** last issued password — stored by create-staff-auth-user + reset-staff-password edge fns ***,
created_at

TABLE: staff_documents | RLS: ON
id, school_id, staff_id, doc_type, file_url, file_name, uploaded_by, uploaded_at

TABLE: streams | RLS: ON
id, school_id, class_id, name, class_teacher_id, created_at

TABLE: student_guardians | RLS: ON
id, school_id, student_id,
full_name *** NOT 'guardian_name' ***,
relationship, phone, email, do_not_contact(bool),
comms_preference('sms'|'whatsapp'|'both'), is_primary(bool), created_at

TABLE: student_surveys | RLS: ON  (PRIMARY survey table)
id, school_id, student_id, academic_year_id, term(text), year(int),
rating(1-5), hardest_subject_id, favourite_subject_id,
teacher_rating(1-5), suggestions, submitted_at

TABLE: students | RLS: ON
-- admission_number auto-generated as {short_name}/{YYYY}/{seq} by trg_gen_admission_number when blank on INSERT
id, school_id, class_id, stream_id, academic_year_id, admission_number,
first_name, last_name, dob, gender, nationality(DEFAULT 'Ugandan'),
religion, photo_url, medical_notes, student_type('day'|'boarder'),
previous_school, status('active'|'suspended'|'expelled'),
auth_user_id,
auth_email(text) *** exact email used in Supabase auth — stored by create-student-auth-user ***,
temp_password(text) *** last issued password — stored by create-student-auth-user + reset-student-password ***,
enrolled_at, created_by, created_at, updated_at

TABLE: subjects | RLS: ON
id, school_id, department_id, name, curriculum_code,
level, is_active(bool DEFAULT true), created_at

TABLE: survey_responses | RLS: ON  (simpler secondary table — prefer student_surveys)
id, school_id, student_id, academic_year_id, term(int), rating,
enjoyed, improve, submitted_at

TABLE: sync_queue | RLS: ON
id, school_id, action_type, table_name, record_id, payload(jsonb),
status, created_at, synced_at

TABLE: teacher_remarks | RLS: ON
id, school_id, student_id, teacher_id, term(text), year(int),
remarks, created_at, updated_at

TABLE: timetable_slots | RLS: ON
id, school_id, class_id, stream_id, subject_id, teacher_id,
day_of_week(int 1-5), period_number(int), start_time(time), end_time(time),
term(text), year(int), is_published(bool DEFAULT false)
```

---

## What's Built (Session 013 baseline)
- [x] Full auth system: JWT hook, AuthContext, ProtectedRoute, role routing
- [x] AppShell: dark sidebar, theme toggle, NotificationBell, MessagingIcon, OfflineBanner
- [x] All 9 role dashboards + complete page sets for each role
- [x] Secretary: student/staff registration wizards, class list, parent credentials, edit pages
- [x] Bursar: fee ledger, payments, salary, delivery log, SMS reminders
- [x] Teacher: exam journal, mark entry, remarks, curriculum, timetable, events, attendance
- [x] DoS: dashboard (4 tabs), surveys, timetable (dnd-kit drag-drop)
- [x] Deputy: dashboard (3 tabs), timetable
- [x] Principal: dashboard, report cards, audit log, student/staff full profiles
- [x] Parent + Student portals (4 tabs each, survey tab conditional)
- [x] Messaging: realtime, announcements, DoS templates, attachments, offline queue
- [x] PWA: service worker, NetworkFirst/CacheFirst, offline sync queue
- [x] Report cards: generate PDF, approve, release, parent download
- [x] Admin: system KPIs, user management, school settings, templates stub
- [x] Tests: 390 passing (40 test files) — 33 pre-existing failures pending fix
- [x] Storage bucket wiring — complete (Session 013)
- [x] Test suite upgrade + MSW integration layer — complete (Session 015)
- [x] Credentials page: staff/student/parent temp_password stored + displayed (Session 018)
- [x] Teacher dashboard journal count fixed (staffId not auth UUID) — Session 018
- [x] Student portal isAbsent reads from DB — Session 018

---

## My Rules
1. Never `.select('*')` on large tables
2. No 50+ DOM rows without virtualisation
3. RLS on every table before any page goes live
4. Never `SUPABASE_SERVICE_ROLE_KEY` in frontend
5. Finance tables: bursar + principal only at DB level
6. All storage through `src/lib/storage.ts` — no direct bucket calls in components
7. Student photos: always signed URLs (private bucket) — never `getPublicUrl` on student-photos
8. Design tokens only — no hardcoded hex in components
9. TypeScript 0 errors before commit

---

## The Non-Negotiables
1. RLS on EVERY table — no exceptions
2. Finance isolation — Deputy/DoS/Teacher see zero financial data
3. Teacher cannot INSERT students — DB-level, not UI-level
4. Offline-first — writes that fail go to sync_queue
5. `school_registry`: DENY ALL for school JWTs, service_role only
6. API keys: Supabase Vault only — never .env, never frontend

---

## Session Log

### Session 015 — Rigorous Test Suite Upgrade (Complete)
**Date:** 2026-05-28

**Part 1 — Two real hook bugs fixed:**
- `useExamResults.ts`: `is_absent` added to `RESULT_COLS`; mapper reads from DB instead of hardcoding `false`
- `useReportCards.ts`: filter type `term: number → string`; added 7 missing columns to `RC_COLS` (`approved_at/by`, `released_at/by`, `unlock_reason`, `unlock_count`, `pdf_url`); wired `approved_by`/`released_by` in `useUpdateStatus`; upsert `term: String(term)`

**Part 2 — Stale test data fixed:** All `term: 1` → `term: '1'` in `useReportCards.test.tsx`

**Part 3 — Shared mock helper:** `src/test/helpers/makeSupabaseMock.ts`

**Part 4 — 11 new hook test files (79 new tests):**
`useClasses`, `useStudentPortal`, `useTermProgress`, `useTimetableSlots`, `useTeacherEvents`, `useProfile`, `useSignedUrl`, `useStaffAuth`, `useSecretaryBriefing`, `useParentPortal`, `usePrincipal`

**Part 5 — Schema boundary assertions** added to 5 existing test files; verify correct column names via mapper output (not SELECT string — `mockFrom.mock.calls` only captures table name, not chain)

**Part 6 — CBC grade unit tests** verified (A=80 boundary correct)

**Part 7 — MSW integration layer:**
- `src/test/mocks/server.ts` + `handlers.ts` (5 handlers with schema-correct column names)
- `src/test/setup.ts` wired with `server.listen/resetHandlers/close`
- `.env.test` with `VITE_SUPABASE_URL=http://test.supabase.co`
- `src/test/integration/schemaColumns.integration.test.ts` — 5 tests capturing real fetch URLs

**Part 8 — Coverage thresholds:** `vite.config.ts` coverage block (v8, lines:65%, functions:60%, branches:50%, statements:65%)

**Schema violations fixed in pages:**
- `BursarImportPage.tsx`: rewrote import to use correct columns (`student_id` lookup by admission_number, `amount_due`/`amount_paid`/`balance`/`receipt_number`, removed `payment_method`/`admission_number` from insert)
- `ParentCredentialsPage.tsx`: SELECT now fetches `full_name, phone, auth_user_id, temp_password`; insert now writes all 4 columns; removed all "DB NEEDS" stubs

**Tests: 423 passing (39 test files, 0 TS errors)**

### Session 014 — Schema Alignment (Complete)
**Date:** 2026-05-28

- Replaced schema reference section in CLAUDE.md with audited live DB schema
- `exam_journal`: `date` → `date_given`, `notes` → `teacher_notes` throughout codebase
- `fee_payments`: `fee_type_id` → `fee_structure_id` throughout codebase
- `student_guardians`: `guardian_name` → `full_name` throughout codebase
- `report_cards.term`: fixed to `string` (was `number`) in type + hook
- `messages`: added `is_announcement`, `attachment_name`, `attachment_type` fields
- `student_surveys`: switched survey hook from `survey_responses` → `student_surveys`
- `send_queue`: fixed insert to use `type + payload(jsonb)` schema
- Added `StudentSurvey`, `departmentId` on `Subject`, `unlockCount` on `ReportCard` types
- Removed all "DB NEEDS" stubs for columns that now exist
- Added RLS security warning comment to `useStaff.ts`
- CBC grade scale was already correct (A=80); fixed CLAUDE.md comment that said A=90
- Tests: 344 passing (0 errors)

### Session 013 — Storage Bucket Wiring
**Date:** 2026-05-28

- `.gitignore`: added `.claude/` and `supabase/.temp/`
- `git rm --cached .claude/settings.local.json` — untracked from remote
- `CLAUDE.md`: trimmed; sessions 001-012 archived to `src/docs/SESSION_ARCHIVE.md`
- Created: `src/lib/storage.ts`, `src/lib/fileValidation.ts`, `src/hooks/useSignedUrl.ts`, `src/components/shared/Avatar.tsx`
- Fixed: all photo display across the app (student-photos → signed URLs, staff-photos → public URL)
- Fixed: `StaffRegistrationWizard` document bucket `staff-documents` → `documents`
- Fixed: `StudentRegistrationWizard` student photo stored as path (not full URL)
- Wired: `TemplatesPage.tsx` — real upload UI against `templates` bucket
