# Shule — Manual Testing Order

> Test in this exact order. Each phase depends on state created by the previous phase.
> A real Supabase project with at least one school record is required before starting.

---

## Prerequisites (before any testing)

| Check | Why |
|-------|-----|
| Supabase project is live, RLS is ON for all tables | All tests depend on correct auth |
| `school_profile` row exists with a valid `id` | Every user's JWT embeds `school_id` |
| At least one active `academic_years` row (`is_active=true`) with term dates set | Fees, report cards, timetable all require this |
| Africa's Talking API key set in `school_profile.at_api_key` | SMS tests |
| Vercel deployment is live (or `npm run dev` locally) | Browser testing |

---

## Phase 1 — Auth & Role Routing

> **Dependency:** school_profile row must exist.

### 1.1 IT Admin login
- Log in with `it_admin` credentials
- Confirm redirect → `/admin/dashboard`
- Confirm sidebar shows Admin links only
- Confirm Finance pages (`/bursar/*`) return 403 or redirect

### 1.2 Role isolation smoke test (one per role)
Test each role logs in and lands on the correct dashboard:

| Role | Expected landing |
|------|-----------------|
| `principal` | `/principal/dashboard` |
| `deputy` | `/deputy/dashboard` |
| `dos` | `/dos/dashboard` |
| `secretary` | `/secretary/dashboard` |
| `bursar` | `/bursar/dashboard` |
| `teacher` | `/teacher/dashboard` |
| `class_teacher` | `/teacher/dashboard` |
| `parent` | `/parent/dashboard` |
| `student` | `/student/dashboard` |

### 1.3 Finance boundary
- Log in as `teacher` → manually navigate to `/bursar/ledger` → confirm redirect/403
- Log in as `deputy` → navigate to `/bursar/dashboard` → confirm redirect/403
- Confirm bell icon does NOT show fee data to teacher/deputy

---

## Phase 2 — IT Admin: User Management

> **Dependency:** Phase 1 complete (admin login works).

### 2.1 Create staff accounts
- Go to Admin → Users
- Create one `principal`, one `bursar`, one `secretary`, one `teacher`, one `deputy`, one `dos`
- Confirm each staff row appears in the list with a generated `staff_number`
- Confirm `temp_password` is shown in the Credentials tab
- Confirm password meets complexity (12 chars, mixed alpha+digit)

### 2.2 Reset password
- Reset password for one staff member
- Confirm new `temp_password` appears in Credentials tab
- Log in as that staff member with the new password — confirm success

### 2.3 Deactivate / reactivate
- Deactivate one staff member
- Confirm they cannot log in (Supabase returns auth error)
- Reactivate → confirm login works again

---

## Phase 3 — Secretary: Student Registration

> **Dependency:** Phase 2 complete (at least one `secretary` account exists and active academic year is set).

### 3.1 Register a student
- Log in as secretary
- Go to Students → New Student
- Complete all wizard steps: personal info, guardian, class assignment
- Confirm `admission_number` is auto-generated on save (format: `{SHORT_NAME}/{YYYY}/{seq}`)
- Confirm student photo upload works and displays correctly (signed URL)
- Confirm guardian `full_name` is saved (not `guardian_name`)

### 3.2 Create student portal credentials
- Go to Students → find the student → Create Login
- Confirm `auth_email` and `temp_password` are stored in `students` table
- Log in as that student → confirm landing on `/student/dashboard`

### 3.3 Register a parent
- Go to Parent Credentials
- Link parent to the student created in 3.1
- Confirm parent `temp_password` is stored
- Log in as parent → confirm student's data is visible (not another student's)

### 3.4 Edit student
- Edit the student's class assignment
- Confirm the change persists after page refresh

---

## Phase 4 — Academic Year Setup

> **Dependency:** Phase 2 (principal exists).

### 4.1 Create academic year
- Log in as principal
- Go to Academic Years → Create
- Set term1/term2/term3 dates
- Mark as active
- Confirm only ONE year is active (old active should auto-deactivate)

