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
A=90-100  B=75-89  C=65-74  D=50-64  E=1-49
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
- [x] Tests: 340 passing (28 test files)
- [ ] Storage bucket wiring — **IN PROGRESS (Session 013)**

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

### Session 013 — Storage Bucket Wiring (In Progress)
**Date:** 2026-05-28

**Changes so far:**
- `.gitignore`: added `.claude/` and `supabase/.temp/`
- `git rm --cached .claude/settings.local.json` — untracked from remote
- `CLAUDE.md`: trimmed to <300 lines; sessions 001-012 archived to `src/docs/SESSION_ARCHIVE.md`
- Creating: `src/lib/storage.ts`, `src/lib/fileValidation.ts`, `src/hooks/useSignedUrl.ts`, `src/components/shared/Avatar.tsx`
- Fixing: all photo display across the app (student-photos → signed URLs, staff-photos → public URL)
- Fixing: `StaffRegistrationWizard` document bucket `staff-documents` → `documents`
- Fixing: `StudentRegistrationWizard` student photo stored as path (not full URL)
- Wiring: `TemplatesPage.tsx` — real upload UI against `templates` bucket
