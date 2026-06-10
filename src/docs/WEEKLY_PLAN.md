# WEEKLY_PLAN.md — Accelerated Build Plan

> Original: 10 weeks. Target: 1 week of focused sessions.
> We move fast but understanding comes first.

---

## Status Overview

| Week | Focus                        | Status      |
|------|------------------------------|-------------|
| 1    | Design System                | ✅ Complete  |
| 2    | Project Setup + Scaffolding  | ✅ Complete  |
| 3    | Auth + JWT + Routes          | 🔄 In Progress |
| 4    | All DB Tables + RLS          | ⏳           |
| 5    | Student Registration Module  | ⏳           |
| 6    | Fee Management Module        | ⏳           |
| 7    | Exam Journal + Report Cards  | ⏳           |
| 8    | Attendance + Portals         | ⏳           |
| 9    | PWA + Offline + DoS + Messaging | ⏳        |
| 10   | Performance + School Install | ⏳           |

---

## Week 3 — Auth & JWT (IN PROGRESS)

### Done
- [x] school_profile table
- [x] staff table
- [x] Demo school inserted
- [x] Hook SQL written + parent branch added
- [x] AuthContext designed
- [x] ProtectedRoute designed
- [x] App.tsx routing designed

### Next — Do In This Order
- [ ] Run hook SQL in Supabase SQL Editor
- [ ] Register hook: Dashboard → Authentication → Hooks → Custom Access Token
- [ ] Create test staff user (Supabase Auth UI: Authentication → Users → Add User)
- [ ] Insert staff row with that user's auth UUID
- [ ] Login + verify JWT claims in browser console
- [ ] `src/store/AuthContext.tsx`
- [ ] `src/components/layout/ProtectedRoute.tsx` + `AccessDenied.tsx` + `LoadingSpinner.tsx`
- [ ] Update `src/main.tsx` to wrap with AuthProvider
- [ ] `src/App.tsx` with full role routing
- [ ] `src/pages/auth/LoginPage.tsx`
- [ ] `src/components/layout/AppShell.tsx` (Sidebar + TopBar + Outlet)
- [ ] `src/config/roleNav.ts` (ROLE_NAV config per role)
- [ ] Test: all 9 role redirects work + wrong role = AccessDenied

---

## Week 4 — Database Tables + RLS

### Creation Order (dependencies first)

```sql
-- Batch 1: No foreign keys
1. departments
2. academic_years

-- Batch 2: Depend on batch 1
3. classes (→ academic_years)
4. streams (→ classes)
5. subjects

-- Batch 3: Core data
6. students (→ classes, streams)
7. student_guardians (→ students)
8. staff_documents (→ staff)

-- Batch 4: Academic
9. exam_journal (→ staff, subjects, classes, streams)
10. exam_results (→ exam_journal, students, subjects)
11. attendance (→ students, classes)

-- Batch 5: Finance
12. fee_structure
13. fee_payments (→ students, fee_structure)

-- Batch 6: Reports + Comms
14. report_cards (→ students)
15. teacher_remarks (→ students, staff)
16. messages (→ staff)
17. notifications
18. discipline_records (→ students, staff)
19. curriculum_plan (→ subjects, classes)
20. sms_reminders (→ students)
21. send_queue
22. sync_queue
23. audit_log
24. parent_accounts (→ students — via UUID array)
```

### RLS Policies (every table, no exceptions)

```sql
-- students
INSERT → secretary + principal only
SELECT → all staff (same school), own student (student role), parent via student_ids[]
UPDATE → secretary + principal only
DELETE → principal only

-- fee_payments
ALL → bursar + principal only (complete hard block for everyone else)

-- exam_results
SELECT → teacher sees own teacher_id rows OR principal/dos/secretary sees all
INSERT/UPDATE → teacher for own teacher_id only

-- messages
SELECT → from_user_id = auth.uid() OR to_user_id = auth.uid()
INSERT → authenticated staff only (no student/parent)

-- audit_log
SELECT → principal only
INSERT → via server-side trigger only (never direct from client)

-- parent_accounts
SELECT → auth.uid() = auth_user_id (own account only)
parent seeing students → via policy on students table using student_ids[]

-- discipline_records
ALL → deputy + principal
SELECT → dos (read-only)
```

