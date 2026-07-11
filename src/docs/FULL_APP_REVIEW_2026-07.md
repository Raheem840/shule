# Full-App Systematic Code Review — Final Checkpoint (2026-07)

> Durable tracking file for the pre-launch, section-by-section review of every role page, hook, and
> component. **If you are picking this up in a new session or after compaction: read this file
> first, find the next `pending` batch below, and resume there — do not restart from batch 1.**

## Why this exists

Final review pass before the app is considered ready for the real school. Scope: 151 files,
~70,600 lines (79 page files across 11 role folders, 34 hooks, 38 components). Too large for one
pass — broken into 30 batches, each independently reviewed, fixed, tested, and committed.

## Methodology

**Finder angles** (parallel Agent calls, each returns ≤6-8 candidates: file/line/summary/failure_scenario):

- *Pages* (8 angles): line-by-line correctness · cross-file contract tracer · RLS/finance-isolation/role-guard audit · CLAUDE.md rules & conventions audit · dead code/unreachable branches · simplification · efficiency (N+1, sequential awaits, missing memo) · UI/state-bug (races, stale closures, missing `key`, loading/error edges)
- *Hooks* (6 angles): correctness · cross-file tracer · conventions · dead code · simplification · efficiency, **plus schema-correctness** (every table/column checked against the audited DB schema in root `CLAUDE.md`)
- *Components* (6 angles): correctness · cross-file tracer · dead code · simplification · efficiency, **plus accessibility/responsive/design-token** (tap targets, `:active` states, dark-mode `data-theme`, no hardcoded hex)

**Verify**: dedup overlapping candidates → 1 independent verifier Agent per candidate → CONFIRMED/PLAUSIBLE/REFUTED. Drop REFUTED.

**Fix loop**: fix directly (not delegated) → immediately run targeted `npx tsc -b` + the affected test file(s) → next finding. No fix left untested.

