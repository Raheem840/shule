# Shule — 10-Week Build Timetable

> Every task, every day. From Figma design system to physical school server installation in Uganda. Nothing skipped.

**Stack:** React + TypeScript + Vite + Supabase + Tailwind v4 · Offline-first PWA · 9 User Roles · 20+ DB Tables

---

## Current Status
| Item | Status |
|------|--------|
| Figma file created (3 pages) | ✅ Done |
| Color tokens + Typography + Spacing | ✅ Done |
| App Shell (Principal view) | ✅ Done |
| Role sidebars (all 9) | ⏳ Figma limit — resuming tomorrow |
| UI component library | ⏳ Pending |
| All wireframes (9 screens) | ⏳ Pending |
| Vite + React + TS project running | ✅ Done |
| Tailwind v4 configured | ✅ Done |
| All dependencies installed | ✅ Done |
| Folder structure created | ✅ Done |
| supabase.ts + queryClient.ts + types/app.ts | ✅ Done |
| Pushed to GitHub | ✅ Done |
| Supabase school_profile table | ✅ Done |
| Supabase staff table | ✅ Done |

---

## Task Type Legend
| Symbol | Type |
|--------|------|
| 🎨 | Figma / Design |
| 💻 | React / TypeScript Code |
| 🗄️ | Database / SQL |
| ⚙️ | Config / Setup |
| 🔒 | Security / RLS |
| ✅ | Testing / Verification |
| 🚀 | DevOps / Server |

---

## Phase 1 — Foundation (Weeks 1–2)

---

### Week 1 — Figma Design System + All Core Wireframes
**Goal:** Approved low-fi designs for all 9 roles, full component library in Figma

| Day | Tasks |
|-----|-------|
| **Monday** | 🎨 Create Figma team + invite collaborator · 🎨 Create "Design System" page · 🎨 Define all 12 color tokens · 🎨 Load Inter font (4 weights) · 🎨 Build 9 role colour chips |
| **Tuesday** | 🎨 Text style library (H1–Caption) · 🎨 Spacing scale (4–64px) · 🎨 Border radius tokens · 🎨 Button component (Primary/Secondary/Danger/Ghost) · 🎨 Input field + error + disabled states |
| **Wednesday** | 🎨 Select dropdown · 🎨 Badge + Status chip · 🎨 Card + Table row · 🎨 Modal shell · 🎨 App Shell Master (all 9 role sidebar variants) |
| **Thursday** | 🎨 Wireframe: Login page · 🎨 Wireframe: Principal dashboard (KPI cards, activity, quick actions) · 🎨 Wireframe: Secretary dashboard + 3-step Student Registration wizard · 🎨 Wireframe: Bursar dashboard + Fee Ledger |
| **Friday** | 🎨 Wireframe: Teacher dashboard + Exam Journal · 🎨 Wireframe: Report Card PDF preview (CBC format) · 🎨 Wireframe: DoS analytics dashboard · 🎨 Wireframe: Parent Portal · 🎨 Export Figma share link → send to school |

**🏁 Milestone:** Full design system · All 9 role sidebars · All 8 screens wireframed · Share link sent to school

---

### Week 2 — High-Fidelity Figma + Vite Project Scaffolding
**Goal:** School-approved hi-fi designs + working React + TS project on GitHub

| Day | Tasks |
|-----|-------|
| **Monday** | 🎨 Polish Login → hi-fi · 🎨 Polish Principal + Secretary dashboards · 🎨 Polish Student Registration wizard |
| **Tuesday** | 🎨 Polish Fee Ledger + import wizard · 🎨 Polish Exam Journal + mark entry table · 🎨 Polish Report Card preview · 🎨 Present to school → collect feedback → apply changes |
| **Wednesday** | ⚙️ npm create vite@latest shule -- --template react-ts · ⚙️ Install all dependencies · ⚙️ Configure Tailwind v4 with Shule tokens |
| **Thursday** | ⚙️ Create .env.local + .env.example + verify .gitignore · 💻 src/lib/supabase.ts · 💻 src/lib/queryClient.ts · 💻 Build full folder structure |
| **Friday** | 💻 src/types/app.ts (all TypeScript types + CBC calculation functions) · ⚙️ First git commit + push to GitHub · ✅ Verify: npm run dev works, Tailwind renders, Supabase connects |

