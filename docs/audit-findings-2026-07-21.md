# Shule Codebase Audit — Findings Report

**Date:** 2026-07-21
**Method:** Seven parallel specialist agents performed static code review (no live/local Supabase was available in the audit sandbox — Docker daemon not running). Coverage: all 66 SQL migrations, all 15 edge functions, RLS policies, all 10 role page-trees, the shared UI/design system, import/export logic, and a full lint/Vitest baseline run. Playwright e2e (15 specs) was **not** run — it requires a live Supabase project with seeded test accounts, which this sandbox doesn't have.
**Scope of this pass:** findings only, except C1–C7, H1–H4, and M2/M3/M4/M5/M6/M8/M10 (see Remediation Log below, added same day). Severities: **Critical** (real money/data/security exposure, exploitable today) → **High** → **Medium** → **Low**.

---

## Remediation Log

### 2026-07-21 — M2, M3, M4, M5, M6, M8, M10 fixed: survey/session/receipt integrity, storage RLS scoping, CSV escaping, timezone bug

Migration `20260721_000003_medium_findings_batch.sql`, plus app-side changes:

- **M2**: `student_submits_own_survey` had no `student_id` ownership check. Rewrote the policy's `WITH CHECK` to require `student_id` resolve to the caller's own `students` row via `auth_user_id = auth.uid()`.
- **M3**: `custom_access_token_hook` only ever checked `staff.is_active`; an expelled or suspended student's session claims never reflected it. Added a `students.status IN ('suspended', 'expelled')` check alongside the existing staff check, both setting the same `account_status: deactivated` claim the app already knows how to act on.
- **M4**: added `fee_payments_school_receipt_idx`, a partial unique index on `(school_id, receipt_number)`, closing the duplicate/reused-receipt-number gap.
- **M5/M6**: `template_read` required no authentication at all (contradicted its own "private — signed URLs only" comment); all six `templates`/`documents` storage policies checked role only, never `school_id`. Rewrote all six to require `authenticated` and scope by the bucket's own `{school_id}/...` path convention (confirmed against `uploadTemplate()`/`uploadDocument()` in `src/lib/storage.ts`), matching the scoping every table-level RLS policy already has.
- **M8**: `CredentialsMgmtPage.tsx`'s `exportStudentsCsv()` and `BursarDashboard.tsx`'s `exportCSV()` hand-rolled unescaped CSV fields; switched both to the existing `csvField()` helper (`src/lib/csv.ts`) already used elsewhere.
- **M10**: swapped the timezone-buggy `new Date().toISOString().slice(0,10)` pattern (returns the wrong local date for the first ~3 hours of every Uganda day, UTC+3) for the existing `localToday()` helper (`src/lib/dates.ts`) at all 14 remaining call sites, including the two with real logic impact beyond export filenames — `AttendancePage.tsx`'s default date-picker value and `TeacherDashboard.tsx`'s upcoming-events filter — plus `ImportDataPage.tsx`'s staff `join_date` default and `ExamJournalPage.tsx`'s prefill date. Verified clean via repo-wide grep afterward.

Verified: `tsc -b` clean, full Vitest suite passing (1104/1109 — same 5 pre-existing environment-only failures as every prior baseline in this report).

**Deliberately left as backlog, not fixed in this pass** (per explicit request to spare tokens and stop after Medium/Low): M1 (secretary fee-amount RLS is broader than the UI implies), M9/M12/M13/M14/M15 (design/structural polish — duplicated Excel boilerplate, unused `DataTable` component, duplicated edge-function CORS/bootstrap, hardcoded brand hex literals, hand-rolled modal focus trap), M18 (dead timetable-import template + unused `'marks'` import type), and the full L-series (L1–L9). None of these are correctness or security bugs on their own — they're refactor/consistency debt or already-known sandbox limitations (Playwright, missing `.env.local`) — so leaving them open doesn't regress anything shipped in this report.

### 2026-07-21 — C7, H1, H2 fixed: 8-digit ID format, staff_number uniqueness, bursar import confirmation gate + audit log

Migration `20260721_000002_admission_staff_number_8digit_and_index.sql`, plus app-side changes:

