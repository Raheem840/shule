# CLAUDE.md — Shule Project Memory

> This file is my living brain. I update it after every action, every session,
> every decision. It evolves daily. It is never static. Never skip updating it.

---

## Who I Am In This Project

I am Claude Code — a partner and mentor, not an autonomous builder.
My collaborator is learning while building a real product that will be used
by a real school in Uganda. I never write code and move on.
I explain what I wrote, why I wrote it, and what my partner should understand from it.
If I catch myself doing too much without teaching, I stop and explain first.

My counterpart is Claude (claude.ai) — another instance of the same model.
All design decisions, wireframes, color tokens, UI patterns, and architectural
choices made in claude.ai sessions are canonical. I treat those files as
approved specs and implement them faithfully without reinventing them.

### My Working Style
- I always search for latest docs before applying any library or API change
- I explain every non-obvious decision before writing the code
- I ask before making architectural choices that affect the whole system
- I update this file and THINKING.md after every session
- I treat my partner as a collaborator who is learning — not a client who just wants output
- I never dump a wall of code without walking through it
- I celebrate small wins — every working screen is a milestone

---

## Project: Shule — School Management System

### The One-Line Summary
A complete, offline-capable school management platform for secondary schools
in Uganda and East Africa. Each school owns their own installation on their own hardware.

### The Real Stakes
A Bursar's fee records. A teacher's exam marks. A parent's access to their child's results.
A Principal's audit trail. This is not a side project — a real school is waiting.

### The Problem Being Solved
Most Ugandan schools run on: Excel files scattered across staff laptops, paper registers,
MS Access databases with no backup, WhatsApp groups for staff communication, and manual
report cards that take 2–4 days to produce per term. Shule replaces all of that.

---

## Tech Stack — Non-Negotiable

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 18 + TypeScript + Vite                  |
| Styling     | Tailwind CSS v4                               |
| Database    | Supabase (PostgreSQL)                         |
| Auth        | Supabase Auth + custom JWT hooks              |
| Offline     | IndexedDB via Dexie.js                        |
| PDF         | jsPDF + jspdf-autotable                       |
| Charts      | Recharts                                      |
| Excel       | SheetJS (xlsx)                                |
| SMS         | Africa's Talking API                          |
| WhatsApp    | WhatsApp Cloud API (Meta)                     |
| PWA         | vite-plugin-pwa + Service Worker              |
| Icons       | Inline SVG ONLY — no emoji icons in UI        |
| Fonts       | Plus Jakarta Sans + Space Grotesk + JetBrains Mono |

---

## Design System — From claude.ai (Canonical, Do Not Reinvent)

### Color Tokens

```css
/* Light Mode (default) */
--brand:        #0d9488;   /* teal-600 — buttons, active nav */
--brand-dark:   #0f766e;   /* teal-700 — hover */
--brand-light:  #f0fdfa;   /* teal-50  — active bg */
--bg:           #f8fafc;
--surface:      #ffffff;
--surface2:     #f1f5f9;
--sidebar-bg:   #0f172a;   /* always dark even in light mode */
--border:       #e2e8f0;
--txt:          #0f172a;
--txt2:         #475569;
--txt3:         #94a3b8;

/* Semantic */
--success:      #10b981;   --success-bg: #d1fae5;
--warning:      #f59e0b;   --warning-bg: #fef3c7;
--danger:       #f43f5e;   --danger-bg:  #ffe4e6;
--info:         #0ea5e9;   --info-bg:    #e0f2fe;
--violet:       #8b5cf6;   --violet-bg:  #ede9fe;

/* Dark Mode — [data-theme=dark] on .ar root element */
--bg:           #070d1a;
--surface:      rgba(13,24,45,0.7);
--sb-bg:        rgba(6,16,38,0.95);  /* sidebar subtly shifts in dark */
--brand:        #0dd9c4;             /* brighter teal in dark */
```

### Typography
- Headings/KPIs: `Space Grotesk`, 700–900 weight
- Body/labels: `Plus Jakarta Sans`, 400–700 weight
- IDs/amounts/codes: `JetBrains Mono`

### Radius Scale
- `6px` — badges, small chips
- `10px` — inputs, buttons
- `14px` — cards, panels
- `20px` — modals, screen frames

### Theme Toggle
- `data-theme="dark"` on the `.ar` (app root) div — NOT on `<html>`
- Sidebar uses CSS token `var(--sb-bg)` — switches with everything else
- Transition: `background 0.25s, color 0.25s` on all themed elements

### Design Reference Files (read these before building any screen)
- `shule-designs.html` — palette section, Login, Principal Dashboard
- `shule-wireframes.html` — all 8 remaining role screens

---

## The 9 User Roles

| Role          | Finance Access      | Create Students | Avatar Color |
|---------------|--------------------|-----------------| -------------|
| principal     | Summary only        | Yes             | Amber        |
| deputy        | ZERO — hard block   | No              | Cyan         |
| dos           | ZERO — hard block   | No              | Violet       |
| secretary     | Status flag only    | Yes (primary)   | Pink         |
| bursar        | Full ledger+salary  | No              | Amber        |
| class_teacher | ZERO                | No              | Blue         |
| teacher       | ZERO                | No              | Blue         |
| student       | Own fees only       | No              | Teal         |
| parent        | Child fees only     | No              | Green        |
| it_admin      | None                | No              | Slate        |

### Finance Boundary — Absolute Rule
Deputy, DoS, Teacher, Class Teacher see ZERO financial data.
Enforced at BOTH route guard level AND Supabase RLS level.
A teacher who knows the URL `/fees/ledger` must hit a database-level wall.

---

## Folder Structure

```
src/
├── components/
│   ├── ui/          # Button, Input, Modal, Card, Badge, Table, DataTable
│   ├── layout/      # AppShell, Sidebar, TopBar, ProtectedRoute, AccessDenied
│   └── shared/      # StudentCard, FeeStatusBadge, RoleBadge, ImportWizard, etc.
├── pages/
│   ├── auth/        # LoginPage, ForgotPassword
│   ├── principal/
│   ├── deputy/
│   ├── dos/
│   ├── secretary/
│   ├── bursar/
│   ├── teacher/
│   ├── student/
│   └── parent/
├── hooks/           # useAuth, useStudents, useFees, useExams, etc.
├── lib/             # supabase.ts, queryClient.ts, utils.ts, db.ts (Dexie)
├── types/           # database.ts (Supabase generated), app.ts (custom)
├── store/           # AuthContext.tsx
└── docs/            # THINKING.md, RESEARCH.md, WEEKLY_PLAN.md
```

---

## Critical Feature Specs

### Import Column Mapping Wizard (Reusable)
Used for: student imports, staff imports, fee imports, mark imports.
It is ONE reusable component: `<ImportWizard context="fees" ... />`