**🏁 Milestone:** Hi-fi designs approved · Vite + React + TS running · All deps installed · Supabase connected · On GitHub

---

## Phase 2 — Core Build (Weeks 3–4)

---

### Week 3 — Authentication, JWT Role System & Route Guards
**Goal:** All 9 roles log in and land on their correct, blocked dashboard

| Day | Tasks |
|-----|-------|
| **Monday** | 🗄️ CREATE TABLE school_profile · 🗄️ CREATE TABLE staff (with auth_user_id FK + role CHECK constraint) · 🗄️ INSERT demo school (id = 00000000-0000-0000-0000-000000000001) |
| **Tuesday** | 🗄️ Write custom_access_token_hook() SQL function (stamps user_role + school_id into JWT) · ⚙️ Register hook in Supabase Dashboard → Auth → Hooks · 🗄️ Write auth.user_role() + auth.user_school_id() helper functions · ✅ Create demo staff users, verify JWT claims |
| **Wednesday** | 💻 src/store/AuthContext.tsx (reads JWT claims, exposes user + loading) · 💻 Wrap App in AuthProvider + QueryClientProvider · 💻 Export useAuth() hook · 💻 Login page UI + wire to supabase.auth.signInWithPassword() |
| **Thursday** | 💻 ProtectedRoute component (role check → hard block → AccessDenied page) · 💻 AccessDenied page · 💻 LoadingSpinner component · 💻 React Router setup (9 role route groups each wrapped in ProtectedRoute) |
| **Friday** | 💻 AppShell layout (Sidebar + TopBar + Outlet) · 💻 Sidebar component (ROLE_NAV config object per role) · 💻 TopBar (breadcrumb, search, notifications, avatar) · ✅ Test every role: correct route + correct sidebar + wrong role = AccessDenied |

**🏁 Milestone:** JWT claims working · All 9 roles redirect correctly · ProtectedRoute blocks unauthorized routes · Role-specific sidebars render

---

### Week 4 — Full Database Schema + Row Level Security
**Goal:** All 20+ tables created, every table locked with RLS, tested

| Day | Tasks |
|-----|-------|
| **Monday** | 🗄️ CREATE TABLE departments, academic_years, classes, streams, subjects · 🗄️ CREATE TABLE students (admission_number UNIQUE per school, status CHECK) · 🗄️ CREATE TABLE student_guardians (do_not_contact flag) |
| **Tuesday** | 🗄️ CREATE TABLE staff_documents · 🗄️ CREATE TABLE exam_journal (assessment_type ENUM) · 🗄️ CREATE TABLE exam_results · 🗄️ CREATE TABLE attendance (status: present/absent/late/excused) |
| **Wednesday** | 🗄️ CREATE TABLE fee_structure · 🗄️ CREATE TABLE fee_payments (imported flag) · 🗄️ CREATE TABLE report_cards (status: draft/ready/approved/released) · 🗄️ CREATE TABLE teacher_remarks · 🗄️ CREATE TABLE messages, notifications, discipline_records, curriculum_plan, sms_reminders, send_queue, sync_queue, audit_log, parent_accounts |
| **Thursday** | 🔒 ALTER TABLE [every table] ENABLE ROW LEVEL SECURITY · 🔒 students: INSERT → secretary + principal only · 🔒 students: SELECT → all staff, own school · 🔒 fee_payments: ALL → bursar + principal only · 🔒 exam_results: SELECT → own teacher_id OR principal/dos/secretary |
| **Friday** | 🔒 messages: SELECT → from_user_id OR to_user_id = auth.uid() · 🔒 audit_log: SELECT → principal only · 🔒 school_registry: DENY ALL for school JWTs · 🔒 parent_accounts: SELECT → student_id IN parent's student_ids[] · ✅ Test every policy in Supabase inspector · 🗄️ Insert demo seed data |