### 4.2 Term progress widget
- Visit any role dashboard that shows the term progress bar
- Confirm the correct term is detected from today's date
- Confirm the week number and days remaining are plausible

---

## Phase 5 — Teacher: Exam Journal & Mark Entry

> **Dependency:** Phase 3 (students in classes), Phase 4 (active academic year).

### 5.1 Create exam journal entry
- Log in as teacher
- Go to Exams → Create Journal Entry
- Select subject, class, assessment type
- Set `date_given` (not `date`)
- Confirm entry appears in the teacher's journal list

### 5.2 Enter marks
- Open the journal entry → Enter Marks
- Enter scores for at least 3 students
- Mark one student as absent (`is_absent = true`)
- Confirm absent student shows no score on report card

### 5.3 CBC grade calculation
- Verify a score of 80/100 = grade A (80-100 range)
- Verify a score of 50/100 = grade D (50-59 range)
- Verify formula: for CA types, `out_of_20 = (total_points / max_points) × 20`, then `total = out_of_20 + exam_out_of_80`

### 5.4 Publish exam
- Change journal status from `draft` → `published`
- Confirm students can see their results in the student portal

---

## Phase 6 — Bursar: Fee Management

> **Dependency:** Phase 3 (students registered), Phase 4 (active academic year).

### 6.1 Fee structure setup
- Log in as bursar
- Confirm dashboard shows KPIs (expected, collected, outstanding)
- Confirm a `teacher` or `deputy` who navigates to bursar dashboard sees nothing (role guard)

### 6.2 Add a payment
- Go to Ledger → find a student → Add Payment
- Enter `amount_due`, `amount_paid`, `receipt_number`, `payment_date`, `term`
- Confirm `balance = amount_due - amount_paid` (never negative)
- Confirm `academic_year_id` is set (NOT NULL) — new students must also get it

### 6.3 Inline edit payment
- Click a payment row in the ledger → edit `amount_paid` inline
- Confirm the `balance` updates correctly in the DB
- Confirm an audit_log entry is written

### 6.4 Fee import
- Download the template CSV
- Fill in 3 students by admission number
- Import the file
- Confirm all 3 rows are created with correct `fee_structure_id` (not null)

### 6.5 Parent sees fees
- Log in as parent linked to a student with payments
- Go to Fees tab
- Confirm only THAT student's fees appear (no other student's data)

---

## Phase 7 — SMS Reminders

> **Dependency:** Phase 6 (fee data exists), Africa's Talking API key configured.

### 7.1 Send reminders
- Log in as bursar
- Go to SMS Reminders
- Select 2 students with outstanding fees
- Type a message
- Click Send
- Confirm `sms_reminders` rows are written with `status='pending'` then update to `sent` or `failed`
- Confirm Africa's Talking receives the request (check AT dashboard)

### 7.2 Delivery log
- Confirm the delivery log table renders without horizontal overflow on mobile (< 375px screen)
- Confirm failed rows show a "Retry" button

---

## Phase 8 — Report Cards

> **Dependency:** Phase 5 (exam marks entered and published).

### 8.1 Generate report card
- Log in as principal or DoS
- Go to Report Cards
- Generate for a student that has marks
- Confirm PDF is generated and stored in `report-cards` bucket
- Confirm `pdf_url` is a public URL

### 8.2 Approve and release
- Principal approves the report card (`status = approved`)
- Principal releases it (`status = released`)
- Confirm `released_at` and `released_by` are populated

### 8.3 Parent downloads
- Log in as parent
- Go to Report Cards tab
- Confirm the released report card is visible and downloadable
- Confirm unreleased cards are NOT visible

### 8.4 Unlock for correction
- Principal unlocks a released report card
- Confirm `unlock_count` increments
- Confirm `unlock_reason` is stored
- Edit marks, regenerate — confirm updated PDF replaces old one

---

## Phase 9 — Timetable

> **Dependency:** Phase 2 (staff), Phase 3 (classes exist), Phase 4 (active year).

### 9.1 DoS builds timetable
- Log in as DoS
- Go to Timetable
- Drag a subject/teacher block to a period slot
- Confirm the slot is saved with correct `day_of_week`, `period_number`, `start_time`, `end_time`
- Confirm no double-booking (same teacher in two classes at the same period) is possible