---

## Week 5 — Student Registration Module

### Hooks
```typescript
useStudents(filters?: { classId?: string; streamId?: string; status?: string })
useStudentById(id: string)
useClasses()
useStreams(classId?: string)
useRegisterStudent()   // mutation
useUpdateStudent()     // mutation
useImportStudents()    // mutation (uses ImportWizard)
```

### Components
- `StudentRegistrationWizard` (3 steps: Personal → Academic → Guardian)
- `ImportWizard` (reusable 5-step, context="students")
- `StudentTable` (sortable, filterable, virtualised at 50+ rows)
- `StudentProfileCard`
- `PhotoUpload` (compress to max 200KB before upload to Supabase Storage)
- `GuardianForm` (up to 2 guardians, DNC flag, communication preference)
- `AdmissionNumberGenerator` (format: `SCHOOL_SHORT/YEAR/SEQUENCE`)

---

## Week 6 — Fee Management Module

### Hooks
```typescript
useFeePayments(filters?)    // Bursar + Principal only via RLS
useFeeStructure()
useFeeStatusOnly(studentId) // Secretary: status flag only, no amounts
useAddPayment()
useImportFees()             // uses ImportWizard context="fees"
useSendReminder()
useDeliveryLog()
```

### Components
- `FeeLedger` (inline editing, balance auto-calc on every edit)
- `FeeImportWizard` (ImportWizard context="fees")
- `FeeStatusBadge` (paid/partial/unpaid — Secretary sees this, not amounts)
- `SMSReminderCompose` (filter → preview → send)
- `DeliveryLog` (sent/delivered/failed per message)
- `SalaryRecords`
- `FeeStructureManager`

---

## Week 7 — Exam Journal + CBC Report Cards

### Hooks
```typescript
useExamJournals(filters?)
useExamResults(journalId)
useCreateJournal()
useImportMarks()          // ImportWizard context="marks"
useUpdateMark()
useGenerateReportCard()   // jsPDF
useApproveReportCard()    // Principal only
useReleaseReportCard()    // Principal only
```

### Components
- `ExamJournalCard` (with Recharts score distribution bar chart)
- `MarkEntryTable` (inline editable, grade auto-calc from score)
- `CBCCalculator` (utility: max_points, out_of_20, total, grade)
- `ReportCardPDF` (jsPDF + school template or built-in CBC layout)
- `ReportCardWorkflow` (DRAFT → READY → APPROVED → RELEASED status pills)
- `BatchDownloadButton` (generate ZIP of PDFs for selected students)
- `TeacherRemarksForm` (required before report generation)

### CBC Formula (implement as pure utility function)
```typescript
export function calcCBC(totalPoints: number, assessed: number, examScore: number) {
  const maxPoints  = assessed * 3
  const outOf20    = (totalPoints / maxPoints) * 20
  const total      = Math.round(outOf20 + examScore)
  const grade      = total >= 90 ? 'A'
                   : total >= 75 ? 'B'
                   : total >= 65 ? 'C'
                   : total >= 50 ? 'D' : 'E'
  return { outOf20: Math.round(outOf20 * 10) / 10, total, grade }
}
```

---

## Week 8 — Attendance + Staff Registration + Portals

### Hooks
```typescript
useAttendance(classId, date)
useMarkAttendance()
useAttendanceSummary(studentId)
useParentStudents()        // parent: all children from JWT student_ids[]
useActiveStudent()         // parent: currently selected child
useCreateParentAccount()   // Secretary
useLinkStudentToParent()   // Secretary: adds student to existing parent account_ids[]
```

### Components
- `AttendanceGrid` (present / absent / late / excused per student)
- `AttendanceSummary` (rate %, flag below 80%)
- `StaffRegistrationWizard` (4 steps: Personal → Professional → Qualification → Documents)
- `QualificationDropdown` (Uganda MoES 7 levels, warns if below minimum for class level)
- `ParentChildSwitcher` (sidebar dropdown when parent has multiple children)
- `ParentPortal` (results, fees, attendance, notices, report card download)
- `StudentPortal` (own data + end-of-term survey)
- `PortalLinkGenerator` (Secretary generates + stores credentials, re-auth to view)