**🏁 Milestone:** All 20+ tables created · RLS on every table · Finance blocked at DB for wrong roles · All policies tested

---

## Phase 3 — MVP Modules (Weeks 5–8)

---

### Week 5 — Student Registration Module (Secretary)
**Goal:** Secretary registers students end-to-end, imports from Excel, photo uploads

| Day | Tasks |
|-----|-------|
| **Monday** | 💻 Build UI components: Button, Input, Select, Textarea, FormError · 💻 Modal (Radix Dialog) · 💻 PageHeader · 💻 DataTable (sortable, checkbox selection, pagination) · 💻 FeeStatusBadge, RoleBadge |
| **Tuesday** | 💻 Full Student type in types/app.ts · 💻 useStudents(classId?) hook · 💻 useClasses() + useStreams() hooks · 💻 Students list page (table + search + filter by class/status) |
| **Wednesday** | 💻 StudentRegistrationWizard (3 steps, progress indicator) · 💻 Step 1: Personal info — React Hook Form + Zod validation · 💻 Step 2: Academic placement + admission number auto-generation |
| **Thursday** | 💻 Step 3: Guardian info (up to 2, DNC flag, comms preference) · 💻 Photo upload (compress to max 200KB → Supabase Storage) · 💻 useRegisterStudent mutation hook · 💻 Toast notifications |
| **Friday** | 💻 Reusable ImportWizard component (upload → parse → map → preview → upsert) · 💻 SheetJS parseExcelFile() util + COLUMN_ALIASES map · 💻 Preview: green=valid, yellow=warning, red=error · ✅ Register student manually + import CSV + verify teacher blocked by RLS |

**🏁 Milestone:** Secretary registers students · Photo upload · Guardian info · Excel import · Teacher INSERT blocked at DB

---

### Week 6 — Fee Management Module (Bursar)
**Goal:** Bursar imports, edits, exports fees. Secretary sees status only. SMS queued.

| Day | Tasks |
|-----|-------|
| **Monday** | 💻 Bursar dashboard KPI cards · 💻 Fee Ledger page (table with balance column) · 💻 FeeStatusBadge (paid=green, partial=amber, unpaid=red) · 🗄️ useFeePayments() hook (Bursar only — RLS enforced) |
| **Tuesday** | 💻 Inline fee editing (click cell → input → save on blur → balance recalculates) · 🗄️ Edit history → audit_log · 💻 "Add Payment" modal · 💻 Balance auto-calculation |
| **Wednesday** | 💻 Reuse ImportWizard for fee import · 💻 Upsert logic (same admission+term+year+type → prompt) · 💻 Fee structure management page · 💻 Filter controls (class/stream/status/term) |
| **Thursday** | 💻 Secretary fee view (status flag ONLY — no amounts, separate query) · 🔒 Confirm: teacher/deputy/dos GET fee_payments → 0 rows · 💻 Salary/Payroll records page · 💻 Export PDF + Excel |
| **Friday** | 💻 SMS/WhatsApp reminder UI (filter → compose → send) · 🗄️ sms_reminders + send_queue insert (offline queue) · 💻 Message delivery log · ✅ Full flow: import → edit → export → remind → verify finance blocked |

**🏁 Milestone:** Bursar imports + edits fees · Balance auto-calculates · Secretary sees status only · SMS queued · Export working

---

### Week 7 — Exam Journal + CBC Report Card Generation
**Goal:** Teacher enters marks → Secretary generates PDF → Principal approves → Parent downloads

