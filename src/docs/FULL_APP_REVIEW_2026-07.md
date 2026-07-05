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
| 1 | Principal A | AcademicYearPage, AuditLogPage, PrincipalAnalyticsPage, PrincipalDashboard, PrincipalClassesPage | pending | | | |
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

## Findings Log

_(appended per batch as work completes)_