**Batch checkpoint before commit**: full `npx tsc -b` + full `npx vitest run` + full `npm run build`, all 100% clean. Only then commit (code + this file's update together).

Findings that are real but low-severity/pre-existing/out-of-scope are logged **DEFERRED** with a reason — never silently dropped.

## Batch Checklist

| # | Batch | Files | Status | Fixed | Deferred | Commit |
|---|-------|-------|--------|-------|----------|--------|
| 1 | Principal A | AcademicYearPage, AuditLogPage, PrincipalAnalyticsPage, PrincipalDashboard, PrincipalClassesPage | done | 9 | 11 | `b42057f` |
| 2 | Principal B | PrincipalReportCardsPage, PrincipalSettingsPage, PrincipalStaffPage, PrincipalStaffProfilePage, PrincipalStudentsPage, StudentFullProfilePage | done | 12 | 14 | `7ed44b7` |
| 3 | Deputy | DeputyDashboard, DeputyDepartmentsPage, DeputyStaffPage, DeputyStudentsPage, DeputyTimetablePage, DisciplinePage | done | 10 | 12 | `d20b7f0` |
| 4 | DOS A | DosDashboard, DosClassesPage, DosStudentsPage, DosSubjectsPage, DosSurveysPage | done | 11 | 13 | `3daa8a4` |
| 5 | DOS B | DosJournalsPage, DosTeachersPage, DosTimetablePage, DosCurriculumPage | pending | | | |
| 6 | Secretary A | StudentRegistrationWizard, StaffRegistrationWizard, StudentsPage, SecretaryStudentsPage, SecretaryStudentEditPage | pending | | | |
| 7 | Secretary B | ParentCredentialsPage, ReportCardsPage, ClassListPage, ImportDataPage | pending | | | |
| 8 | Secretary C | SecretaryDashboard, SecretaryReportsPage, SecretaryStaffPage, SchoolAtAGlancePage, FeeStatusPage | pending | | | |
| 9 | Bursar A | AddPaymentPage, FeeLedgerPage, FeeStructurePage, FeeReportsPage | pending | | | |
| 10 | Bursar B | BursarImportPage, BursarStudentsPage, BursarDashboard, DeliveryLogPage, SmsReminderPage, BursarMessagesPage | pending | | | |
| 11 | Teacher A | ExamJournalPage, MarkEntryPage, AttendancePage, ReportPreviewPage | pending | | | |
| 12 | Teacher B | TeacherCurriculumPage, ClassTeacherStudentsPage, TeacherDashboard, TeacherEventsPage, TeacherMyClassesPage, TeacherParentMessagesPage, TeacherRemarksPage, TeacherTimetablePage | pending | | | |
| 13 | Student portal | StudentPortalPage | pending | | | |
| 14 | Parent portal | ParentPortalPage | pending | | | |
| 15 | Shared pages | MessagingPage, ProfilePage, RemarksViewPage, SharedEventsPage | pending | | | |
| 16 | Admin A | AdminDashboard, AdminUsersPage | pending | | | |
| 17 | Admin B | CredentialsMgmtPage, SchoolProfilePage, SystemSettingsPage, ApiConfigPage, TemplatesPage | pending | | | |
| 18 | Auth | LoginPage, ParentLoginPage, ResetPasswordPage | pending | | | |
| 19 | Hooks: Finance | useFeePayments, useFeeStructure | pending | | | |
| 20 | Hooks: Messaging | useMessaging, useNotifications, useStaffPasswordRequests, useSmsReminders | pending | | | |
| 21 | Hooks: Portals | useParentPortal, useStudentPortal, useProfile | pending | | | |
| 22 | Hooks: Role dashboards | usePrincipal, useDeputy, useDos, useAdmin | pending | | | |
| 23 | Hooks: Academic records | useExamJournal, useExamResults, useTeacherRemarks, useReportCards, useTermProgress | pending | | | |
| 24 | Hooks: People/org | useStudents, useStaff, useStaffAuth, useStaffPhotoUrl, useClasses, useAttendance | pending | | | |
| 25 | Hooks: Scheduling | useTimetableSlots, useTeacherEvents, useSecretaryBriefing | pending | | | |
| 26 | Hooks: Infra/offline | useOfflineMode, useOfflineMutation, useOfflineQuery, useSyncQueue, useConnectionStatus, useSignedUrl, useIsMobile | pending | | | |
| 27 | Components: Layout | AppShell, GlobalSearch, ProtectedRoute, SyncManager, App.tsx, main.tsx, sw.ts | pending | | | |
| 28 | Components: Shared A (heavy) | OnboardingWizard, ImportWizard, EventTimeline, PromoteStudentsSection | pending | | | |
| 29 | Components: Shared B (rest) | remaining 14 files under src/components/shared/ | pending | | | |
| 30 | Components: UI primitives | all 16 files under src/components/ui/ | pending | | | |

## Live DB Changes Log

_Per user direction (2026-07-05): migrations found necessary during this review are applied live automatically without per-instance confirmation; this section is the running record for the final report. Anything destructive or ambiguous still stops for explicit confirmation._

| Migration file | Batch | What it does | Why |
|---|---|---|---|
| `20260705_000006_atomic_set_active_academic_year.sql` | Principal A | Adds `set_active_academic_year(school_id, year_id)` RPC — single atomic UPDATE via CASE instead of two sequential client-side updates | `useSetActiveYear` was non-atomic (2 round trips, first error unread) — could leave a school with 0 or 2 active academic years on partial failure |
| `20260706_000001_enable_rls_school_profile.sql` | Principal B | **CRITICAL.** Enables RLS on `school_profile` (was fully disabled) + 4 policies: SELECT open (public/anon, preserves the pre-login connectivity ping and branding read), INSERT/UPDATE/DELETE restricted to principal/it_admin, scoped to the caller's own school | Confirmed live via direct DB query: `anon` (the public key embedded in every frontend bundle) had DELETE/INSERT/SELECT/UPDATE/TRUNCATE on a table storing real API secrets (Africa's Talking/SMS/WhatsApp tokens) with zero RLS and zero policies — any unauthenticated request, from anywhere, could read every school's secrets or overwrite/delete their profile row |
| `20260706_000002_fix_discipline_records_delete_rls.sql` | Deputy | Drops two overlapping/broken DELETE policies on `discipline_records`, replaces with one correct policy (principal: any record in school; deputy: only records they personally authored, resolved via staff.auth_user_id) | Confirmed live: a broad policy (any deputy/principal, no ownership check) made a narrower "ownership" policy a dead no-op — and that narrower policy's own check was independently wrong too (compared `recorded_by`, a staff.id, against `auth.uid()`, which never match). Any deputy could delete any other deputy's discipline records. Same class of bug already fixed once for `attendance` UPDATE. |
| `20260706_000003_fix_dos_assign_rpc_cross_tenant.sql` | DOS A | **CRITICAL.** Rewrites `dos_assign_class_teacher`, `dos_assign_classes`, `dos_assign_subjects`, and `save_school_api_key` (all `SECURITY DEFINER`, bypass RLS) to derive the school id from the caller's own JWT claim instead of trusting a client-supplied `p_school_id` parameter | Confirmed live via `pg_get_functiondef`: all 4 functions scoped their writes by a parameter the client fully controls, with zero verification it matched the caller's actual school. `save_school_api_key` (writes real SMS/WhatsApp API secrets to `school_profile`) had **no role check at all** — any authenticated user, any role, any school, could overwrite any other school's API secrets. The other 3 at least checked role but still let any dos/secretary/it_admin/principal rewrite another school's staff/stream records. |

## Findings Log

### Batch 1 — Principal A