| Day | Tasks |
|-----|-------|
| **Monday** | 💻 Exam journal creation form (all assessment types) · 💻 Conditional fields: AoI/DIT/CA (auto-increment C1,C2,C3…) · 💻 Core fields: subject, class, stream, term, year, total marks, pass mark |
| **Tuesday** | 💻 Mark entry table (inline editable scores, grade auto-calculated) · 💻 Reuse ImportWizard for marks (Admission No + Score only, own classes only) · 💻 Score validation (warn if > total_marks, flag missing, flag duplicates) |
| **Wednesday** | 💻 Score distribution chart (Recharts — red below pass / green above) · 💻 Filtered student list (Exceptional/Passed/Needs Improvement/Poor) · 💻 Student hover card (name, class, score, sparkline) · 💻 Class average trend line |
| **Thursday** | 💻 CBC grade calculation: max_points=assessed×3 → out_of_20=(total/max)×20 → total=out_of_20+exam_80 → grade A/B/C/D/E · 💻 Teacher remarks per student (required before report generation) · 💻 Teacher marks class "Ready" → status DRAFT→READY · 💻 Report card preview (read-only) |
| **Friday** | 💻 jsPDF report card generator (school header, CBC table, attendance, remarks, signature lines) · 💻 Secretary: batch generate → ZIP download · 💻 Principal: APPROVE → RELEASE buttons · 💻 Principal: UNLOCK with typed reason · ✅ Full flow: marks → ready → generate → approve → release → parent downloads |

**🏁 Milestone:** CBC formula correct · PDF generates in NCDC format · Full workflow complete · Parent downloads released card

---

### Week 8 — Attendance + Staff Registration + Parent & Student Portals
**Goal:** Attendance live, parents see only their child, staff wizard complete

| Day | Tasks |
|-----|-------|
| **Monday** | 💻 Daily attendance page (Present/Absent/Late/Excused per student) · 💻 Attendance summary (rate %, flag below 80%) · 🗄️ useAttendance() hook (teacher = own class, others = all via RLS) |
| **Tuesday** | 💻 Staff Registration wizard Step 1: Personal info + National ID + photo · 💻 Step 2: Professional info (role, department, subjects, classes) |
| **Wednesday** | 💻 Step 3: Qualification level (Uganda MoES 7 levels, warn if below minimum) · 💻 Step 4: Document uploads (old vs new staff toggle) · 💻 Create Supabase Auth user + insert staff row + link auth_user_id · 💻 Staff list page |
| **Thursday** | 💻 Secretary generates parent portal access links · 🗄️ parent_accounts (one account → multiple children via student_ids[]) · 💻 Parent login flow · 💻 Parent Portal: results, fee balance, attendance, notices, report card download |
| **Friday** | 💻 Student Portal: own results, fees, attendance, notices, end-of-term survey · 🔒 parent_accounts RLS: student_id IN parent's student_ids[] · ✅ Parent A → sees child A only · Student → sees own data only · ✅ Teacher tries parent portal → AccessDenied |

**🏁 Milestone:** Attendance live · Parent portal isolated · Student portal working · Staff wizard with MoES qualification levels

---

## Phase 4 — Polish, PWA & Deploy (Weeks 9–10)

---

### Week 9 — PWA + Offline Sync + DoS + Deputy + Messaging
**Goal:** PWA installs, works offline, DoS and Deputy dashboards built, messaging live

| Day | Tasks |
|-----|-------|
| **Monday** | ⚙️ npm install -D vite-plugin-pwa · ⚙️ Configure VitePWA (manifest + workbox Cache First/Network First) · 💻 src/lib/db.ts (Dexie ShuleDatabase: students, staff, sync_queue) · 💻 OfflineBanner component |
| **Tuesday** | 💻 queueSync() util (offline writes → IndexedDB sync_queue) · 💻 window 'online' listener → auto-flush sync_queue to Supabase · 💻 Conflict resolution (server wins, toast notification) · ✅ Test offline attendance sync + PWA install Android + iOS |
| **Wednesday** | 💻 DoS dashboard: pass rates, class averages heatmap, subject rankings, teacher heatmap · 💻 Curriculum coverage timeline · 💻 DoS: view all exam journals (read-only), flag issues, message teacher · 💻 Teacher performance page |
| **Thursday** | 💻 Deputy: discipline records (incident, nature, resolution) · 💻 Deputy: timetable view (read-only) + attendance overview · 💻 In-app messaging: chat bubbles, timestamps, read receipts (✓ sent, ✓✓ read) · 💻 File attachments (PDF/image/Excel max 5MB) |
| **Friday** | 💻 Announcements channel (Principal/Deputy/DoS/Secretary/Bursar/IT post only) · 💻 DoS message templates + attach system report · 💻 IT Admin dashboard: system KPIs, user login state, password reset · 💻 School Settings page (profile, departments, grading, API config, export templates) |