---

## Week 9 — PWA + Offline + DoS + Messaging

### PWA Setup
```typescript
// vite.config.ts additions
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Shule — School Management',
    short_name: 'Shule',
    theme_color: '#0d9488',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [{
      urlPattern: /^https:\/\/.*\.supabase\.co/,
      handler: 'NetworkFirst',
      options: { cacheName: 'supabase-api' }
    }]
  }
})
```

### Dexie Offline DB
```typescript
// src/lib/db.ts
class ShuleDatabase extends Dexie {
  students!:  Dexie.Table
  staff!:     Dexie.Table
  syncQueue!: Dexie.Table

  constructor() {
    super('shule')
    this.version(1).stores({
      students:  'id, schoolId, admissionNumber, classId',
      staff:     'id, schoolId, role',
      syncQueue: '++id, tableName, actionType, status, createdAt',
    })
  }
}
export const db = new ShuleDatabase()

export async function queueSync(tableName: string, action: string, payload: any) {
  await db.syncQueue.add({
    tableName, actionType: action, payload,
    status: 'pending', createdAt: new Date()
  })
}
```

### Components
- `OfflineBanner` (fixed top bar when server unreachable)
- `DoSDashboard` (pass rates, curriculum heatmap, teacher performance)
- `CurriculumTimeline` (interactive, fills as topics are marked covered)
- `StaffMessaging` (chat bubbles, timestamps, read receipts ✓/✓✓)
- `AnnouncementsChannel` (post: principal/deputy/dos/secretary/bursar/it only)
- `FileAttachment` (PDF/image/Excel max 5MB)

---

## Week 10 — Performance + School Server Install

### Performance Checklist
- [ ] `React.lazy()` + `<Suspense>` on all routes
- [ ] `@tanstack/react-virtual` on all 50+ row lists
- [ ] Audit: every Supabase query specifies exact columns
- [ ] `useMemo` / `useCallback` / `React.memo` audit
- [ ] Low-bandwidth mode toggle (replaces charts with text tables)
- [ ] `npm run build` → bundle < 200KB gzipped

### School Server Install Steps
```bash
# On school PC (Ubuntu 22.04 LTS)
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose nginx -y
sudo systemctl enable docker

# Deploy Supabase self-hosted
git clone https://github.com/supabase/supabase
cd supabase/docker && cp .env.example .env
# Edit .env with strong passwords
docker compose up -d

# Deploy Shule frontend
sudo cp -r dist/ /var/www/shule
# Configure Nginx: listen 80, root /var/www/shule, try_files $uri /index.html
sudo systemctl restart nginx

# Nightly backup
echo "0 0 * * * pg_dump shule > /mnt/backup/shule_$(date +%Y%m%d).sql" | crontab -

# Auto-restart on power cut
sudo systemctl enable docker nginx
```

### Staff Training Order (on installation day)
1. IT Admin — 30 min (settings, user management, API config)
2. Secretary — 45 min (student/staff registration, import, portal links)
3. Bursar — 45 min (import fees, add payments, send reminders)
4. Teachers — 30 min (exam journal, enter marks, attendance)
5. Principal — 30 min (dashboard, approve report cards, audit log)

---

## MVP Exit Criteria — 13 Green = Ship

- [ ] All 9 roles log in and see correct dashboard + sidebar
- [ ] Secretary registers student via 3-step wizard
- [ ] Bursar imports fees from Excel and adds payments
- [ ] Teacher enters marks (manual + Excel import via column mapping wizard)
- [ ] CBC report card PDF generates with correct formula
- [ ] Principal approves and releases report cards
- [ ] Parent portal shows only their child(ren)'s data, child switcher works
- [ ] Finance data invisible to Teacher, Deputy, DoS (tested in Supabase inspector)
- [ ] RLS policies block unauthorized DB access
- [ ] App works offline (IndexedDB sync queue)
- [ ] PWA installs on Chrome Android and Safari iOS
- [ ] All 50+ row lists are virtualised
- [ ] Page load under 2 seconds on school LAN