### 9.2 Teacher sees their timetable
- Log in as teacher
- Go to My Timetable
- Confirm only periods assigned to this teacher appear

### 9.3 Publish timetable
- DoS publishes the timetable (`is_published = true`)
- Confirm parent portal shows the student's timetable

---

## Phase 10 — Messaging & Notifications

> **Dependency:** Phase 2 (multiple users exist with auth accounts).

### 10.1 Direct message
- Log in as teacher
- Send a message to a parent
- Log in as parent → confirm message appears in inbox
- Confirm bell icon shows unread badge
- Mark as read → confirm badge clears

### 10.2 Announcement
- Log in as DoS
- Send an announcement to all staff
- Log in as teacher → confirm announcement appears in inbox

### 10.3 Notification delivery
- Teacher enters a remark for a student
- Log in as parent linked to that student → confirm bell shows notification
- Confirm notification has `read: false` in the DB
- Mark read → confirm `read_at` is stamped

### 10.4 File attachment
- Send a message with a file attachment
- Confirm attachment uploads to `staff-attachments` bucket
- Confirm recipient can download the attachment

---

## Phase 11 — Offline Mode

> **Dependency:** All previous phases (app must be fully functional online first).

### 11.1 Offline attendance
- Load the teacher attendance page while online (cache warms)
- Disconnect network
- Mark attendance for 3 students
- Confirm rows are saved to IndexedDB sync queue
- Reconnect → confirm rows sync to Supabase within 90 seconds

### 11.2 Offline message
- Compose a message while offline
- Confirm it goes to sync queue (not thrown away)
- Reconnect → confirm message delivered

### 11.3 Offline banner
- Disconnect network → confirm offline banner appears in top bar
- Reconnect → confirm banner disappears and sync completes

---

## Phase 12 — Student & Parent Portals

> **Dependency:** Phases 3, 5, 6, 8 (student registered, marks entered, fees added, report released).

### 12.1 Student portal
- Log in as student
- Dashboard shows: class, teacher, upcoming events
- Exams tab: shows published marks only (drafts hidden)
- Fees tab: shows own fees only
- Report Cards tab: shows released cards only

### 12.2 Parent portal
- Log in as parent
- Switch between children (if multiple linked)
- Fees tab: shows only linked student's fees, NOT other students
- Report Cards: shows only released cards for linked student
- Survey tab: only shown when `academic_years.survey_active = true`

### 12.3 Parent portal access toggle
- IT admin disables `school_profile.parent_portal_open = false`
- Log in as parent → confirm portal is locked with appropriate message
- Re-enable → confirm access restored

---

## Phase 13 — Security Boundaries

> These tests verify security invariants — run last since they require all roles set up.

| Test | Expected result |
|------|----------------|
| Deputy navigates to `/bursar/ledger` | Redirect / 403 |
| Teacher calls `useFeePayments` hook directly | Returns no data (enabled=false) |
| Parent passes another student's ID to fee balance | Hook throws Forbidden |
| Sync queue with `tableName='fee_payments'` | Sync fails with allowlist error, fee_payments unchanged |
| Upsert sync item with no `school_id` in payload | Sync fails with missing school_id error |
| Staff RLS: teacher queries `staff` rows for another school | Returns 0 rows |
| Student queries `exam_results` for another student | RLS returns 0 rows |

---

## Regression Checklist (run after every deployment)

- [ ] All 9 roles can log in
- [ ] Finance pages inaccessible to non-bursar/principal
- [ ] Student photo displays (signed URL, not broken link)
- [ ] PDF report card generates without error
- [ ] SMS reminder sends (or queues when offline)
- [ ] Bell notification appears after teacher enters remark
- [ ] Offline sync queue clears within 2 minutes of reconnect
- [ ] `npm run test` passes all 423 tests
- [ ] `npm run build` has 0 TypeScript errors

---

*Generated: 2026-06-14 | Tests: 423 passing | Roles: 9 | Tables: ~30*