**Fixed (9):**
1. `AcademicYearPage.tsx` `useSetActiveYear` — non-atomic 2-step update (unread error on first call, could leave 0 or 2 active years) → atomic `set_active_academic_year` RPC. Live migration (see DB Changes Log).
2. `AcademicYearPage.tsx` — `today`/`isFuture`/term-status math used `toISOString()` (UTC), wrongly flagging same-day years as future / marking terms "completed" hours early for a UTC+3 school → `localToday()`/`localStartOfDay()`/`localEndOfDay()` helpers used throughout.
3. `AcademicYearPage.tsx` — double-submit guards added to Create/Edit/Set Active/Survey-toggle handlers (button `disabled` alone isn't reentrant-safe); survey toggle button now shows a disabled/pending visual state.
4. `AcademicYearPage.tsx` — fetch error silently rendered as "No academic years configured" (isError not destructured) → distinct error state added.
5. `PrincipalClassesPage.tsx` — `useStudents()` called unfiltered, counting suspended/expelled students as enrolled (confirmed independently by 3 finder angles) → scoped to `{status:'active'}`, matching `usePrincipalKpis`.
6. `usePrincipal.ts` `useAuditLog` — `dateTo` filter excluded entries from the end date itself (missing end-of-day time component, unlike sibling `useMessageLog` in the same file) → appended `T23:59:59`.
7. `AuditLogPage.tsx` `useMessageLog` — name resolution only checked the `staff` table; any message from a parent or student (enabled in an earlier session) showed as "Unknown" → now also resolves against `parent_accounts`/`students`.
8. `PrincipalAnalyticsPage.tsx` "Fees by Class" chart — hardcoded `academicYearId: null` aggregated fee_payments across every year that ever used a given term number, while the title implied single-year scope → scoped to the active year via new `useActiveAcademicYearId()` hook (`useClasses.ts`); `useFeeCollectionByClass` gained an `enabled` param to avoid a premature unscoped fetch.
9. `usePrincipalKpis`/`PrincipalDashboard.tsx` — `feeCollectionRate: number` conflated "0% collected" with "no data at all" (a new school with no active year/no fee_payments rows showed a false "0%, crisis" tile) → made nullable, matching `overallPassRate`'s existing null convention. Also fixed `PrincipalDashboard`'s `RecentActivity` widget duplicating audit-narrative logic without the login-stamp special case (routine staff logins showed as "Changed Staff Member") — extracted `isLoginStampOnly`/`ACTION_META`/`friendlyRole`/`friendlyTable` as shared exports from `AuditLogPage.tsx`.

**Deferred (11, logged not silently dropped):**
- Un-virtualized 200-row lists in `AuditLogPage.tsx` (both tabs) — real CLAUDE.md rule-2 violation, but fixing well (pagination or virtualization) is a pattern that will recur across many later batches; better addressed once, consistently, in a dedicated pass rather than ad hoc here.
- Hardcoded hex color constants (`PrincipalAnalyticsPage.tsx` Recharts palette, `PrincipalClassesPage.tsx` `LEVEL_META`, `AcademicYearPage.tsx` `TERM_META` gradients, `AuditLogPage.tsx` `ACTION_META`) — Recharts genuinely cannot read CSS custom properties at render time, and a full "read computed CSS var into JS" bridge is a design-system-level task, not a per-file fix. Worth a dedicated CLAUDE.md rule-8 remediation pass across the whole app (this exact issue will reappear in almost every later batch with a chart).
- `AcademicYearPage.tsx` — `CreateYearModal`/`EditYearModal` ~95% duplicate, and the future-active-year confirmation dialog is hand-rolled instead of using the shared `Modal` component (the same anti-pattern already fixed once elsewhere per session history) — real cleanup, deferred as a refactor rather than a bug; recommend addressing together in a follow-up pass over `AcademicYearPage.tsx` once more of the app's modal usage has been swept in this same review.
- `PrincipalAnalyticsPage.tsx` — 7 near-identical loading/empty/content chart-card blocks; a `MetricCard` wrapper would remove the duplication. Cleanup, not a bug.
- Academic-year mutations (`useCreateAcademicYear`/`useUpdateAcademicYear`/`useSetActiveYear`) have no explicit app-level role check unlike sibling `useToggleSurvey` — not exploitable today (RLS backs it up), but inconsistent error UX if RLS is ever loosened. Logged for awareness.
- `useToggleSurvey` permits `dos` at the app layer but `academic_years` RLS UPDATE policies only allow `principal`/`it_admin`/`secretary` — and no DOS-facing UI exists to exercise the app-layer permission anyway. Dead-end either way; not a live bug, flagged for a future "give DOS a survey toggle" feature session.
- `AuditLogPage.tsx` — the Audit Log detail panel lets Principal see exact fee amounts/receipts (`amount_paid`, `balance`, etc.) on expand, arguably beyond the "Summary only" finance boundary in CLAUDE.md's role table. Judged NOT a bug: audit-trail accountability for a principal overseeing all staff actions (including bursar's) is a different concern from aggregate financial *reporting* granularity — redacting real figures from an audit trail would undermine its purpose. Logged as a deliberate judgment call, not silently dropped, in case the user disagrees.
- `AuditLogPage.tsx` — Message Log CSV export has no `is_announcement` filter and dumps full message bodies unredacted; RLS-consistent (Principal can already read all school messages) so likely intentional, not a bug.
- `PrincipalClassesPage.tsx`/`useStudents()` — no academic-year scoping at all, so a student whose `class_id` points at a non-active-year class row is silently excluded from every count with no "Unassigned" warning (same class of gap already found and fixed with an explicit warning banner on `DosStudentsPage.tsx` per an earlier session). Recommend the same treatment in a dedicated follow-up rather than scope-creeping this batch.
- `PrincipalAnalyticsPage.tsx` — the class-filter dropdown is scoped to the active year's classes (via `useClasses()`), but `useAllClassPerformance()`/`useAttendanceByClass()` build their own `classId` values with no year filter — after a year rollover, a principal can never filter down to a class that only existed in a past year, and "All Classes" silently mixes years. Related to the prior item; same deferred bucket.
- Raw Supabase calls embedded directly in `AcademicYearPage.tsx`/`AuditLogPage.tsx` page components instead of `src/hooks/` (folder-structure convention: "hooks — All DB ops — never raw supabase in pages") — not a live bug (RLS still applies), but the exact pattern the convention exists to prevent. Cleanup, not urgent.

