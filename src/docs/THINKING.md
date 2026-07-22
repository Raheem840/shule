# THINKING.md — Architectural Decisions Journal

> Every non-obvious architectural decision gets recorded here.
> Future me and my partner should understand the WHY, not just the WHAT.

---

## Decision Log

### 001 — JWT Custom Claims for Roles
**Date:** 2025-05-17
**Decision:** Store `user_role`, `school_id`, `full_name`, and `student_ids` (parent only)
in the JWT via Supabase custom access token hook.
**Why:** Avoids extra DB round-trip on every request. Hook runs once at login.
React reads from `session.user.app_metadata` — zero DB calls for role checking.
**Tradeoff:** Role changes require logout + login to take effect. Acceptable — school
role changes are rare admin operations, not real-time events.

### 002 — Sidebar Always Dark, But Token-Driven
**Date:** 2025-05-17
**Decision:** Sidebar background stays dark in both light and dark modes but uses CSS
custom property tokens (`--sb-bg`, `--sb-label`, `--sb-item`, etc.) that shift subtly
in dark mode (slightly lighter, teal border glow).
**Why:** Dark sidebar anchors the layout visually. Consistent professional look.
The sidebar is navigation infrastructure, not content.

### 003 — Local-First, Cloud-Optional Architecture
**Date:** 2025-05-17
**Decision:** Supabase self-hosted via Docker on school's local server as the primary
deployment model. Cloud Supabase for development and internet-enabled schools.
**Why:** Most Ugandan school networks are internal LAN only. System must work with
zero internet. `SHULE_MODE` env var: `cloud` | `local` | `hybrid`.
**Offline fallback:** Dexie.js (IndexedDB) when server unreachable → sync_queue flushes on reconnect.

### 004 — CSS Custom Properties for Theming, Not Tailwind Dark Mode
**Date:** 2025-05-17
**Decision:** `data-theme="dark"` on `.ar` element + CSS vars. NOT Tailwind `dark:` prefix.
**Why:** Need per-screen theme control (each app shell has its own toggle). Tailwind dark
mode is document-level. CSS vars on a specific element give component-level control.

### 005 — Import Wizard as Single Reusable Component
**Date:** 2025-05-17
**Decision:** One `ImportWizard` component handles students, staff, fees, and marks.
Context-aware via `context` prop and `requiredFields`/`optionalFields` prop arrays.
**Why:** Identical 5-step UX across all import contexts. Build once, use four times.
Saved mapping templates stored per school so repeated imports are one-click.

### 007 — Hybrid Mode Is Backup-Only, Not Live Dual-Write
**Date:** 2026-07-22
**Decision:** "Hybrid" deployment does NOT mean the frontend writes to two Supabase
projects. The app always talks to exactly one project (the school's local stack, for
Hybrid). What Hybrid actually wires up is a nightly off-site backup: `install.sh`'s
existing local `pg_dump` cron also uploads that dump to a second, separate cloud
Supabase project's Storage (`scripts/backup-upload.sh`), recoverable via
`scripts/restore.sh --from-cloud` if the local server itself is lost.
**Why:** A real live dual-write sync needs conflict resolution (two devices editing
the same fee payment while briefly disconnected, etc.) that doesn't exist anywhere in
this codebase — building it properly is its own multi-week feature, not something to
half-implement. Backup-upload gives the actual thing a school needs from "hybrid"
(their data survives a destroyed server) without that risk. Found via a completeness
audit: `VITE_CLOUD_SUPABASE_URL`/`VITE_CLOUD_SUPABASE_ANON_KEY` had been wired all the
way through `prepare-usb.sh` → `build-for-school.sh` → `Dockerfile` as frontend build
args, but nothing in `src/` ever read them — dead, misleading plumbing, now removed.
**Follow-up (2026-07-22, same day):** `school_registry.cloud_backup_enabled` was
separately flagged as dead schema — never read or written anywhere. Closed as part of
this same feature: `scripts/backup-upload.sh` now PATCHes it (and `last_seen_at`) on
the school's own local project immediately after a successful cloud upload, and
`supabase/seed/school_template.sql` gained a Step 3 that creates the `school_registry`
row at install time for every deployment type (Sinqura-internal ops record — contact
info, deployment type, install notes — deny-all to school JWTs, never app-visible).
**Tradeoff:** No automatic cross-device sync if a school ever ran both a local server
and cloud project live simultaneously (not a supported configuration — Hybrid means
local-primary-with-cloud-backup, not local-and-cloud-both-live).

### 006 — Parent Multi-Student via student_ids UUID Array
**Date:** 2025-05-17
**Decision:** `parent_accounts.student_ids UUID[]` stores all children for a parent.
RLS uses `id = ANY(SELECT unnest(student_ids) FROM parent_accounts WHERE auth_user_id = auth.uid())`.
`activeStudentId` in React state (not URL) when switching between children.
**Why:** One login, all children, simple. URL would expose sibling student IDs.
State keeps the active selection ephemeral and private per session.

---

## Open Questions

- [ ] Parent auth: full Supabase Auth user or magic-link token? (Leaning: full Auth user,
      Secretary generates account, parent sets password via email link)
- [x] `SHULE_MODE=local` build: bundle different URLs at build time or runtime?
      **Decided (2026-07-22):** build time — `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
      are Docker build args baked into the static bundle per school
      (`scripts/build-for-school.sh`), not read at runtime. See decision 007.
- [ ] Africa's Talking key: Supabase Vault or server env? (Decision: Vault — never .env)
- [ ] Student portal: should students also be Supabase Auth users or portal-link only?
      (Leaning: full Auth users, Secretary generates, student sets password)