**🏁 Milestone:** PWA installs · Offline sync works · DoS analytics built · Messaging with read receipts · IT Admin resets passwords

---

### Week 10 — Performance Optimisation + School Server Install + MVP Handoff
**Goal:** Installed at school, all staff trained, every MVP criterion green

| Day | Tasks |
|-----|-------|
| **Monday** | 💻 React.lazy() + Suspense on all routes (code splitting) · 💻 @tanstack/react-virtual on all 50+ row lists · 💻 Audit all Supabase queries (no .select('*')) · 💻 useMemo/useCallback/React.memo audit · 💻 Low-bandwidth mode toggle |
| **Tuesday** | 💻 Print + Download on every data page (PDF + Excel, checkbox row selection) · 💻 Built-in export templates (Student Register, Fee Statement, Staff Register, etc.) · 💻 Secretary: upload school's own report card template · 🚀 npm run build → verify bundle < 200KB gzipped |
| **Wednesday** | 🚀 Ubuntu Server 22.04 LTS install on school PC · 🚀 Assign static IP: 192.168.1.100 · 🚀 Install Docker + Docker Compose · 🚀 Deploy Supabase self-hosted (docker compose up -d) · ✅ Verify Supabase Studio at http://192.168.1.100:3000 |
| **Thursday** | 🚀 Install Nginx + copy dist/ to /var/www/shule · 🚀 Configure Nginx (try_files, API proxy) · 🚀 Rebuild app with local Supabase URL · 🚀 Setup nightly pg_dump backup cron · 🚀 Enable docker + nginx systemctl auto-restart |
| **Friday 🇺🇬** | 🚀 Connect all staff devices to school WiFi → http://192.168.1.100 → Install PWA · 🚀 Print QR code → paste in staffroom · 🚀 Training: IT Admin(30min) → Secretary(45min) → Bursar(45min) → Teachers(30min) → Principal(30min) · ✅ Run all 13 MVP checklist items · 🚀 Hand over credentials to Principal |

**🏁 Milestone: MVP COMPLETE 🎉**

---

## MVP Exit Criteria — All 13 Must Be Green

- [ ] All 9 roles log in and see correct dashboard + sidebar
- [ ] Secretary registers student via 3-step wizard
- [ ] Bursar imports fees from Excel and adds payments
- [ ] Teacher enters marks (manual + Excel import)
- [ ] CBC report card PDF generates with correct grade formula
- [ ] Principal approves and releases report cards
- [ ] Parent portal shows only their child's data
- [ ] Finance data invisible to Teacher, Deputy, DoS (tested)
- [ ] RLS policies block unauthorized DB access (Supabase inspector tested)
- [ ] App works offline (IndexedDB sync queue)
- [ ] PWA installs on Chrome (Android) and Safari (iOS)
- [ ] All lists virtualised (max 50 DOM rows)
- [ ] Page load under 2 seconds on school LAN

---

## Things That Must Never Be Done

- Never use `.select('*')` on large tables — always specify exact columns
- Never render more than 50 list rows in the DOM at once — use virtualisation
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- Never give the `school_registry` table access to any school user JWT
- Never allow a Teacher role to INSERT or UPDATE the students table
- Never skip RLS policies — UI-only restrictions are not security
- Never store API keys (SMS/WhatsApp) in plain text — use Supabase Vault
- Never link to or expose `/admin` from any school-facing page

---

*Shule — Built for Uganda and East Africa · React + TypeScript + Vite + Supabase + Tailwind v4*