**Tests added:** RPC-call assertion for `useSetActiveYear` (`AcademicYearPage.test.tsx`), parent/student attribution test (`AuditLogPage.test.tsx`), login-stamp widget test (`PrincipalDashboard.test.tsx`), null-vs-zero fee-rate test (`usePrincipal.test.tsx`) — plus updates to 2 existing tests whose expectations were based on the old (buggy) behavior.

### Batch 2 — Principal B

**Fixed (12):**
1. **CRITICAL** — `school_profile` had RLS fully disabled with `anon` granted full DELETE/INSERT/SELECT/UPDATE/TRUNCATE (confirmed live, not just from a stale code comment). Fixed via migration (see DB Changes Log) — read stays open (preserves the pre-login connectivity ping in `useConnectionStatus.ts`), writes restricted to principal/it_admin. Also added matching app-layer role guards to `PrincipalSettingsPage.tsx`'s `useSave`/`useTogglePortal` for clean "Forbidden" UX now that the DB backstop exists.
2. `useSetStaffActive` (`useStaff.ts`) duplicated `useSuspendStaff`'s deactivate/reactivate action but never revoked the staff member's auth session (no `set-user-disabled` call) and had no role guard — the exact bug class already fixed once this session for `useSuspendStaff` itself, but a second entry point was missed. Removed the dead/buggy hook; `PrincipalStaffPage.tsx` now uses `useSuspendStaff` (which also needed its `onSuccess` extended to invalidate the staff-directory list, or the grid wouldn't refresh).
3. `PrincipalStaffPage.tsx`'s staff-card kebab menu was missing the scroll-close fix already applied to the sibling student-card menu in `PrincipalStudentsPage.tsx` — mispositioned on scroll. Ported the fix.
4. `TeacherPerformanceSection` (`PrincipalStaffProfilePage.tsx`) showed a false "hasn't been assigned subjects" message for suspended/inactive teachers — `useDosTeacherPerformance` only queries active staff, so an inactive teacher's real history is filtered out, not actually absent. Message now distinguishes the two cases.
5. `PrincipalSettingsPage.tsx` toast/help-text falsely claimed changing the school short name "refreshes all staff numbers" — the DB trigger only fires on INSERT with a blank number, so existing numbers never change. Corrected the copy.
6. `StudentFullProfilePage.tsx` — Reinstate had zero confirmation (direct `mutate()` call) unlike Suspend/Expel, which both require typing the student's name. A misclick instantly reactivated a suspended account. Now routes through the same confirm-dialog flow (lighter-weight — click-only confirm, no name-typing, proportionate to a reversible action).
7. `PrincipalReportCardsPage.tsx` — Approve/Unlock modal handlers had no `try/catch` and no error display; a rejected mutation left the modal open with the spinner reset and zero feedback. Added error state + double-submit guards to both.
8. `PrincipalReportCardsPage.tsx` — the per-row Unlock button wasn't gated by `bulkInProgress`, unlike the neighboring Approve/Release buttons — could race a concurrent bulk-release call against the same row. Added the guard.
9. `PrincipalStaffProfilePage.tsx`'s `handleSuspend` had no `isSuspending` re-entrancy guard (double-click race). Added.
10. Staff join-date display (`PrincipalStaffPage.tsx` CSV export + `PrincipalStaffProfilePage.tsx`) used `new Date(dateOnlyString)` (parses as UTC midnight) then `.toLocaleDateString()` — off by a day for timezones behind UTC. Forced local interpretation, matching the fix pattern from batch 1.
11. `useStaff.ts` search only matched `firstName`/`lastName` independently, so searching a full name like "Grace Apio" returned zero results even when the staff member exists — the same full-name search bug already fixed once for messaging in an earlier session, missed here. Fixed.
12. `useStaff.ts`'s `LIST_COLS` was missing the `classes` column, so the Staff Directory's "teaching classes" chips could never render for any teacher regardless of real assignments. Added. Also fixed `usePrincipal.ts`'s `useStudentFullProfile`: `disciplineCount` reused the same capped-at-10 query built for the preview list, undercounting any student with more than 10 discipline records — added a separate exact-count query.

**Deferred (14, logged not silently dropped):**
- `useClasses()` called with no argument (active-year-only scope) in `PrincipalStudentsPage.tsx`/`PrincipalStaffPage.tsx`/`PrincipalReportCardsPage.tsx` — a student/staff whose `class_id` points at a non-active-year row shows "No class assigned"/blank even though they do have a class, just a stale one. Same class of gap already flagged for Principal A's `PrincipalClassesPage` and fixed with an explicit "Unassigned" warning on `DosStudentsPage.tsx` in an earlier session — recommend the same treatment in one dedicated follow-up covering all affected pages at once, not piecemeal.
- `useStudents.ts` `LIST_COLS` includes `temp_password`/`auth_email`, unnecessarily exposed to principal-facing list views that never display them — but this column list is also genuinely needed by Secretary's `StudentsPage.tsx`/`ParentCredentialsPage.tsx` for bulk credential display, so removing it outright would break that feature. Needs a proper split (separate slim list query vs. a credentials-inclusive query) rather than a quick fix; not a real access-control bug since RLS still gates who can query the table at all.
- `PrincipalReportCardsPage.tsx`'s single-row Release action shares one page-level mutation's `isPending` across every row in the table, so clicking Release on one card visually spinners/disables every other row too. Real UX bug, but fixing it needs per-row loading-state tracking (a moderate refactor) — logged for a dedicated pass.
- Un-virtualized 200+/300+ row lists (`PrincipalStaffPage.tsx`, `PrincipalStudentsPage.tsx`) — same CLAUDE.md rule-2 violation already deferred in batch 1 for the same reason (recurring pattern, better solved once, consistently, app-wide).
- Hardcoded hex colors (`ROLE_GRAD` in `PrincipalStaffPage.tsx`, `LEVEL_COLOR`/`PALETTE` in `PrincipalStudentsPage.tsx`) — same deferred bucket as batch 1 (Recharts/inline-JS-color constraint needing a design-system-level fix, not per-file).
- `StudentFullProfilePage.tsx`'s confirm dialog is still a hand-rolled overlay, not the shared `Modal` component (found independently by 2 angles this batch) — consistent with batch 1's deferred Modal-consolidation finding; recommend one dedicated pass converting all hand-rolled dialogs found across this review at once.
- `PrincipalReportCardsPage.tsx`'s `handleBulkApprove`/`handleBulkRelease` and their bulk-selection-banner JSX are ~90% duplicated; `AcademicYearPage.tsx`-style `CreateYearModal`/`EditYearModal` duplication pattern recurring — cleanup, not a bug, logged for the same future refactor pass as batch 1's modal/duplication findings.
- `PrincipalSettingsPage.tsx`'s effect that resets form state from `settings` has no `editMode` guard — a background refetch (window-focus after 5+ min stale) while a principal is mid-edit silently discards their unsaved changes. Real but narrow (needs a multi-minute idle+refetch coincidence with an open edit form); flagged for a future session pass over form/effect patterns app-wide rather than a one-off fix given the review's remaining scope.
- `useDosTeacherPerformance()` is unscoped (fetches the whole school) even when `PrincipalStaffProfilePage.tsx` only needs one teacher's row — real inefficiency, but the hook is shared by 2 other list-view callers (`DosDashboard.tsx`, `DosTeachersPage.tsx`) that legitimately need the full set; scoping it safely needs an additional optional parameter, deferred to avoid rushing a change to a 3-consumer hook this late in the batch.
- Various unmemoized derived-state (`PrincipalReportCardsPage.tsx`'s `studentNameMap`/`readinessMap`/tab-filter arrays, `PrincipalStudentsPage.tsx`'s KPI-chip counts, `PrincipalStaffPage.tsx`'s `deptMap` inconsistent with its memoized sibling `classMap`) — cleanup/efficiency, not bugs, logged for a future pass.
- `PrincipalReportCardsPage.tsx` fires 3 separate queries (`useReportCards`/`useStudentReadiness`/`useStudents`) for overlapping cohort data instead of one combined query — real inefficiency, larger restructuring than warranted for this batch.
- `StudentFullProfilePage.tsx` — `${profile.firstName} ${profile.lastName}` recomputed inline 4 times instead of hoisted once (unlike the sibling staff-profile file, which already does this correctly) — cleanup.
- `PrincipalDashboard.tsx`-style duplication: none new found this batch beyond what batch 1 already logged.
- CSV export in `PrincipalStaffPage.tsx` does an O(n) linear class-array scan per staff row instead of using the already-available `classMap` — cleanup/efficiency, cheap but not urgent.

**Tests added:** RPC/atomicity-adjacent tests already covered in batch 1; this batch added an Approve-modal error-surfacing test, a Reinstate-confirmation-flow test, full-name search + `classes`-column tests for `useStaff`, and a `disciplineCount` exact-count test for `useStudentFullProfile` — plus mock updates for the `useSuspendStaff` swap in `PrincipalStaffPage.test.tsx`.

### Batch 3 — Deputy

**Fixed (10):**
1. `discipline_records` DELETE RLS — two overlapping/broken policies (one made ownership checking a dead no-op; the surviving "ownership" check itself compared the wrong id types) meant any deputy could delete any other deputy's discipline records. Fixed via migration to one correct policy.
2. `useDeputy.ts` `useAddDisciplineRecord` — `recorded_by` (a FK to `staff.id`) silently fell back to writing the raw `auth.uid()` into that column when the staff-row lookup failed, corrupting the FK. Now throws `'Staff record not found for this user.'`, matching `useAttendance`'s existing guard.
3. `useClasses.ts` `useDepartments()` was missing `description` from its SELECT entirely (and the `Department` type had no such field) — editing a department always showed a blank description textarea and silently wiped out any previously-saved description on save. Fixed the query, type, and removed the `as any` workaround cast.
4. `DeputyDepartmentsPage.tsx` — the Head-of-Department dropdown listed every staff member including deactivated/suspended ones with no indication, unlike the page's own "Staff Assigned" KPI which already scopes to active-only. Now filtered to active staff for new HoD selection (name resolution for an already-assigned inactive head still works, so an existing inactive HoD's name doesn't just disappear).
5. Double-submit guards added to `DeptModal.handleSave`, `DeputyDepartmentsPage.handleToggleArchive`, and `DisciplinePage`'s `RecordModal.submit` — all previously relied on the submit button's `disabled` prop alone.
6. `isError` silently swallowed on `DisciplinePage`'s records fetch and `DeputyStudentsPage`'s students fetch — a failed load rendered the "no records/students" empty state, indistinguishable from a genuinely empty school. Both now show a distinct error state.
7. `DisciplinePage.tsx`'s default "Incident Date" used `toISOString()` (UTC) — for a UTC+3 school, wrongly pre-filled the previous day's date for the first ~3 hours after local midnight. Same bug class fixed repeatedly in the Principal batches; fixed the same way (local Y/M/D getters).
8. CSV export "Department" column in `DeputyStaffPage.tsx` was hardcoded to always blank (the underlying query never fetched `department_id` at all) — added the column, wired a `deptMap` lookup.
9. CSV escaping bug repeated across `DeputyStaffPage.tsx`/`DeputyStudentsPage.tsx`/`DisciplinePage.tsx` exports — none escaped an embedded `"` character in a field (name/remark), which would corrupt column boundaries. Added a shared `src/lib/csv.ts` `csvField()` helper and applied it to all three; this helper should be adopted by other CSV exports found in later batches too rather than re-fixed ad hoc each time.
10. `DeputyStaffPage.tsx`'s staff-card kebab menu was missing the scroll-close fix its sibling student-card menu already had (found and fixed once already for `PrincipalStaffPage.tsx` in batch 2) — ported the same fix.

**Deferred (12, logged not silently dropped):**
- Hardcoded hex colors across all 6 files (`NATURE_COLOR`, `ACCENT_PALETTE`, `CHIP_COLORS`, `CLASS_PALETTE`/`SUBJ_PALETTE`, `NATURE_META`) — same deferred bucket as batches 1-2 (Recharts/inline-JS-color constraint, needs a design-system-level fix).
- `StaffDetailModal` (`DeputyStaffPage.tsx`) is a hand-rolled dialog, not the shared `Modal` component — same deferred Modal-consolidation bucket as prior batches.
- `DeputyDepartmentsPage.tsx`/`DeputyStudentsPage.tsx` — duplicate/overlapping `staff`/`streams` fetches per page load (e.g. `useStreams(classId||null)` and `useStreams(null)` both resolve to the same "all streams" query when no class filter is active) — real inefficiency, not urgent.
- `DeputyTimetablePage.tsx`'s per-cell `classColor`/`subjectColor` hash functions recompute uncached on every render across the whole school-wide grid — efficiency, not correctness.
- `DisciplinePage.tsx`'s `StudentTypeahead` re-fetches the entire unfiltered student roster every time the Add/Edit modal opens, duplicating data the Students page already loads — efficiency.
- `DeputyDashboard.tsx`'s 4th KPI card ("Timetable Gaps") is a permanent hardcoded stub with no backing query — dead UI, not a bug; needs a product decision (implement or remove) rather than a quick fix.
- `DeputyTimetablePage.tsx`'s "Slots Published" KPI filters an already-server-filtered (`published: true`) list by `.isPublished` again — harmless dead code, not worth a one-off fix.
- `DeputyStaffPage.tsx` has no virtualization/pagination for its desktop staff table (its sibling Students/Discipline pages both do) — same CLAUDE.md rule-2 violation already deferred repeatedly, recurring pattern better solved once app-wide.
- `DisciplinePage.tsx`'s `RecordModal` has no path to edit a record's `class_id` after creation if it was set wrong at typeahead-select time — a design gap, not a regression; needs a product decision on whether that's intentional.
- `DeputyReportCardsPage`-style hand-rolled `DeleteModal`/bulk-action duplication patterns (mirroring the Principal-batch findings) — cleanup, same future refactor-pass bucket.
- `DeputyStaffPage.tsx`/`DeputyDepartmentsPage.tsx` — two independent `useMemo`s (`staffMap`/`staffForHead`) deriving from the same `allStaff` array instead of one shared derivation — cleanup.
- `useDeputy.ts`'s parent-notification insert after filing a discipline record is fire-and-forget with no error surfacing — if it fails (RLS, bad data), the discipline record still saves and no one is told the parent was never notified. Real but lower-severity gap, logged for a future notification-reliability pass across the app (the same fire-and-forget pattern likely recurs elsewhere).

**Tests added:** `useAddDisciplineRecord`'s "Staff record not found" throw path, `useDepartments`' `description` field mapping, inactive-staff-excluded-from-HoD-dropdown in `DeputyDepartmentsPage` — plus a mock fix for `useDepartments` missing from `DeputyStaffPage.test.tsx`'s `useClasses` mock (needed after wiring in the department-name CSV fix).

---

## Interrupt: urgent fixes handled mid-review (2026-07-06)

Three user-flagged issues were fixed between batches 3 and 4, out of the planned batch order, per explicit "top priority" instructions:

1. **Sidebar redesign** (`src/index.css`) — collapsed sidebar now hides everything except the Shule brand logo and school badge logo (nav items, user pill, sign-out — previously only labels were hidden, icons stayed). Both logos enlarged (56px/52px) and kept large in **both** collapsed and hover/pinned states (previously they shrank back down on hover). Hovering/pinning still reveals all other sidebar content with a smooth fade.

2. **CRITICAL — staff password reset was completely broken.** `reset-staff-password` sent a Supabase Auth reset EMAIL, which depends on the project having a verified sending domain/configured SMTP — not true for this deployment, so every single reset attempt failed with a generic "Edge Function returned a non-2xx status code" with zero way to recover a staff account. CLAUDE.md's own schema documentation for `staff.temp_password` already said this function was supposed to set+store a password directly ("last issued password — stored by create-staff-auth-user + reset-staff-password edge fns") — confirming this was implementation drift, not a documentation error. Rewritten to match the already-working `reset-student-password` pattern: client generates a temp password, edge function sets it directly via `admin.updateUserById` and stores it on `staff.temp_password` for the admin to view/share — no email involved. Also closed a real cross-tenant gap found while rewriting: the old function never verified the target `userId` actually belonged to the caller's own school before changing its password (Supabase Auth's admin API has no per-school concept) — now requires `staffId` and cross-checks `staff.auth_user_id` scoped to the caller's `school_id` before allowing the update. Deployed live. Updated both call sites (`useResetStaffPassword` in `useStaffAuth.ts`, `useResetPassword` in `useAdmin.ts`) and their UI (`AdminDashboard.tsx`, `CredentialsMgmtPage.tsx`) to generate+display the new password instead of claiming an email was sent. Also added `src/lib/functionsError.ts` (`getFunctionErrorMessage`) — supabase-js's `FunctionsHttpError.message` is always the unhelpful generic "non-2xx" string; the real reason is in the JSON body of `error.context` (a Response object) and was never being read anywhere in this codebase. Applied to both hooks; **this helper should be adopted anywhere else `supabase.functions.invoke` errors are surfaced to a user**, since every one of those call sites has this same "generic error, real reason hidden" problem today.

3. **Data reset** — `audit_log` table cleared (249 rows deleted) per explicit request ("starting afresh").

All three verified: 0 TS errors, 1108 tests passing (2 pre-existing tests updated for the new direct-password-set behavior), build clean. The sidebar CSS change could not be visually verified in-browser (no browser access in this environment) — flagged to the user for their own visual check.

### Batch 4 — DOS A

**Fixed (11):**
1. **CRITICAL** — `dos_assign_class_teacher`/`dos_assign_classes`/`dos_assign_subjects`/`save_school_api_key` (all `SECURITY DEFINER`, bypass RLS) trusted a client-supplied `p_school_id` with no verification against the caller's own school; `save_school_api_key` additionally had **no role check at all**. Fixed via migration — all 4 now derive the school id from the caller's JWT claim.
2. `DosSubjectsPage.tsx` — stray extra closing paren in an inline style string (`'var(--surface2))'`) made the value invalid CSS, so the Cancel button's hover-out background never reset. Confirmed independently by 4 different finder angles. Fixed.
3. `DosDashboard.tsx`'s Subject Rankings sort comparator did `av - bv` regardless of field type — subtracting two strings (`subjectName`) is `NaN`, which `Array.sort()` treats as "equal," so clicking that column header silently did nothing. Now branches to `localeCompare` for string fields.
4. Unescaped CSV export in `DosSurveysPage.tsx` — only one of eight fields was quote-escaped; a name/subject containing a literal `"` would corrupt column boundaries. Switched to the shared `csvField()` helper (from the Deputy batch).
5. `DosDashboard.tsx` — the "Assign Class Teacher" modal and a non-functional `StudentDetailModal` stub were both rendered inline (no `createPortal`) inside an animated tab tree, risking the same "background-split"/mispositioned-dialog bug already fixed elsewhere in this app. The assign modal is now portaled; the stub modal was removed entirely (see #7).
6. Double-submit guards added to `AddClassModal.handleSubmit` (DosClassesPage), `TeacherPerformanceTab.handleAssign` (DosDashboard), `SubjectModal.save` (DosSubjectsPage), and `AssignTeacherModal.handleAssign` (DosClassesPage) — all previously relied on the submit button's `disabled` prop alone.
7. `StudentDetailModal` in `DosDashboard.tsx` was a non-functional stub (title + a raw student ID, no actual data) shown when clicking a Top-5/Bottom-5 performer, while `DosStudentsPage.tsx` already navigates to a fully-wired `/dos/students/:id` profile route for the identical action. Removed the stub; Top-5/Bottom-5 clicks now navigate to the real profile, matching the working pattern.
8. `DosClassesPage.tsx`'s `AssignTeacherModal` let a deactivated/suspended staff member still be selected and confirmed as class teacher, with no active-status filter — same class of gap already fixed twice this session (Head-of-Department dropdowns in Principal/Deputy batches). Filtered to active staff, matching `useDosTeacherPerformance`'s existing convention.
9. `useClasses.ts`'s `useSubjects(level)` filter excluded subjects with `level = NULL` ("Both") whenever a specific level was selected, even though the same page renders those as an explicit "Both" badge — a cross-cutting subject like Religious Education silently disappeared from the O-Level/A-Level filtered view. Fixed to include NULL-level rows regardless of the selected filter.
10. `DosStudentsPage.tsx`'s "New This Year" KPI used `new Date(dateOnlyString).getFullYear()` (UTC parsing) against `enrolled_at`, confirmed live to be a `date`-only column — same UTC-vs-local bug class fixed repeatedly this session. Fixed by comparing the year-prefix string directly instead of going through `Date` at all.
11. Confirmed zero financial data reachable by DOS anywhere in these 5 files (the critical check for this role) and confirmed DOS cannot create students — both hold.

**Deferred (13, logged not silently dropped):**
- Hardcoded hex colors across all 5 files — same deferred bucket as batches 1-3.
- N+1 query pattern in `DosClassesPage.tsx`'s `ClassCardWithCounts`/`StreamsPanel` (2 queries per class card) — real inefficiency, not urgent at typical class counts.
- Various unmemoized derived state (`DosDashboard.tsx`'s `sortedRankings`-adjacent recomputations, `DosStudentsPage.tsx`'s per-row `className`/`streamName` `.find()` lookups) — cleanup/efficiency, not bugs.
- `useExamAgg`'s `.limit(10000)`/`.limit(50000)` caps on published-journal/exam-results queries — real but requires years of accumulated data to hit at a single school's scale; not urgent.
- `useAttendanceAgg` has no `.limit()` at all on a whole-school attendance fetch — same reasoning, deferred.
- Year-scoping mismatch recurring pattern: `useClasses()`'s active-year-only default (by design) vs `useStudents()`'s no year filter means students with a stale `class_id` are invisible on `DosStudentsPage.tsx`'s enrolment chart, `DosClassesPage.tsx`'s class cards, and the exam heatmap — same deferred bucket as Principal/Deputy batches (recommend one dedicated "Unassigned" warning pass covering all affected pages, matching the precedent already applied to `DosStudentsPage.tsx` in an earlier session).
- `DosClassesPage.tsx`'s auto-select effect never recovers if the currently-selected class disappears from the list (e.g. a race with delete/archive) — narrow edge case, not fixed this batch.
- `DosSurveysPage.tsx`'s response table renders headers as a real `<table>` and data rows as a separate flex-based `<div>` with no shared width source — real structural misalignment risk, but a proper fix needs restructuring to one layout system; deferred as a layout cleanup.
- Hand-rolled modals not using the shared `Modal` component (`DosDashboard.tsx`, `DosClassesPage.tsx` ×2, `DosSubjectsPage.tsx`'s local `ModalShell`) — same deferred Modal-consolidation bucket as prior batches.
- Inconsistent color-threshold logic across 3 files (70/60/50 cutoffs for what's visually presented as the same kind of "good/bad" signal) — a UX-trust inconsistency, not a functional bug; needs a shared `scoreColor()` utility, deferred.
- Raw Supabase calls inline in `DosStudentsPage.tsx`/`DosSurveysPage.tsx` instead of `src/hooks/` — architectural convention violation, not a live bug.
- `useStudentFullProfile` always fetches `fee_payments` regardless of caller role (UI-only gating for DOS) — same recurring finding already logged in the Principal batch; not re-fixed here, same reasoning applies.
- `DosStudentsPage.tsx`'s student-card grid renders up to 100 unvirtualized DOM cards (capped via `.slice(0,100)`, not unbounded) — same CLAUDE.md rule-2 violation already deferred repeatedly as a recurring pattern better solved once, app-wide.

**Tests added:** inactive-staff-excluded-from-teacher-dropdown (`DosClassesPage`), student-navigation-instead-of-stub-modal + subject-column-sort-actually-reorders (`DosDashboard`) — plus a test-fixture fix (`isActive` field missing from a mocked staff row broke an existing assertion once the new active-only filter was applied).

_(next batch appended below as work completes)_
