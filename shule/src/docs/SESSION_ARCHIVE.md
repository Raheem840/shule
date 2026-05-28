# Session Archive — Sessions 001–012

Sessions moved here to keep CLAUDE.md under 300 lines.
For full detail read the git log or this file.

---

## Session 012 — Completion Pass Part 2 (2026-05-25)
- `SecretaryStaffPage.tsx`: virtualised with `useVirtualizer` (padding-row pattern)
- `AuditLogPage.tsx`: scroll-container approach (expandable rows incompatible with full virtualiser)
- New `SecretaryStudentEditPage.tsx` at `/secretary/students/:studentId`
- Bug fixes: `useMessaging.ts` unused import + `'insert'` lowercase fix

## Session 011 — Final Pre-Week-10 Pass (2026-05-24)
- Messaging realtime (`supabase.channel()`) + offline queue (`queueSync` when offline)
- Low-bandwidth mode: photos hidden in contacts, Recharts → table in PrincipalDashboard
- Secretary credentials re-auth gate: blur-to-reveal, copy after reveal, 5-min auto-lock
- DoS message templates with amber `[placeholder]` highlight
- Tests: 340 passing (28 test files). TypeScript: 0 errors.

## Session 010 — Week 10 Pages + Features (2026-05-24)
New hooks: `useTermProgress`, `useTimetableSlots`, `useTeacherEvents`, `usePrincipal`, `useProfile`, `useAdmin` additions.
New pages: `PrincipalDashboard`, `StudentFullProfilePage`, `AuditLogPage`, `SecretaryDashboard`, `TeacherDashboard`, `TeacherEventsPage`, `TeacherTimetablePage`, `DeputyTimetablePage`, `DosTimetablePage`, `ProfilePage`.
New component: `TermProgressTimeline` (wave fill, event dots, TODAY pulse, clickable popovers).
Nav: Teacher events + timetable; Bursar + IT Admin messaging links with unread badges.
AppShell: sidebar avatar → /profile; `NotificationBell`; `MessagingIcon`.

## Session 009 — Week 9 Bug Fix Pass (2026-05-24)
- `notifications.link` → `notifRoute()` helper for null links
- `staff.last_login_at` removed from queries (column doesn't exist)
- Photo upload moved to `onSuccess` callback (staffId needed for path)
- Exam journal CA columns added via SQL
- Staff credentials show in wizard after registration

## Session 008 — PWA + Dashboards + Messaging + Admin (2026-05-24)
Infrastructure: `vite-plugin-pwa`, Dexie `ShuleDatabase`, `syncQueue.ts`, `OfflineBanner`.
New types: `src/types/week9.ts`.
New hooks: `useDos`, `useDeputy`, `useMessaging`, `useAdmin`, `useNotifications`.
New pages: `DosDashboard`, `DeputyDashboard`, `MessagingPage`, `AdminDashboard`.
AppShell: OfflineBanner, NotificationBell, MessagingIcon.
Tests: 340 total (up from 290). Key: `vi.hoisted()` pattern for all mocks.

## Session 007 — Attendance + Portals (2026-05-24)
New hooks: `useAttendance`, `useParentPortal`, `useStudentPortal`.
New pages: `AttendancePage`, `ParentPortalPage`, `StudentPortalPage`.
Secretary: GenerateAccessModal + Portal button per student row.
Key: child switcher in React state (not URL — protects sibling IDs).

## Session 006 — Exam Journal + Mark Entry + Report Cards (2026-05-21)
New hooks: `useExamJournal`, `useExamResults`, `useTeacherRemarks`, `useReportCards`.
PDF utility: `reportCardPdf.ts` (jsPDF A4, school header, CBC grades, signatures).
New pages: `ExamJournalPage`, `MarkEntryPage`, `TeacherRemarksPage`, `ReportCardsPage`, `PrincipalReportCardsPage`.
Key: CA segmented input (0-3), 4 grade tabs, end_of_term grade null until report card generation.

## Session 005 — Stream Management + Parent Credentials Rewrite (2026-05-21)
- `employmentType` fixed: `part_time` → `volunteer`
- `ClassListPage`: AddStreamModal + MoveStudentModal
- `ParentCredentialsPage`: student-centric rewrite, virtualised, blur-to-reveal, re-auth gate

## Session 004 — Staff Wizard + Staff Page + Class List (2026-05-19)
New hooks: `useStaff`, plus `useCreateStream`/`useMoveStudent` in `useClasses`.
New pages: `StaffRegistrationWizard` (4-step, photo compress, MoES quals, NIN upload), `ClassListPage`, `ParentCredentialsPage`, `SecretaryStaffPage`.

## Session 003 — Types + UI Components + Student Wizard + Import (2026-05-19)
Built `src/components/ui/` (10 components). ImportWizard (5-step reusable). StudentRegistrationWizard (3-step). StudentsPage (virtualised). Key: ExcelJS (not SheetJS); `staleTime: 0` on admission numbers.

## Session 002 — AppShell + Design Token System (2026-05-17)
`index.css` full rewrite. `roleNav.ts`. `AppShell.tsx`. `App.tsx` routing skeleton.

## Session 001 — claude.ai Foundation (2025-05-17)
Full system design. Design system tokens. `shule-designs.html` + `shule-wireframes.html`. Auth system spec. Import wizard spec. Parent multi-student spec.