**5-Step Flow:**
1. **Upload** — accept .xlsx/.xls/.csv/.ods, SheetJS parses headers + first 5 rows preview
2. **Column Mapping** — left: file headers, right: Shule fields
   - Auto-detect fuzzy matches: "Adm No" → `admission_number`, "Amount Paid" → `amount_paid`
   - Required fields marked ★ — cannot proceed without them
   - Optional fields can be set to "Skip this column"
   - Saved mapping templates: "Save as: School Fee Template" → reused next time
3. **Preview & Validation** — colour-coded rows:
   - Green = valid | Amber = warning (will update existing) | Red = error
   - Error list below table: "Row 4: Score 95 exceeds total marks 80"
4. **Conflict Resolution** — if duplicates found:
   - Update existing (upsert) | Skip duplicates | Cancel
   - Unknown admission numbers in marks import → option to auto-add or skip
5. **Import & Results** — batch insert (50 rows/batch), progress bar
   - Summary: "248 imported · 3 updated · 2 skipped · 1 failed"
   - Failed rows downloadable as Excel for correction

```typescript
type ImportWizardProps = {
  context: 'students' | 'staff' | 'fees' | 'marks'
  requiredFields: ColumnSpec[]
  optionalFields: ColumnSpec[]
  onComplete: (data: ParsedRow[]) => Promise<ImportResult>
  examJournalId?: string   // marks only
  term?: string            // fees only
  year?: number            // fees only
}
```

### Parent Multi-Student Access
One parent account → one login → multiple children.

**Database:**
```sql
CREATE TABLE parent_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES school_profile(id),
  email        TEXT NOT NULL,
  phone        TEXT,
  full_name    TEXT NOT NULL,
  student_ids  UUID[],   -- array of student IDs this parent can access
  auth_user_id UUID UNIQUE REFERENCES auth.users(id),
  created_by   UUID REFERENCES staff(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

**JWT Hook:** stamps `student_ids[]` array into parent's JWT claims alongside `user_role='parent'`.

**Portal UX:** Sidebar shows a child switcher dropdown when parent has multiple children.
Switching children re-fetches all data. `activeStudentId` lives in React state (not URL)
to avoid exposing sibling IDs in the address bar.

**Secretary workflow:**
- Create new parent account → links to student → sends magic link / temp password
- Link to existing account → adds student to their `student_ids[]`
- Credentials section → Secretary must re-authenticate to view/resend

---

## Auth System — Already Designed, Ready to Implement

### custom_access_token_hook (run in Supabase SQL Editor)
```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
DECLARE
  user_role       text;
  user_school     uuid;
  user_name       text;
  student_ids_arr uuid[];
BEGIN
  -- Check staff first
  SELECT s.role, s.school_id, s.first_name || ' ' || s.last_name
  INTO user_role, user_school, user_name
  FROM public.staff s
  WHERE s.auth_user_id = (event->>'user_id')::uuid;

  -- If not staff, check parent
  IF user_role IS NULL THEN
    SELECT 'parent', p.school_id, p.full_name, p.student_ids
    INTO user_role, user_school, user_name, student_ids_arr
    FROM public.parent_accounts p
    WHERE p.auth_user_id = (event->>'user_id')::uuid;
  END IF;

  IF user_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}',   to_jsonb(user_role));
    event := jsonb_set(event, '{claims,school_id}',   to_jsonb(user_school));
    event := jsonb_set(event, '{claims,full_name}',   to_jsonb(user_name));
    IF student_ids_arr IS NOT NULL THEN
      event := jsonb_set(event, '{claims,student_ids}', to_jsonb(student_ids_arr));
    END IF;
  END IF;

  RETURN event;
END; $;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook
  FROM authenticated, anon, public;
```

### AuthContext Shape
```typescript
type UserRole = 'principal'|'deputy'|'dos'|'secretary'|'bursar'|
                'class_teacher'|'teacher'|'student'|'parent'|'it_admin'

type AuthUser = {
  id: string
  email: string
  role: UserRole
  schoolId: string
  name: string
  studentIds?: string[]  // parent only
}
```

### Role → Home Route Mapping
```typescript
const ROLE_HOME: Record<UserRole, string> = {
  principal:     '/principal/dashboard',
  deputy:        '/deputy/dashboard',
  dos:           '/dos/dashboard',
  secretary:     '/secretary/dashboard',
  bursar:        '/bursar/dashboard',
  class_teacher: '/teacher/dashboard',
  teacher:       '/teacher/dashboard',
  student:       '/student/portal',
  parent:        '/parent/portal',
  it_admin:      '/admin/dashboard',
}
```

---

## Database Tables (20+) — Full List

See WEEKLY_PLAN.md Week 4 for creation order and RLS policies.
Key tables:
- `school_profile` ✅ | `staff` ✅
- `parent_accounts` (includes student_ids UUID[])
- `students` | `student_guardians`
- `departments` | `academic_years` | `classes` | `streams` | `subjects`
- `exam_journal` | `exam_results` | `attendance`
- `fee_structure` | `fee_payments`
- `report_cards` | `teacher_remarks`
- `messages` | `notifications` | `discipline_records`
- `curriculum_plan` | `sms_reminders` | `send_queue` | `sync_queue`
- `audit_log` | `parent_accounts`

---

## CBC Grade Formula (Implement Exactly)

```
max_points = assessed × 3
out_of_20  = (total_points / max_points) × 20
total      = out_of_20 + exam_out_of_80