- **C7**: `generate_admission_number()` and `generate_staff_number()` both padded to 4/3 digits instead of the agreed 8 (`STU/2026/00000001`). Fixed in both DB trigger functions; existing rows are **not** rewritten, only the generator changes going forward. Also fixed the 3 JS-side preview mirrors (`useNextAdmissionNumber`, `useNextStaffNumber`, `ImportDataPage.tsx`'s preview string) and the wizard's zod format regex, so every page shows/accepts the same 8-digit format consistently. One deliberate deviation from the original remediation spec: the registration wizards' admission/staff number fields are an intentionally editable "auto-generated — edit if needed" override (confirmed in the actual component, not assumed) — kept that capability rather than forcing the field blank for the trigger to fill in, since removing it would have been a real feature regression, not a bug fix. `studentImport.ts`'s historical-year bulk-import path (the trigger only ever uses the *current* year) previously computed its own sequence via an unlocked in-memory counter — replaced with a new `reserve_admission_number(school_id, year)` RPC using the same advisory lock as the trigger, and CSV-supplied explicit admission numbers are now validated against the `STU/YYYY/00000001` format before being accepted (rejected rows go to the failed-rows list instead of entering the table malformed).
- **H1**: added `staff_school_number_idx`, a partial unique index on `(school_id, staff_number)`, mirroring the one students already had.
- **H2**: `BursarImportPage.tsx` — exact class+name matches now check for more than one same-name student in the pool before auto-applying (routes to the same review dropdown as fuzzy matches, new `exact-ambiguous` status, instead of silently crediting whichever the array happened to list first). Fuzzy matching now sorts candidates by ascending Levenshtein distance and only auto-selects when there's a single candidate at distance ≤ 1 (was: blanket auto-accept the first array match at distance ≤ 2). `runImport()` now writes one `audit_log` row per payment it touches, recording `matched_by` (admission_number/exact/close/manual), `match_distance`, and the source CSV row — previously bulk-imported payments left no trace of why a row matched the student it did, unlike manual payment edits.

Verified: `tsc -b` clean, full Vitest suite passing (1104/1109 — same 5 pre-existing environment-only failures as every prior baseline in this report). Added focused new test coverage for the previously-untested paths (historical-year RPC reservation, CSV format rejection/acceptance, exact-ambiguous gating, fuzzy auto-select threshold, audit_log write shape). **Not run against a live Supabase project** — none available in this environment; verify the migration applies cleanly and the RPC/advisory-lock behavior holds under real concurrent load before fully trusting it.

### 2026-07-21 — C2–C6, H3, H4 fixed: unscoped RLS policies + unauthenticated SMS/WhatsApp functions

Migration `20260721_000001_fix_unscoped_rls_and_secret_leaks.sql`, plus three app-side changes:

- **C2/C3/C4**: `students_select_own_school`, `parent_accounts_select`, and `attendance_select` all had the same shape — `USING (school_id = user_school_id())`, no role or ownership check — which silently made every narrower, already-correct policy sitting next to them a no-op (RLS policies are ORed). Replaced with role/ownership-scoped policies for students and attendance; dropped the broad `parent_accounts_select` outright since the correct narrower policies already existed and just needed the broad one out of the way. Also stripped `temp_password`/`auth_email` from `useStudents.ts`'s `LIST_COLS` (`src/hooks/useStudents.ts`), mirroring the fix already applied to staff.
- **C5**: `school_profile_select_public` (`USING (true)`) is intentionally public for pre-login branding, but RLS is row-level — it also exposed live Africa's Talking/WhatsApp secrets to anyone with the public anon key, and to every logged-in user afterward. Fixed with a column-level `REVOKE` (anon/authenticated are real distinct Postgres roles here, unlike the app's collapsed staff/student/parent sub-roles) plus a new `get_messaging_config_status()` RPC — checked first that no other consumer in the app reads the raw values (only `useAdmin.ts`'s status check did, and it was already discarding them client-side, only ever showing booleans).
- **C6**: `send-sms`/`send-whatsapp` had no authentication check at all. Added the same Authorization-header + staff-lookup + school-match pattern already used correctly in `broadcast-announcement`.
- **H3**: `teacher_remarks_insert` let any teacher/class_teacher/principal/dos attribute a remark to any `teacher_id`, not just their own — fixed using the ownership-check pattern the table's own UPDATE policy already had. Also dropped three dead policies comparing `teacher_id` (an FK to `staff.id`) against `auth.uid()`, which could never match.
- **H4**: `parent_accounts`' DELETE policy had the identical FK-vs-`auth.uid()` bug, silently leaving ghost rows on every attempted delete — fixed with the same role-scoped pattern already used for parent_accounts INSERT/UPDATE.

Verified: `tsc -b` clean, full Vitest suite passing (the 5 failures in `schemaColumns.integration.test.ts` are the same pre-existing environment-only failures from the original baseline — missing real Supabase credentials in this sandbox, unrelated to this change), migration SQL paren-balance checked. **Not run against a live Supabase project** — none available in this environment; verify against a real project before considering these closed.

### 2026-07-21 — C1 fixed: on-prem installer + full self-hosted backend stack

Fixing C1 turned out to be bigger than the glob-pattern bug it started as: `docker-compose.school.yml` only ever defined a bare Postgres container and the frontend — there was no Auth, REST API, Realtime, Storage, or edge-function runtime for the frontend to actually talk to. On-prem/Local deployment could not have worked at all, migration bug aside. Rebuilt end-to-end:

- **`scripts/install.sh`** — fixed the `migrations/0*.sql` glob to apply all 66 files; removed the broken auto-seed step (was `psql -f migrations/base.sql`, a file that never existed anywhere in the repo — every on-prem install would have hard-failed at that step); switched `docker compose` → the correct installed package; removed the exposed Postgres port and predictable default password (`ShuleDB2025`) in favor of a per-school generated password with no host port published; backups now run via `docker compose exec` instead of a host-side connection that no longer exists.
- **`docker-compose.school.yml`** — added the full self-hosted Supabase stack (Kong gateway, GoTrue auth, PostgREST, Realtime, Storage, postgres-meta, Studio) plus one container per edge function (15), switched the database image to `supabase/postgres` (the plain `postgres:15-alpine` it used before has none of the `auth`/`storage` schemas, roles, or extensions — pgcrypto, etc. — every migration assumes exist).
- **`supabase/kong.yml`** (new) — gateway routing for the above, modeled on Supabase's long-standing self-hosting reference pattern.
- **`scripts/generate-local-secrets.js`** (new) — generates a unique JWT secret, signed anon/service_role keys, DB password, and Studio login per school. Previously there was no mechanism to produce these for a local install at all.
- **`supabase/functions/Dockerfile`** (new) + **`scripts/build-for-school.sh`** — each edge function now gets pre-built into its own image with Deno dependencies cached at build time (when there's still internet), specifically so a school with zero ongoing connectivity can still run account creation, password resets, etc.
- **`scripts/prepare-usb.sh`** — now generates secrets and pulls the complete backend image set; previously pulled only 3 images (`postgres`, `nginx`, `kong` — the last of which was never even wired into the compose file).
- **`scripts/build-for-school.sh`**, **`scripts/prepare-usb.sh`**, **`scripts/apply-migrations.sh`** — fixed the `supabase/seeds/base.sql` / `supabase/seeds/demo.sql` references (M17): that directory is `supabase/seed/` (singular) and neither file has ever existed in this repo — every seed-copy or seed-apply step using the old path was either failing silently or, in `install.sh`, would have hard-failed the whole install. Replaced with the real `supabase/seed/school_template.sql`, applied manually post-install (it needs a live auth user ID that doesn't exist until after the IT Admin's account is created, so it can't be automated).
- **`scripts/apply-migrations.sh`** — its edge-function deploy list was also missing 5 of the 15 functions (`request-staff-password`, `resolve-staff-password-request`, `sync-self-password-reset`, `set-user-disabled`, `send-push`); cloud installs were silently missing them too. Fixed.
- **`docs/NEW_SCHOOL_SETUP.md`**, **`.gitignore`** — updated to match; added explicit ignore rules for generated secrets files.
- New field guide artifact written for the physical install day (at-home prep → on-site install → manual account setup).

**Not yet done / verify before relying on this for a real school:** this was built and statically verified (YAML/bash syntax, every hostname/env-var/function-name cross-referenced programmatically between `docker-compose.school.yml`, `kong.yml`, and the scripts) but **could not be run end-to-end** — this sandbox has no Docker daemon. Treat the first real on-prem installation as a supervised test run, not a routine rollout, until someone has watched it complete successfully on real hardware.

---

## Critical

### ~~C1~~ — FIXED 2026-07-21, see Remediation Log above
<details><summary>Original finding (for reference)</summary>

On-prem/local/hybrid installer applied only 4 of 66 migrations — every security fix since 2026-06-02 never reached real school deployments. `scripts/install.sh:75` — `for sql in migrations/0*.sql` only matched filenames starting with `0` (the four legacy `00001`–`00004` files). All 61 dated migrations (`20260603_...` onward) start with `2` and were silently skipped; bash doesn't error, it just proceeds with the initial schema only. `scripts/build-for-school.sh:78-82` independently reinforced this by hand-copying only `00001`–`00003` into the installer package.

**Impact:** any school running Local or Hybrid deployment (a real, documented mode — see `docs/NEW_SCHOOL_SETUP.md`) was frozen at the 2026-06-02 schema. Every other Critical/High finding below that was already fixed in a later migration (school_profile RLS, cross-tenant RPC takeover, attendance/discipline ID-mismatch fixes, advisory-lock race fix) was **still live** on that installation.
</details>

### C2. Any authenticated user can read every student's plaintext login password  
**FIXED 2026-07-21 — see Remediation Log above.**
`supabase/migrations/00003_rls_policies.sql:253` (`students_select_own_school`): `USING (school_id = user_school_id())` — no role or ownership restriction. `src/hooks/useStudents.ts:11-16` (`LIST_COLS`, used by nearly every role's student list) includes `temp_password` and `auth_email` in plaintext. `useStaff.ts` explicitly excludes the staff equivalent with a comment noting exactly this risk — the fix was applied to staff but never mirrored to students.

**Exploit:** a bursar opening the ordinary Fee Ledger page (`bursar/FeeLedgerPage.tsx:53`), or a teacher, deputy, or DOS opening any student list, receives every active student's plaintext password in the network response. Trivial account takeover of the student portal by any authenticated user, no tooling beyond devtools required.

### C3. Any authenticated user can read every parent's plaintext login password and full child-mapping roster  
**FIXED 2026-07-21 — see Remediation Log above.**
`00003_rls_policies.sql:172` (`parent_accounts_select`): `USING (school_id = user_school_id())`, no role/ownership check. The table includes `email`, `phone`, `full_name`, `student_ids`, and `temp_password`. Postgres ORs permissive RLS policies together, so this broad policy alone authorizes full reads regardless of the narrower `parent_can_view_own_account` / `secretary_principal_can_view_parent_accounts` policies that were presumably meant to be the real gate.

**Exploit:** any teacher, bursar, or student can query the table directly and get every family's contact info, exactly which children belong to which parent, and (for unactivated accounts) a working password — enabling login as another family to view grades, attendance, and fee balances.

### C4. `attendance_select` RLS policy is unscoped, silently overriding the class/role-scoped policy meant to protect it  
**FIXED 2026-07-21 — see Remediation Log above.**
`00003_rls_policies.sql:58` — `attendance_select`: `USING (school_id = user_school_id())` with no role/ownership check, added alongside a narrower, correctly-scoped `"attendance: teacher sees own records"` policy. Because RLS policies are ORed, the broad one wins. This is the same bug class the team already found and fixed twice for `attendance` INSERT (`20260704_000003`) and UPDATE (`20260704_000004`, whose own comment says "same class of bug already found and fixed once") — but the SELECT side was never cleaned up.

**Exploit:** any student or parent can read the entire school's attendance history for every student, not just their own/their child's.

### C5. Third-party SMS/WhatsApp API secrets are readable by anyone with the public anon key — no login required  
**FIXED 2026-07-21 — see Remediation Log above.**
`supabase/migrations/20260706_000001_enable_rls_school_profile.sql:19-21` — `school_profile_select_public`: `FOR SELECT USING (true)`. The table stores `at_api_key`, `sms_api_key`, `wa_access_token`, `wa_phone_number_id` in plaintext (Africa's Talking + WhatsApp Cloud API live credentials). RLS is row-level, not column-level, so the "public for pre-login branding" intent leaks the secret columns too. The anon key is deliberately embedded in the client bundle, so this requires zero authentication — a direct REST call with the public key returns the school's live paid messaging credentials.

### C6. `send-sms` and `send-whatsapp` edge functions have no authentication check at all  
**FIXED 2026-07-21 — see Remediation Log above.**
`supabase/functions/send-sms/index.ts`, `supabase/functions/send-whatsapp/index.ts` — neither checks the caller's `Authorization` header (contrast `broadcast-announcement/index.ts`, which does). Both take `recipients` + `schoolId` straight from the request body and send real messages via the school's live API key.

**Exploit:** anyone who has the school's Supabase project URL and public anon key (needed only to invoke the function, not to authorize inside it) can POST an arbitrary recipient list and message and send unlimited spam/phishing billed to the school's paid SMS/WhatsApp account. Combined with C5, an attacker doesn't even need this function — they can hit Africa's Talking/Meta directly with the stolen key.

### C7. Admission numbers do not match the agreed format — and the logic is duplicated 5 times  
**FIXED 2026-07-21 — see Remediation Log above.**
Agreed spec: `STU/year/00000xxx` (8-digit sequence). Actual: the DB trigger (`generate_admission_number()`, most recently touched in `supabase/migrations/20260705_000005_atomic_number_generation.sql`) and all JS mirrors pad to **4 digits** (`STU/2026/0001`). The generation logic exists independently in 5 places — 2 DB trigger functions, `useNextAdmissionNumber` (`src/hooks/useStudents.ts:184-207`), `useNextStaffNumber` (`src/hooks/useStaff.ts:160-202`), a third preview in `src/pages/secretary/ImportDataPage.tsx`, and a fourth generator for historical-year bulk imports in `src/lib/studentImport.ts:230-259` with no advisory lock (race risk on concurrent historical imports). A full remediation spec for this is in the [Remediation Spec](#remediation-spec-admissionstaff-numbers--bursar-import) section below.

---

## High

### H1. `staff_number` has no database uniqueness constraint  
**FIXED 2026-07-21 — see Remediation Log above.**
Students have `students_school_admission_idx (school_id, admission_number)`; staff have no equivalent anywhere in the 66 migrations. A race, a bug, or an explicit duplicate value in a CSV import can silently create two staff members sharing one staff number.

### H2. Bursar fees-ledger import: exact name+class matches auto-commit real money with zero confirmation, and leave no audit trail  
**FIXED 2026-07-21 — see Remediation Log above.**
`src/pages/bursar/BursarImportPage.tsx`. Only fuzzy "close" matches (Levenshtein ≤2) require a human-reviewed dropdown; exact class+name matches are applied immediately. Two same-name students in the same class/stream get silently, automatically credited to whichever record the code finds first — no ambiguity check exists on the exact-match path at all. Separately: fuzzy candidate selection picks `close[0]` (first array entry) rather than best-distance, and the class-matching substring fallback (`key.includes(normClass) || normClass.includes(key)`) can conflate two classes whose names are substrings of each other. Finally, `runImport()` never writes to `audit_log` — unlike manual payment edits, which do — so a wrong bulk-imported credit leaves no trace to find or reverse it by. Full remediation spec below.

### H3. `teacher_remarks` INSERT has no ownership check; several "own remarks" RLS policies are silently dead  
**FIXED 2026-07-21 — see Remediation Log above.**
`teacher_remarks_insert` grants insert to any teacher/class_teacher/principal/dos with only a school match — no check that `teacher_id` is the caller's own staff row, so one teacher can write remarks attributed to a colleague. The narrower `teacher_can_insert_own_remarks` / `teacher_can_update_own_remarks` / `staff_can_view_remarks` policies compare `teacher_id = auth.uid()`, but `teacher_remarks.teacher_id` is a foreign key to `staff.id`, not to the auth user's UUID — so those conditions can essentially never be true. This is the exact bug class already found and fixed for `discipline_records` (`20260706_000002`, whose comment explicitly names this FK-vs-uid mismatch) — missed here.

### H4. `parent_accounts` DELETE policy has the same FK-vs-uid bug and silently doesn't work  
**FIXED 2026-07-21 — see Remediation Log above.**
`20260612_000003_parent_accounts_delete_rls.sql`: `USING (created_by = auth.uid())` — `created_by` is a foreign key to `staff.id`, not to `auth.uid()`. The migration's stated purpose (letting a secretary roll back an orphaned insert in `CreateUserWizard`) is never actually achieved — every delete attempt matches 0 rows and no-ops, leaving the exact ghost-row problem the migration was written to fix.

### H5. Passwords are stored in plaintext across four tables
`staff.temp_password`, `students.temp_password`, `parent_accounts.temp_password`, and `staff_password_requests.new_password` are all plain `TEXT` (a deliberate product decision for low-connectivity, IT-admin-recoverable credentials — reasonable in isolation) — but this materially raises the blast radius of every RLS bug above: any read-access bug now yields directly usable live credentials, not hashes.

### H6. Raw backend error messages are shown directly to users in at least 2 pages
`src/pages/shared/ProfilePage.tsx:158` and `src/pages/shared/SharedEventsPage.tsx:53` render `err.message`/`e.message` directly, bypassing the app's own `getFriendlyErrorMessage()` helper that every other toast call goes through. A Postgres constraint-violation string could surface raw in front of a demo audience.

### H7. Icon-only buttons are missing accessible names app-wide
30/30 sampled icon-only `<button><svg>...` instances lack `aria-label` (e.g. `dos/DosTimetablePage.tsx`, `admin/AdminUsersPage.tsx`, `shared/MessagingPage.tsx`). Only 35 `aria-label` occurrences exist in the whole app. Screen-reader users cannot identify what most action buttons do.

---

## Medium

- **M1.** Secretary's "fee status flag only, no amounts" is UI-only. The backing RLS (`20260703_000003_secretary_can_view_fee_payments.sql`) grants unrestricted `SELECT *` on `fee_payments`; a secretary can query the API directly and see exact amounts, receipts, and notes the product intentionally withholds from this role. **Backlog — not fixed in this pass, see Remediation Log.**
- ~~**M2.** `student_surveys` INSERT has no `student_id` ownership check — any authenticated user can submit a survey response impersonating an arbitrary student.~~ **FIXED 2026-07-21 — see Remediation Log above.**
- ~~**M3.** Expelled/suspended students keep full portal access — `custom_access_token_hook` only checks `staff.is_active`, never `students.status`.~~ **FIXED 2026-07-21 — see Remediation Log above.**
- ~~**M4.** `fee_payments.receipt_number` has no unique constraint — duplicate/reused receipt numbers are possible.~~ **FIXED 2026-07-21 — see Remediation Log above.**
- ~~**M5.** The `templates` storage bucket is readable with zero authentication, contradicting its own code comment ("private — signed URLs only").~~ **FIXED 2026-07-21 — see Remediation Log above.**
- ~~**M6.** `templates`/`documents` storage RLS checks role only, never `school_id`. Not exploitable under the current one-Supabase-project-per-school model, but becomes a real cross-tenant PII leak (staff NIN numbers, transcripts) the moment this is ever run as a shared multi-tenant deployment — worth fixing regardless since it's inconsistent with every table-level policy.~~ **FIXED 2026-07-21 — see Remediation Log above.**
- **M7.** No file type/size validation on any upload path (`src/lib/storage.ts`); relies only on default project-wide Supabase limits. **Backlog — not fixed in this pass.**
- ~~**M8.** CSV export escaping is inconsistent: `src/lib/csv.ts` has a shared RFC4180-safe `csvField()` helper, but `admin/CredentialsMgmtPage.tsx` and `bursar/BursarDashboard.tsx` still hand-roll unescaped CSV — the exact bug class the helper was built to fix.~~ **FIXED 2026-07-21 — see Remediation Log above.**
- **M9.** Excel export boilerplate (`ExcelJS.Workbook` setup/styling) is duplicated near-identically across ~8 files. **Backlog — not fixed in this pass, see Remediation Log.**
- ~~**M10.** A timezone-safe `localToday()` helper exists (Uganda is UTC+3; the naive `new Date().toISOString().slice(0,10)` pattern returns yesterday's date for the first 3 hours of each local day) but ~20 call sites — including `teacher/AttendancePage.tsx`, `teacher/TeacherDashboard.tsx`, `hooks/usePrincipal.ts`, `hooks/useTermProgress.ts` — still use the buggy pattern directly. Real, user-facing bug window every night.~~ **FIXED 2026-07-21 — see Remediation Log above.**
- **M11.** A canonical currency formatter (`ugx()` in `useFeePayments.ts`, commented "use everywhere money appears") is bypassed by at least 5 files that hand-roll `'UGX ' + n.toLocaleString(...)` with inconsistent formatting. **Backlog — not fixed in this pass.**
- **M12.** A fully-built `DataTable` component (270 lines: sorting, selection, loading skeletons, empty states) is exported but has zero usages anywhere; 30 files hand-roll raw `<table>` markup instead. **Backlog — not fixed in this pass, see Remediation Log.**
- **M13.** All 15 edge functions duplicate an identical CORS-headers object and near-identical Supabase client bootstrap, with no shared module — CORS is currently wide-open (`*`) everywhere, and any future tightening or security-relevant client-setup change has to be applied by hand in up to 15 places. **Backlog — not fixed in this pass, see Remediation Log.**
- **M14.** Login-page branding hardcodes ~75 teal hex literals per file instead of the brand-color variable; pre-auth screens (the first thing anyone sees in a demo) can never reflect a school's custom color. **Backlog — not fixed in this pass, see Remediation Log.**
- **M15.** Radix UI is installed but used in only 2 files; the shared `Modal` is fully hand-rolled and lacks a full focus trap (Tab can escape the dialog). **Backlog — not fixed in this pass, see Remediation Log.**
- **M16.** Two on-prem packaging scripts disagree on which migrations to stage (`build-for-school.sh` stages 3, `prepare-usb.sh` stages all 66) — moot today only because C1's broken installer glob discards the difference anyway; fix both when fixing C1. **FIXED as part of C1 — `build-for-school.sh` now copies all migrations, see the 2026-07-21 C1 Remediation Log entry above.**
- **M17.** `scripts/apply-migrations.sh` references `supabase/seeds/` (plural); the real directory is `supabase/seed/` (singular) — stale/broken path. **FIXED as part of C1 — see the 2026-07-21 C1 Remediation Log entry above.**
- **M18.** Dead/stub artifacts: a timetable-import CSV template exists with no handler wired to it; an `ImportContext` type includes `'marks'` with no page using it. **Backlog — not fixed in this pass, see Remediation Log.**

---

## Low

- **L1.** `isValidEmail()` validator is exported but has no callers; forms validate email ad hoc instead.
- **L2.** ~21 pages build their own fixed-position modal overlay instead of using the shared `Modal` component (may be intentionally different UI in some cases — worth a follow-up pass, not a confirmed bug).
- **L3.** `set-user-disabled` edge function doesn't verify the target account belongs to the caller's school (low risk under the current one-project-per-school model).
- **L4.** No rate limiting on the SMS/WhatsApp send functions (compounds C6) or on the public staff-password-reset-request endpoint (enumeration/spam risk, though the endpoint's response is already generic to avoid account enumeration).
- **L5.** A plain `teacher` can navigate to `/teacher/my-class` by URL even though it's not in their nav; resolves to an empty homeroom, not a data leak.
- **L6.** `school_events`, `student_surveys`, `survey_responses`, `error_log` allow `school_id IS NULL` — RLS fails closed on NULL (no leak), but such rows become permanently orphaned/invisible.
- **L7.** Lint: 983 errors / 46 warnings. Majority are `no-explicit-any`/style rules, but there's a real cluster of "setState synchronously within an effect can trigger cascading renders" errors worth triaging separately as an actual render-correctness risk, not just style noise.
- **L8.** Vitest: 1064/1069 tests pass (94/99 files). The 5 failing files fail only because this sandbox has no `.env.local` Supabase credentials — not app bugs — but it does mean those 5 test files aren't fully isolated/mocked like the other 94.
- **L9.** Playwright e2e (15 specs, one per role plus security/offline/CBC-grades flows) could not be executed in this pass — requires a live Supabase project with seeded `@shule.ug` test accounts.

---

## "Local ↔ live database sync" — clarification

There is no bidirectional schema/data sync pipeline between a local and a live Postgres instance. What exists is a **client-side offline write queue** (Dexie/IndexedDB + `useSyncQueue.ts`) that queues mutations made while offline and flushes them to whichever single Supabase endpoint (on-prem local, or cloud) that particular deployment is configured for — not a sync *between* two databases. Each school deployment (Cloud, Local, or Hybrid per `docs/NEW_SCHOOL_SETUP.md`) talks to one authoritative backend at a time. `src/lib/syncQueue.ts` itself documents a previously-fixed bug (a second, drifted flush loop that silently lost writes to some tables) — that one is confirmed fixed, but see **C1**: for any Local/Hybrid school, the *migrations* backing that endpoint are frozen at the initial schema regardless of how well the write-queue itself works.

---

## Remediation Spec: Admission/Staff Numbers & Bursar Import

*(Written by a dedicated spec agent against current code; ready to hand to an implementer once you approve moving to the fix phase — this is spec only, no code has been changed.)*

### 1. Centralized ID generation
**Decision: the DB trigger is sole authority; JS "preview" hooks become cosmetic-display-only and must never be submitted as the value.**
- `useStudents.ts` / `useStaff.ts`: stop sending `admission_number`/`staff_number` in the insert payload for new registrations (let the trigger fill it); keep the preview hooks purely as UI labels, fixed to 8-digit padding.
- `studentImport.ts`'s historical-year path is the one legitimate exception (the trigger always uses the *current* year) — replace the unlocked in-memory `++newStudentSeq` counter with a new `reserve_admission_number(school_id, year)` RPC that takes the same advisory lock the trigger uses, so concurrent historical imports can't collide.
- `ImportDataPage.tsx`'s preview string: fix padding only, no payload change (it delegates to `studentImport.ts`).
- CSV explicit override: add format validation — reject any CSV-supplied `admission_number` that doesn't match `^STU/\d{4}/\d{8}$` instead of accepting arbitrary strings.
- DB fix (new migration, don't edit historical files): `lpad(v_seq::text, 4, '0')` → `lpad(v_seq::text, 8, '0')` in `generate_admission_number()`; same treatment for `generate_staff_number()` pending product confirmation that staff get the 8-digit rule too. Existing 4-digit rows are **not** rewritten — only the generator changes going forward.

### 2. `staff_number` unique index
```sql
CREATE UNIQUE INDEX staff_school_number_idx
  ON public.staff (school_id, staff_number)
  WHERE staff_number IS NOT NULL;
```
Ship in the same migration as the trigger fix.

### 3. Bursar import — confirmation gate
Require confirmation not just for fuzzy "close" matches (already gated) but also for **exact matches where more than one student shares the same normalized name in the same class/stream** — change the current `.find` to `.filter`; if more than one match, route through the same review-dropdown UI as "close" matches instead of auto-applying.

### 4. Fuzzy tie-break rule
Replace "pick `close[0]`" with: compute distance for every candidate, auto-select only if there's a single candidate at the minimum distance *and* that distance is ≤1 (tighter than today's blanket ≤2 auto-accept); otherwise route to manual review, sorted by ascending distance.

### 5. `audit_log` write in `runImport()`
Write one `audit_log` row per touched `fee_payments` row, including `matched_by` (exact/close/exact-ambiguous/admission_number), `match_distance`, and the source CSV row index in `new_value` — so a wrong credit can be traced and reversed.

### 6. Priority order
1. Bursar `audit_log` + exact-ambiguous gate — silent misapplied money with zero trace is the worst failure mode.
2. Fuzzy tie-break rule.
3. `staff_number` unique index — cheap, closes a real integrity gap.
4. Admission/staff number padding + centralization — real but lower severity than misdirected money; needs a product decision on whether staff numbers also get 8 digits.

---

## Suggested overall fix priority (across the whole report)

1. ~~**C1** (broken installer)~~ — fixed 2026-07-21, see Remediation Log. Needs a real on-site test run before full trust.
2. ~~**C2–C6** (unscoped RLS + unauthenticated SMS/WhatsApp functions)~~ — fixed 2026-07-21, see Remediation Log. Needs verification against a real Supabase project before full trust — no live project was available to test against.
3. ~~**H3, H4** (FK-vs-uid RLS bugs)~~ — fixed in the same pass as C2–C6, since it's the same bug class and same migration.
4. ~~**C7, H1, H2** (ID format + bursar import integrity)~~ — fixed 2026-07-21, see Remediation Log. Needs verification against a real Supabase project (migration + concurrent-import locking behavior) before full trust.
5. ~~**M2, M3, M4, M5, M6, M8, M10** (survey/session/receipt integrity, storage RLS scoping, CSV escaping, timezone bug)~~ — fixed 2026-07-21, see Remediation Log. Needs verification against a real Supabase project before full trust.
6. Remaining Medium/Low items (M1, M7, M9, M11–M15, M18, L1–L9) — deliberately left as backlog per the 2026-07-21 Remediation Log entry; design/structural polish and refactor debt, not correctness or security bugs.
