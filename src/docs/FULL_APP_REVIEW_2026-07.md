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
| 1 | Principal A | AcademicYearPage, AuditLogPage, PrincipalAnalyticsPage, PrincipalDashboard, PrincipalClassesPage | done | 9 | 11 | (pending) |
| 2 | Principal B | PrincipalReportCardsPage, PrincipalSettingsPage, PrincipalStaffPage, PrincipalStaffProfilePage, PrincipalStudentsPage, StudentFullProfilePage | pending | | | |
| 3 | Deputy | DeputyDashboard, DeputyDepartmentsPage, DeputyStaffPage, DeputyStudentsPage, DeputyTimetablePage, DisciplinePage | pending | | | |
| 4 | DOS A | DosDashboard, DosClassesPage, DosStudentsPage, DosSubjectsPage, DosSurveysPage | pending | | | |
| 5 | DOS B | DosJournalsPage, DosTeachersPage, DosTimetablePage, DosCurriculumPage | pending | | | |
| 6 | Secretary A | StudentRegistrationWizard, StaffRegistrationWizard, StudentsPage, SecretaryStudentsPage, SecretaryStudentEditPage | pending | | | |
| 7 | Secretary B | ParentCredentialsPage, ReportCardsPage, ClassListPage, ImportDataPage | pending | | | |
| 8 | Secretary C | SecretaryDashboard, SecretaryReportsPage, SecretaryStaffPage, SchoolAtAGlancePage, FeeStatusPage | pending | | | |
| 9 | Bursar A | AddPaymentPage, FeeLedgerPage, FeeStructurePage, FeeReportsPage, SalaryPage | pending | | | |
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

_(next batch appended below as work completes)_