A = 90–100  B = 75–89  C = 65–74  D = 50–64  E = 1–49
```

---

## What's Built — Confirmed

### Supabase
- [x] `school_profile` table
- [x] `staff` table (auth_user_id FK + role CHECK constraint)
- [x] Demo school: `id = '00000000-0000-0000-0000-000000000001'`

### React App
- [x] Vite + React + TypeScript running
- [x] Tailwind v4 configured
- [x] All npm dependencies installed
- [x] Folder structure created
- [x] `supabase.ts` + `queryClient.ts` + `types/app.ts`
- [x] Pushed to GitHub

### Design
- [x] `shule-designs.html` — palette, login, principal dashboard
- [x] `shule-wireframes.html` — all 8 role screens

---

## Immediate Next Actions (Week 3 — Resume Here)

1. Run `custom_access_token_hook` SQL in Supabase SQL Editor
2. Register hook: Supabase Dashboard → Authentication → Hooks → Custom Access Token
3. Create test staff user in Supabase Auth UI (email + password)
4. Insert staff row linking `auth_user_id`
5. Log in → verify JWT in browser: `supabase.auth.getSession()` → `app_metadata`
6. Implement `src/store/AuthContext.tsx`
7. Implement `src/components/layout/ProtectedRoute.tsx`
8. Wire `AuthProvider` into `main.tsx`
9. Implement `src/App.tsx` with role routing
10. Build `src/pages/auth/LoginPage.tsx`
11. Build `src/components/layout/AppShell.tsx` (Sidebar + TopBar + Outlet)
12. Build `ROLE_NAV` config object (different nav items per role)
13. Test all role redirects + AccessDenied for wrong roles

---

## My Rules — Always

### Before Any Code
1. Search latest docs for any library/API I'm about to use
2. Check for breaking changes (Supabase, Tailwind v4, RQ v5 all had major changes)
3. Confirm approach with my partner if it's architectural

### While Coding
1. Write TypeScript types FIRST — always
2. Explain every non-obvious line
3. Never `.select('*')` on large tables
4. Never render 50+ list rows without virtualisation
5. RLS before any page goes live
6. Never `SUPABASE_SERVICE_ROLE_KEY` in frontend

### After Each Task
1. Tell partner what was built
2. Explain what they should understand from it
3. Update CLAUDE.md session log
4. Update THINKING.md if architectural decision was made
5. Update RESEARCH.md if I found new docs/info

### Security — Non-Negotiable
- Every table: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
- Finance tables: bursar + principal only, enforced at DB
- Teachers: cannot INSERT/UPDATE students — DB-level block
- `school_registry`: DENY ALL for school JWTs, service_role only
- API keys: Supabase Vault — never .env, never frontend
- Never link to `/admin` from school-facing pages

---

## Session Log

### Session 012 — Completion Pass Part 2 (Complete)
**Date:** 2026-05-25
**Tests:** 340 passing (unchanged)

**Virtualisation:**
- `SecretaryStaffPage.tsx`: wired `useVirtualizer` (padding-row pattern — top/bottom empty `<tr>` rows compensate for offscreen items; scroll container `div ref={parentRef}` wraps the `<tbody>` table, thead stays sticky above it)
- `AuditLogPage.tsx`: both DbEventsTab and MessageLogTab get `maxHeight: 600, overflowY: 'auto'` scroll containers with `position: sticky` thead headers — full virtualisation skipped because rows are expandable (variable height) and limit is already capped at 200 via query

**New page: `SecretaryStudentEditPage.tsx`:**
- Route: `/secretary/students/:studentId`
- Loads student via `useStudentById`; populates form on load
- Three sections: Personal Information, Academic Placement, Medical Notes
- Class → stream cascade (changing class resets stream and refreshes stream dropdown)
- Save via `useUpdateStudent`; dirty flag → Save Changes button enabled/disabled
- Success flash banner, error banner
- Status badge (active/suspended/expelled) shown in page header
- Cancel navigates back to `/secretary/students`

**App.tsx:**
- Added lazy import + route for `SecretaryStudentEditPage` at `/secretary/students/:studentId`

**AppShell.tsx:**
- Wrapped `<NotificationBell />` in `<ErrorBoundary fallback={null}>` (pre-existing ErrorBoundary import)

**Bug fixes in files from previous sessions:**
- `useMessaging.ts`: removed unused type import `ROLE_SENIORITY` from `week9` types (was imported as type but already imported as value)
- `useMessaging.ts`: fixed `'INSERT'` → `'insert'` in `queueSync` call (type is lowercase union)

**Key decisions:**
- Virtualisation with expandable rows: skipped full virtualizer for AuditLogPage because inserting detail `<tr>` rows between virtual rows requires tracking expanded row heights and re-computing positions — overcomplicated for a 200-row admin tool. Scroll container gives the same UX benefit.
- Padding-row technique: two empty `<tr>` rows (top + bottom) absorb the height of out-of-viewport rows, keeping the native `<table>` layout intact without `position: absolute` on rows (which breaks table layout)
- Student edit form is intentionally a flat page (not a multi-step wizard) — editing is a different mental model from registering; secretaries need all fields visible at once to correct errors

### Session 011 — Final Pre-Week-10 Completion Pass (Complete)
**Date:** 2026-05-24
**Tests:** 340 passing (unchanged)

**Parts completed:**

**Part 7 — Messaging Realtime + Offline Queue:**
- `src/hooks/useMessaging.ts`: Added `useEffect` + `supabase.channel()` subscription to `useMessages` hook. Subscribes to `postgres_changes` INSERT on `messages` table filtered by `school_id`. Skips messages not in the current thread. Calls `qc.setQueryData` for instant delivery (deduplicates by id). Also invalidates `unread-count` and `contacts` queries. Cleans up channel on unmount.
- `useSendMessage` now queues to IndexedDB (`queueSync`) when `!navigator.onLine` instead of throwing.
- `src/test/hooks/useMessaging.test.tsx`: Added `channel`/`removeChannel` to Supabase mock, `queueSync` mock from `lib/db`.

**Part 8 — Notices tab wired (already complete from prior session)**

**Part 9 — Low-bandwidth mode:**
- `src/pages/shared/ProfilePage.tsx`: Added `useBandwidth` import + toggle toggle card at bottom (animated toggle switch, shows "Active/Off" state).
- `src/pages/shared/MessagingPage.tsx`: `ContactItem` respects `isLowBandwidth` — shows initials instead of photo when true. Removed unused `useVirtualizer` import.
- `src/pages/principal/PrincipalDashboard.tsx`: `TopClassesChart` renders a plain HTML table (class/passRate/avgScore) when `isLowBandwidth`, otherwise renders Recharts BarChart.

**Part 10 — Secretary credentials re-auth gate:**
- `src/pages/secretary/ParentCredentialsPage.tsx`: Rewrote `ViewCredentialsModal` — after re-auth success:
  - Each sensitive field (email, temp password) starts blurred (`filter: blur(5px)`, `userSelect: none`)
  - Click-to-reveal eye toggle per field (show/hide)
  - Copy button only appears after field is revealed
  - 5-minute auto-lock countdown displayed (turns red under 60s)
  - `useEffect` clears both `setTimeout` and `setInterval` on unmount
  - Auto-relocks: resets to auth step, clears revealed set

**Part 11 — DoS message templates:**
- `src/pages/shared/MessagingPage.tsx`: Added `DOS_TEMPLATES` constant (4 templates: exam schedule reminder, grade submission deadline, class teacher assignment, end of term notice). Each template has `[placeholder]` tokens.
- `HighlightedTemplate` component renders placeholders in amber highlight.
- Template dropdown button (document-icon) appears only when `user.role === 'dos'` in `ChatThread`.
- Clicking a template inserts it into the textarea and closes the dropdown.
- Dropdown renders above the input via `position: absolute; bottom: 100%`.

**Part 12 — AuditLogPage Message Log tab (already complete from prior session)**

**Part 13 — Promote All Students (already complete from prior session)**

**Part 14 — DoS Surveys page (already complete from prior session)**

**Part 15 — Final checks:**
- TypeScript: 0 errors (`tsc --noEmit`)
- Tests: 340 passing (28 test files)
- Vite build: clean (PWA service worker generated, 87 precache entries)

### Session 010 — Week 10 Missing Pages + New Features Pass (Complete)
**Date:** 2026-05-24
**Tests:** 340 passing (unchanged)

**New Hooks:**
- `src/hooks/useTermProgress.ts` — `useTermProgress()`: queries active academic year, detects current term from term1/2/3 dates, fetches exam_journal events + school_events (catches 42P01 if school_events missing), returns `TermProgress` with events array. Exports `TERM_EVENT_COLOR`.
- `src/hooks/useTimetableSlots.ts` — All new timetable hooks against `timetable_slots` table (distinct from old `timetable` table in useDeputy): `useTimetableSlots(term, year)`, `useTeacherTimetable()`, `useCreateTimetableSlot()`, `useCheckCollision()`, `usePublishTimetable()`. Resolves subject+teacher names in bulk after fetch.
- `src/hooks/useTeacherEvents.ts` — `useTeacherEvents()` (school_events filtered by created_by=staffRow.id), `useCreateEvent()`, `useJournalEvent()`.
- `src/hooks/usePrincipal.ts` — `usePrincipalKpis()` (8 parallel queries), `useAuditLog()` (catches 42P01 table-not-exist), `useStudentFullProfile()`, `useStaffFullProfile()`, `useSuspendStudent()`, `useExpelStudent()`, `useSuspendStaff()`.
- `src/hooks/useProfile.ts` — `useMyProfile()`, `useUpdateProfile()`, `useUpdateProfilePhoto()` (Canvas compress → upload to staff-photos/{schoolId}/{staffId}.jpg).
- Added to `src/hooks/useAdmin.ts`: `useDeleteUser()` (deletes staff row + calls delete-staff-user Edge Function), `useStorageBuckets()` (lists Supabase storage buckets + file counts + sizes via .list()).

**New Types (`src/types/week9.ts` additions):**
- `TermEventType`, `TermEvent`, `TermProgress`, `SchoolEvent`, `TimetableSlot`
- `PrincipalKpis`, `TopClass`, `FeeSummary`, `AuditEntry`, `StaffFullProfile`

**New Components:**
- `src/components/shared/TermProgressTimeline.tsx` — Wave fill animation, event dots (red=exam, amber=CA, blue=AoI, green=general), TODAY line with pulse, clickable popovers (title, subject, class, date, type badge). Injected `@keyframes shule-wave-scroll` via `<style>` JSX tag (no pseudo-elements, inline-style-only codebase).

**New Pages:**
- `src/pages/principal/PrincipalDashboard.tsx` — TermProgressTimeline + 6 KPI cards (pending approvals badge + click-to-navigate) + Quick Actions + Top 5 Classes BarChart + Fee Collection Summary + Recent Activity (audit log + discipline records).
- `src/pages/principal/StudentFullProfilePage.tsx` — Full student profile: photo/initials, personal info, exam results (last 20, virtualised), attendance rate bar, fee totals only (no line items — finance isolation enforced), discipline records. Suspend/Expel with confirm dialog (type full name).
- `src/pages/principal/AuditLogPage.tsx` — Filters (action, role, date range), CSV export, expandable rows with before/after JSON diff.
- `src/pages/secretary/SecretaryDashboard.tsx` — TermProgressTimeline + 3 KPI cards (students, staff, classes) + Quick links.
- `src/pages/teacher/TeacherDashboard.tsx` — TermProgressTimeline + upcoming events preview (first 3) + Quick links (Events, Exam Journal, Attendance, Timetable, Messages).
- `src/pages/teacher/TeacherEventsPage.tsx` — CreateEventModal, EventCard with "Journal It →" for past unjournaled events (navigates to /teacher/exams with state prefill), collapsible past events.
- `src/pages/teacher/TeacherTimetablePage.tsx` — Read-only, shows teacher's own slots only via useTeacherTimetable.
- `src/pages/deputy/DeputyTimetablePage.tsx` — Read-only, shows only is_published=true slots.
- `src/pages/dos/DosTimetablePage.tsx` — Full @dnd-kit grid: SlotChip (useDraggable), TimetableCell (useDroppable), handleDragEnd (delete old + create new), AssignModal with collision check.
- `src/pages/shared/ProfilePage.tsx` — Clickable photo (camera overlay), read-only identity block, editable phone/email (save button appears on dirty), password change form.

**Updated Pages:**
- `src/pages/dos/DosDashboard.tsx` — Added TermProgressTimeline
- `src/pages/deputy/DeputyDashboard.tsx` — Added TermProgressTimeline
- `src/pages/bursar/BursarDashboard.tsx` — Added TermProgressTimeline
- `src/pages/admin/AdminDashboard.tsx` — Added: storage-per-bucket table in SystemKpisSection, delete-user modal (type "DELETE" to confirm) in UserManagementSection, live brand colour preview in SchoolSettingsSection.

**Routing (`src/App.tsx`):**
- `/principal/dashboard` → PrincipalDashboard
- `/principal/audit` → AuditLogPage
- `/principal/students/:studentId` → StudentFullProfilePage
- `/secretary/dashboard` → SecretaryDashboard
- `/teacher/dashboard` → TeacherDashboard
- `/teacher/events` → TeacherEventsPage (new)
- `/teacher/timetable` → TeacherTimetablePage (new)
- `/deputy/timetable` → DeputyTimetablePage
- `/dos/timetable` → DosTimetablePage
- `/profile` → ProfilePage (all staff roles)

**Nav (`src/config/roleNav.ts`):**
- Teacher/class_teacher: added "My Events" (/teacher/events) + "My Timetable" (/teacher/timetable)
- Bursar: added "Messages" with badge: 'alert'
- IT Admin: added "Messages" with badge: 'alert'
- All messaging nav items: badge: 'alert' added uniformly

**AppShell (`src/components/layout/AppShell.tsx`):**
- Sidebar: unread count from useUnreadCount shown on messaging nav items (replaces "!" for msg items when count > 0)
- Sidebar avatar click → navigate('/profile') for staff roles
- TopBar avatar click → navigate('/profile') for staff roles
- `PROFILE_ROLES` set constant gates who gets /profile navigation

**Key decisions:**
- Old `timetable` table (useDeputy.useTimetable) is untouched — new `timetable_slots` hooks are in a separate file to avoid any risk of breaking existing tests
- `/principal/audit` kept as the route (not /audit-log) to match existing roleNav.ts nav item path
- Profile nav: clicking the avatar/user pill navigates to /profile instead of sign-out. Sign-out is removed from sidebar for staff roles (student/parent still gets default sign-out behavior)
- Delete user modal: requires typing "DELETE" exactly (case-sensitive) to enable the confirm button; calls delete-staff-user Edge Function for full auth account deletion

### Session 009 — Week 9 Bug Fix Pass (Complete)
**Date:** 2026-05-24
**Tests:** 340 passing (unchanged)

**Bug 1 — notifications.link column (400 Bad Request)**
- SQL run by user added `link TEXT` column to `notifications` table — select in `useNotifications` is correct
- `AppShell.tsx`: Added `notifRoute(type, role)` helper mapping `NotificationType` → default route; updated `NotificationBell` to accept `role` prop and use `navigate(link ?? notifRoute(type, role))` — notifications now always navigate somewhere even if `link` is null

**Bug 2 — staff.last_login_at missing (400 Bad Request)**
- Removed `last_login_at` from both `useSystemKpis` and `useUserManagement` selects in `useAdmin.ts`; the column is not in the allowed staff schema
- `activeToday` set to `0` (requires future `last_login_at` column addition); `lastLogin` in `UserRow` set to `null`
- SQL run by user added `join_date` and `is_active` columns; no further code changes needed for those

**Bug 3 — photo upload path missing staffId**
- `StaffRegistrationWizard.tsx`: Moved photo upload out of `onSubmit` (where staffId is unknown) into the `onSuccess` callback (where staffId is available); path is now `staff-photos/{schoolId}/{staffId}.jpg` per spec
- Bucket name `staff-photos` was already correct; user confirmed bucket created in Supabase Storage

**Bug 4 — exam journal CA columns (400 Bad Request)**
- SQL run by user added all missing CA columns (`ca_label`, `ca_component`, `ca_weighting`, `learning_area`, `competency`, `integration_theme`, `trade_area`, `dit_module_code`, `status`) to `exam_journal`
- `ca_weighting` uses `z.coerce.number()` in zod schema — no code fix needed

**Bug 5 — StaffRegistrationWizard placeholder credentials message**
- Added `CredRow` helper component with copy-to-clipboard button
- Added `creds` state `{ email, password }` that is set in `onSuccess` callback
- After successful registration: calls `create-staff-auth-user` Edge Function (non-blocking), shows green credential panel with email + `Shule@2025` and copy buttons
- Footer switches to "Done — Close" button when credentials are showing
- `creds` resets when modal closes

**Bug 6 — Proactive sweep**
- 6C: `startSyncListener()` confirmed in `main.tsx` ✓
- 6D: `<OfflineBanner />` confirmed in `AppShell.tsx` above TopBar ✓
- 6H: `report-cards` bucket (with hyphen) confirmed in `useReportCards.ts` ✓
- 6A/B/E/F/G: All DB-level (RLS, FK, JWT hook) — confirmed user ran the SQL manually

### Session 008 — Week 9 PWA + DoS/Deputy Dashboards + Messaging + Admin + Notifications (Complete)
**Date:** 2026-05-24
**Completed this session:**

**Infrastructure (PWA + Offline):**
- `vite.config.ts` — installed `vite-plugin-pwa`, configured `VitePWA` with `autoUpdate`, `NetworkFirst` for `*.supabase.co/*`, `CacheFirst` for static assets; guarded with `mode !== 'test'` to prevent vitest interference
- `src/lib/db.ts` — Dexie `ShuleDatabase` with 5 tables (`students`, `staff`, `exam_marks`, `attendance`, `sync_queue`); exported `queueSync()` helper that writes to `sync_queue` with `status: 'pending'`
- `src/lib/syncQueue.ts` — `flushSyncQueue()` reads pending items, upserts to Supabase, marks `synced`/`failed`; `startSyncListener()` wires `window.online` → flush
- `src/components/shared/OfflineBanner.tsx` — amber offline banner (`data-testid="offline-banner"`), green flash 3s on reconnect (`data-testid="online-banner"`), null when online
- `src/main.tsx` — added `startSyncListener()` call before render

**Types:**
- `src/types/week9.ts` — all Week 9 types: `Notification`, `DisciplineRecord`, `TimetablePeriod`, `CurriculumTopic`, `Announcement`, `Contact`, `ROLE_SENIORITY`, `DosOverview`, `DosClassPerformance`, `TeacherPerfRow`, `SystemKpis`, `UserRow`, `SchoolSettings`, `ApiConfig`

**Hooks:**
- `src/hooks/useDos.ts` — `useDosOverview()` (4 parallel queries → pass rate, subject rankings, trend, teacher count); `useDosClassPerformance(classId)` (per-subject pass rates, top5/bottom5 students); `useDosTeacherPerformance()`; `useDosCurriculumPlan()`; `useAssignClassTeacher()` (checks for existing class teacher, throws if conflict)
- `src/hooks/useDeputy.ts` — `useDeputyOverview()` (class attendance summaries, `isBelowThreshold` at <80%); `useDisciplineRecords()`; `useAddDisciplineRecord()`; `useTimetable()`
- `src/hooks/useMessaging.ts` — `useContacts()` (ROLE_SENIORITY ordered); `useMessages(contactId)` (bidirectional, refetch 15s); `useSendMessage()`; `useMarkRead()`; `useAnnouncements()` (refetch 30s); `usePostAnnouncement()` (throws if role not in `ANNOUNCEMENT_POSTER_ROLES`); `useUnreadCount()`; `useUploadAttachment()` (5MB limit)
- `src/hooks/useAdmin.ts` — `useSystemKpis()` (Dexie sync_queue + navigator.storage.estimate); `useUserManagement()`; `useResetPassword()` (Edge Function `reset-staff-password`, hardcoded `Shule@2025`); `useDeactivateUser()`; `useSchoolSettings()`; `useSaveApiConfig()` (Vault RPC — never plain text); `useApiConfigStatus()` (returns enabled flags only, key values always null); `useAcademicYears()`; `useToggleSurvey()`
- `src/hooks/useNotifications.ts` — `useNotifications()` (school_id + user_id + read_at IS NULL, limit 10); `useMarkNotificationsRead()`

**Pages:**
- `src/pages/dos/DosDashboard.tsx` — 4 Radix tabs: Overview (KPIs + LineChart pass rate trend + subject rankings table), Class Performance (class selector + subject breakdown + top/bottom 5 modal), Teacher Performance (virtualised), Curriculum Plan; StudentDetailModal is read-only, NO finance data
- `src/pages/deputy/DeputyDashboard.tsx` — 3 Radix tabs: Academic Overview (class attendance + below-80% flags), Discipline (virtualised, AddDisciplineRecord modal, ImportWizard reuse, CSV export), Timetable (period×day grid)
- `src/pages/shared/MessagingPage.tsx` — 260px contact panel (Announcements pinned top, staff by seniority, unread badges); ChatThread (read receipts ✓/✓✓, file attach, auto-scroll, mark-read on open); AnnouncementsChannel (role-restricted post input)
- `src/pages/admin/AdminDashboard.tsx` — 3 Radix tabs: System KPIs, User Management (virtualised, password reset modal), School Settings (profile, API keys masked after save, survey toggle)

**AppShell (`src/components/layout/AppShell.tsx`):**
- `<OfflineBanner />` above TopBar
- `<NotificationBell />` — last 10 unread dropdown, navigate on click, mark all read, close on outside click
- `<MessagingIcon />` — staff roles only, shows unread badge, navigates to role's messages path

**App.tsx:** wired `/dos/dashboard` → `DosDashboard`, `/deputy/dashboard` → `DeputyDashboard`, `/admin/dashboard` → `AdminDashboard`, all `*/messages` routes → `MessagingPage`

**Tests (340 total, all passing — up from 290):**
- `src/test/pwa/offlineBanner.test.tsx` — 9 tests: OfflineBanner renders, offline/online transitions, queueSync fields (tableName, actionType, status, payload, createdAt)
- `src/test/hooks/useNotifications.test.tsx` — 6 tests: typed objects, empty array, RLS boundary, null user guard, error state, mark-read mutation
- `src/test/hooks/useDos.test.tsx` — 9 tests: pass rate calculation, zero-results case, subjects below 50%, absent exclusion, useAssignClassTeacher conflict detection, useDosClassPerformance subject breakdown + pass rate + top/bottom students
- `src/test/hooks/useDeputy.test.tsx` — 9 tests: attendance summaries, 80% threshold boundary, discipline records mapping, useAddDisciplineRecord, useTimetable
- `src/test/hooks/useMessaging.test.tsx` — 11 tests: useMessages idle/data, useSendMessage, useMarkRead, usePostAnnouncement role restriction (teacher/class_teacher blocked, principal/dos succeed), useAnnouncements shape, useUnreadCount
- `src/test/hooks/useAdmin.test.tsx` — 7 tests: useUserManagement mapping, useResetPassword Edge Function call + error, useSchoolSettings, useSaveApiConfig Vault RPC (verifies no plain text), useApiConfigStatus (key values always null)

**Key decisions:**
- `vi.hoisted()` pattern used for all mocks — resolves Vitest's hoisting order requirement for vi.mock factories
- `makeBuilder` exported from `vi.hoisted()` block in useDos.test + restored in `beforeEach` — prevents `useAssignClassTeacher` test's `mockImplementation` override from bleeding into subsequent describe blocks
- Finance isolation maintained: DoS/Deputy dashboards have NO fee/payment queries; StudentDetailModal explicitly excludes finance data
- API keys go through `save_school_api_key` RPC (Vault, SECURITY DEFINER) — never stored in `school_profile` columns directly
- `useApiConfigStatus` returns `{ atEnabled, waEnabled, atApiKey: null, waAccessToken: null }` — key values are permanently null at the frontend layer

### Session 007 — Week 8 Attendance + Parent Portal + Student Portal + Portal Access (Complete)
**Date:** 2026-05-24
**Completed this session:**

**Types (`src/types/app.ts`):**
- Added `surveyActive: boolean` to `AcademicYear` — DoS toggles this to open end-of-term survey for students
- Added `AttendanceSummary` type: `{ studentId, totalDays, presentDays, absentDays, lateDays, excusedDays, rate, isBelowThreshold }` — used by portals and attendance page

**Hooks:**
- `src/hooks/useAttendance.ts` — `useAttendance(classId, date)` returns `Map<studentId, AttendanceStatus>`; `useClassTermAttendance(classId)` returns per-student rates for below-80% panel; `useAttendanceSummary(studentId)` for portal stats; `useStudentAttendanceHistory(studentId)` last 90 days for portal timeline; `useSaveAttendance()` uses delete+re-insert pattern (avoids unique constraint complexity)
- `src/hooks/useParentPortal.ts` — `useParentStudents()` loads children from JWT `student_ids[]`; `useStudentReleasedReportCards`, `useStudentExamSummary`, `useStudentFeeBalance` (all RLS-scoped); `useGenerateParentAccess()` auto-generates `parent.[admno]@[shortname].ug` + `Parent@2025`, returns existing credentials if account already exists
- `src/hooks/useStudentPortal.ts` — `useMyStudentRecord()` finds student row by `auth_user_id`; `useMyExamResults`, `useMyFeeBalance`, `useMyReleasedReportCards`; `useIsEndOfTermSurveyActive()` checks `academic_years.survey_active`

**Pages:**
- `src/pages/teacher/AttendancePage.tsx` — `/teacher/attendance`: date picker, class + stream selectors, summary KPI tiles (4 statuses), virtualised student grid with 4-status toggle (Present/Absent/Late/Excused per row), below-80% warning panel at bottom listing at-risk students
- `src/pages/parent/ParentPortalPage.tsx` — `/parent/portal`: child switcher dropdown (if >1 child in JWT), 4 tabs: Results (grouped by term, absent rows highlighted) | Fee Balance (KPI tiles + table with status badges) | Attendance (rate bar + 90-day history) | Report Cards (PDF download links)
- `src/pages/student/StudentPortalPage.tsx` — `/student/portal`: student info card, 4 tabs matching parent portal view + conditional Survey tab (violet dot indicator) when `survey_active = true`

**Secretary — StudentsPage (`src/pages/secretary/StudentsPage.tsx`):**
- Added `GenerateAccessModal`: calls `useGenerateParentAccess`, shows result with copy-to-clipboard for email + password; returns existing credentials if already generated
- Added "Portal" action button per student row (violet, beside View/Edit)

**App.tsx:**
- Wired: `/teacher/attendance` → `AttendancePage`, `/parent/portal` → `ParentPortalPage`, `/student/portal` → `StudentPortalPage`

**Tests (290 total, all passing):**
- `src/test/hooks/useAttendance.test.tsx` — 11 tests: Map return, disabled states, rate calculations, below-80% threshold, delete+re-insert error handling
- `src/test/components/ParentPortal.test.tsx` — 13 tests: empty studentIds disables hook, data isolation (RLS boundary), fee status (paid/partial/unpaid), report card mapping
- `src/test/components/StudentPortal.test.tsx` — 13 tests: auth_user_id scoping, own fee/result/report data, survey_active flag
- `src/test/unit/qualificationWarning.test.ts` — 20 tests: MoES lower/upper secondary thresholds, boundary conditions, mixed class assignments, unknown class handling

**Other:**
- `StaffRegistrationWizard.tsx`: exported `getQualWarning` (was private) so unit tests can import it directly

**Key decisions:**
- `delete + re-insert` for attendance saves — avoids needing to know the unique constraint shape; non-atomic but recoverable since the UI prevents partial saves
- Parent portal child switcher: lives in URL-free React state (`activeChildId`) to avoid exposing sibling IDs in the address bar (per original spec)
- `useGenerateParentAccess`: checks `parent_accounts.student_ids @> [student.id]` before inserting — idempotent, Secretary can click "Portal" multiple times safely
- Survey tab: only appears in the tab bar when `survey_active = true`; shows a violet indicator dot on the tab label
- TypeScript: 0 errors. 290 tests passing.

### Session 006 — Week 7 Exam Journal + Mark Entry + CBC Report Card Generator (Complete)
**Date:** 2026-05-21
**Completed this session:**

**Types (`src/types/app.ts`):**
- Extended `ExamJournal` with: `status`, `learningArea`, `competency`, `integrationTheme`, `tradeArea`, `ditModuleCode`, `caComponent`, `caWeighting`, `caLabel` (all conditional fields per assessment type)
- Updated `ExamResult`: `score` is now `number | null` (absent students), added `isAbsent: boolean`, `grade` is now nullable (end_of_term grade only calculated at report card generation)
- Extended `ReportCard` with: `approvedBy`, `releasedBy`, `unlockReason`
- Added new `TeacherRemark` type

**Hooks (all in `src/hooks/`):**
- `useExamJournal.ts` — `useExamJournals(filters)`, `useExamJournalById`, `useNextCALabel` (auto-increments C1/C2/C3 by counting existing CA entries for same subject+class+term+year), `useCreateJournal`, `usePublishJournal`
- `useExamResults.ts` — `useExamResults(journalId)`, `useSaveMarks` (UPSERT with grade auto-calculated per assessmentType; end_of_term grade saved as null), `useAllStudentResults` (used by report card generator — joins exam_journal details)
- `useTeacherRemarks.ts` — `useTeacherRemarks(params)` returns `Map<studentId, TeacherRemark>`, `useRemarksByStudents` (used by report card generator), `useSaveRemarks`
- `useReportCards.ts` — `useReportCards`, `useStudentReadiness` (checks CA marks/end_of_term marks/remarks per student), `useGenerateReportCards` (full PDF pipeline), `useApproveReportCard`, `useReleaseReportCard`, `useUnlockReportCard`, `useNotifyPrincipal`

**PDF utility (`src/lib/reportCardPdf.ts`):**
- `generateReportCardPDF(data)` — full jsPDF A4 layout matching spec exactly: school header, student info, dynamic CA columns (max CA count across subjects), ACADEMIC PERFORMANCE table with autoTable, OVERALL PERFORMANCE, ATTENDANCE, CLASS TEACHER'S REMARKS, PRINCIPAL'S REMARKS, footer with signatures
- `buildSubjectRows(results, subjectNames)` — groups raw exam_results by subject, separates CA from end_of_term, calls `calcCBC()`, returns `SubjectPdfRow[]`

**Pages:**
- `src/pages/teacher/ExamJournalPage.tsx` — `/teacher/exams`: list + CreateJournalModal (all 9 assessment types, conditional AOI/DIT/CA fields, CA auto-label shown in banner)
- `src/pages/teacher/MarkEntryPage.tsx` — `/teacher/exams/:journalId/marks`: virtualised mark table, CA segmented button (0/1/2/3), number input for others, absent toggle, grade auto-display, score distribution BarChart with pass reference line, 4 grade tabs (Exceptional/Passed/Needs Improvement/Poor per UNEB grouping)
- `src/pages/teacher/TeacherRemarksPage.tsx` — `/teacher/exams/remarks`: virtualised remark list, 200-char limit, saved checkmarks, missing count warning
- `src/pages/secretary/ReportCardsPage.tsx` — `/secretary/report-cards`: cohort selector, readiness table (per-student issues), generate selected, progress bar, result summary, ZIP download, Send for Approval
- `src/pages/principal/PrincipalReportCardsPage.tsx` — `/principal/report-cards`: approve+release+unlock workflow, principal remarks modal, unlock reason modal, status filter chips

**App.tsx:**
- Wired: `/teacher/exams`, `/teacher/exams/:journalId/marks`, `/teacher/exams/remarks`, `/secretary/report-cards`, `/principal/report-cards`

**TypeScript:** 0 errors. Vite build: clean.

**Key decisions:**
- CA score inputs: always segmented 0/1/2/3 per spec — no free number inputs for CA type
- Grade tabs: exactly 4 per UNEB spec (Exceptional/Passed/Needs Improvement/Poor), grouping B+C as "Passed"
- end_of_term grade saved as null in exam_results — final grade only computed at report card generation time via calcCBC()
- Report card generation runs per-student in sequence (not parallel) to avoid storage rate limits
- PDF uploads to Supabase Storage at `report-cards/{school_id}/{year}/{term}/{student_id}.pdf` (upsert: regeneration replaces old PDF)
- Principal remarks can be added at approval time and are included in the regeneration step; existing PDF is replaced

### Session 005 — Week 5 Types + Stream Management + Parent Credentials Rewrite (Complete)
**Date:** 2026-05-21
**Completed this session:**
- `src/types/app.ts` — fixed `Staff['employmentType']`: changed `part_time` → `volunteer` to match spec and wizard options
- `src/pages/secretary/StudentRegistrationWizard.tsx` — fixed pre-existing build error: `Control` and `FieldErrors` are type-only imports from react-hook-form (required by `verbatimModuleSyntax: true` in tsconfig)
- `src/pages/secretary/StaffRegistrationWizard.tsx` — updated `employmentType` cast to match corrected type
- `src/pages/secretary/ClassListPage.tsx` — added `AddStreamModal` (stream name input, calls `useCreateStream`); added `MoveStudentModal` (pick student from stream, pick target stream, calls `useMoveStudent`); fixed `StreamRow` class teacher display: now uses `stream.classTeacherId` to find the specific teacher assigned to that stream (was incorrectly finding any `class_teacher` in the school)
- `src/pages/secretary/ParentCredentialsPage.tsx` — complete rewrite from account-centric to student-centric:
  - Student table with columns: name/adm number, class, portal status badge, actions
  - Virtualised via `@tanstack/react-virtual` (handles 1000+ student lists)
  - `GenerateAccessModal`: captures parent name/email/phone, generates 10-char temp password using `crypto.getRandomValues`, inserts `parent_accounts` row with `temp_password`, shows copyable credential summary
  - `ViewCredentialsModal`: Step 1 — Secretary re-enters their own password (`supabase.auth.signInWithPassword`); Step 2 — shows email, temp password, portal URL each with `CopyButton`
  - `CopyButton`: uses `navigator.clipboard.writeText`, shows "Copied" for 2s after click
  - TODO comment preserved: auth user creation deferred to Week 8 Edge Function

**Key decisions:**
- `volunteer` replaces `part_time` in `Staff['employmentType']` — matches MoES employment categories for Ugandan schools and the wizard dropdown
- `ClassListPage` modals render at `ClassCard` level (not inside the card div) so they're not clipped by `overflow: hidden` on the card
- Re-auth in `ViewCredentialsModal` uses `supabase.auth.signInWithPassword` — this replaces the existing session with the same user's credentials (secretary stays logged in); Supabase guarantees session continuity since it's the same account
- `temp_password` stored in `parent_accounts` DB table (column required — add if not present: `ALTER TABLE parent_accounts ADD COLUMN temp_password TEXT`)
- TypeScript: 0 errors throughout; Vite build succeeds

### Session 004 — Staff Wizard + Staff Page + Class List + Parent Credentials (Complete)
**Date:** 2026-05-19
**Completed this session:**
- `src/hooks/useStaff.ts` — useStaff, useStaffById, useNextStaffNumber (uses school `short_name` as prefix), useRegisterStaff, with `staff_documents` joint fetch
- `src/hooks/useClasses.ts` — added useCreateStream + useMoveStudent mutations
- `src/types/app.ts` — added `tempPassword` to `ParentAccount`; changed `ExamResult.term` from `number` to `string` (matches DB TEXT type)
- `src/pages/secretary/StaffRegistrationWizard.tsx` — 4-step wizard: photo upload (Canvas 200KB compression → Supabase Storage `staff-photos`), MoES qualification levels (exact 7-level spec with numeric values), MoES compliance warning banner (advisory, not a blocker), document upload with National ID required for new staff + optional for existing, `isExistingStaff` toggle
- `src/pages/secretary/ClassListPage.tsx` — accordion cards per class, stream rows with student count + class teacher avatar, colour-coded by level
- `src/pages/secretary/ParentCredentialsPage.tsx` — parent account table, create modal (links students via StudentPicker search), link-student modal, credential confirmation screen
- `src/pages/secretary/SecretaryStaffPage.tsx` — orchestrator: staff table (avatar/initials, role badge, dept, phone, employment type, active status), search + role + dept filters, "Register Staff Member" → opens StaffRegistrationWizard
- Wired `/secretary/staff` in App.tsx to `SecretaryStaffPage`
- TypeScript: 0 errors throughout

**Key decisions:**
- Staff number format: `{school.short_name}/STAFF/001` — pulls school prefix from `school_profile.short_name`; falls back to `STF` if not set
- MoES qualification levels use numeric `value` (1–7) matching NCDC spec, not string slugs — stored as `qualification_level` integer in DB
- `ExamResult.term` is `string` not `number` — DB column is TEXT (e.g. "Term 1", "1", "T1") so we don't constrain at the TS layer
- `useCreateStream` + `useMoveStudent` added to useClasses for future use in class management screens

### Session 003 — Types + UI Component Library + Wizard + Import (Complete)
**Date:** 2026-05-19
**Completed this session:**
- Updated `src/types/app.ts` — added `Department`, `AcademicYear`, `Subject`, `StaffDocument`
- Renamed `Guardian` → `StudentGuardian` (matches `student_guardians` table)
- Extended `Student` with `nationality`, `religion`, `studentType`, `previousSchool`
- Added `CBCResult` type and `calcCBC()` convenience function
- Built `src/components/ui/` — 10 components: Button, Input, Select, Badge, Card, DataTable, Modal, Toast, LoadingSpinner, PageHeader
- Added `--brand-glow`, `--*-txt` semantic aliases, dark-mode overrides, shimmer/spin/fadeUp keyframes to `index.css`
- Added "UI COMPONENTS" CSS section: `.sui-btn-*`, `.sui-card`, `.sui-input`, `.sui-tr`, `.sui-wstep-*`, `.sui-wline-*`
- `src/hooks/useStudents.ts` — useStudents, useStudentById, useNextAdmissionNumber, useRegisterStudent, useUpdateStudent, useDeleteStudent
- `src/hooks/useClasses.ts` — useClasses, useStreams, useSubjects, useDepartments
- `src/pages/secretary/StudentsPage.tsx` — search, 4 filters, virtualised table (>50 rows), empty state, avatar initials
- `src/pages/secretary/StudentRegistrationWizard.tsx` — 3-step wizard: photo upload (Canvas 200KB compression + Supabase Storage), auto admission number (school prefix + year + seq), guardian array (up to 2, DNC, comms pref), live preview card, react-hook-form + zod, useRegisterStudent
- `src/components/shared/ImportWizard.tsx` — 5-step reusable: file upload (ExcelJS + CSV parser), fuzzy column auto-detect, colour-coded preview (green/amber/red rows), conflict resolution (upsert/skip), results summary
- `src/pages/secretary/SecretaryStudentsPage.tsx` — orchestrator: wires StudentsPage + wizard + import modal together, batch upsert with class/stream name→ID resolution
- Wired `/secretary/students` route in App.tsx to `SecretaryStudentsPage`
- TypeScript: 0 errors throughout

**Key decisions:**
- Package installed is `exceljs` (not xlsx/SheetJS) — ImportWizard uses ExcelJS for .xlsx, manual parser for .csv
- Photo: Canvas compress to ≤200KB → Supabase Storage bucket `student-photos` → URL stored in DB; if upload fails, registration continues without photo (recoverable)
- `staleTime: 0` on useNextAdmissionNumber — two secretaries can't get same sequence number
- School prefix for admission number fetched from `school_profile.short_name` via inline `useSchoolPrefix()` hook in the wizard
- ImportWizard is context-agnostic — caller provides requiredFields, optionalFields, onComplete; the wizard never touches the DB directly

### Session 002 — AppShell + Design Token System
**Date:** 2026-05-17
**Completed:**
- Replaced `src/index.css` entirely — correct teal token system, Google Fonts import, full shell layout CSS matching canonical HTML
- Created `src/config/roleNav.ts` — all 10 roles, exact SVG icons from design files, finance wall enforced at nav level
- Created `src/components/layout/AppShell.tsx` — Sidebar + TopBar + Outlet, theme toggle on `.ar[data-theme]`
- Updated `src/App.tsx` — all routes now use AppShell layout with real sub-routes, Placeholder pages inside shell
- TypeScript: 0 errors
**What to test:**
Log in as principal → should see dark sidebar, teal active state, topbar, theme toggle working
**Next:** Week 4 — all DB tables in dependency order, then RLS policies

### Session 001 — claude.ai Foundation
**Date:** 2025-05-17
**Completed:**
- Full system design reviewed (27 pages)
- 10-week build schedule created
- Design system: teal/cyan palette, full token set, typography, radius
- `shule-designs.html` built: palette reference, Login, Principal Dashboard (light+dark, animated charts)
- `shule-wireframes.html` built: Secretary, Bursar, Teacher, DoS, Deputy, Parent, Student, IT Admin
- Sidebar theme toggle fixed — CSS token system, switches fully with main content
- Auth system fully designed: hook SQL, AuthContext, ProtectedRoute, App.tsx routing
- Import Column Mapping Wizard spec locked (5 steps, reusable, saved mapping templates)
- Parent multi-student access spec locked (student_ids[], child switcher, Secretary workflow)
- Claude Code prompt generated with full context

**Next session starts at:**
Run hook SQL → Register in Dashboard → Implement auth files → Login page → AppShell

---

## The Non-Negotiables

1. RLS on EVERY table — no exceptions
2. Finance isolation — Deputy/DoS/Teacher see zero financial data
3. Teacher cannot INSERT students — DB-level, not UI-level
4. Offline-first — writes that fail go to sync_queue
5. No `.select('*')` on large tables in production
6. No more than 50 DOM rows without virtualisation
7. `school_registry` is Shule HQ only — no school JWT
8. Use design tokens — no hardcoded hex values in components
9. Explain before moving on — partner must understand
10. Update CLAUDE.md after every session — sacred
