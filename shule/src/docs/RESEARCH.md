# RESEARCH.md — Latest Docs & Tech Watch

> I check and update this before touching any library.
> Stale info = debugging time we don't have.

---

## Libraries — Always Check Before Use

| Library | Watch For | Official Docs |
|---------|-----------|---------------|
| @supabase/supabase-js | Auth API, hook registration UI location | https://supabase.com/docs/reference/javascript |
| Tailwind CSS v4 | v4 config is completely different from v3 | https://tailwindcss.com/docs |
| @tanstack/react-query v5 | useQuery signature changed in v5 | https://tanstack.com/query/v5/docs |
| react-hook-form v7 | register/Controller API | https://react-hook-form.com/docs |
| vite-plugin-pwa | Workbox config, manifest options | https://vite-pwa-org.netlify.app |
| dexie v4 | Table schema definition | https://dexie.org/docs |
| jspdf + jspdf-autotable | Version compatibility (must match) | https://github.com/parallax/jsPDF |
| SheetJS xlsx | Community edition vs Pro limits | https://docs.sheetjs.com |
| react-router-dom v6 | Routes/Route/Outlet/Navigate API | https://reactrouter.com/en/main |
| lucide-react | Icon names change between versions | https://lucide.dev |

---

## Supabase — Specific Things to Always Verify

- Auth hook registration: Dashboard → Authentication → Hooks (UI moves between releases)
- `app_metadata` vs `user_metadata`: server-set claims go in `app_metadata` ALWAYS
- RLS policy syntax: verify PostgreSQL version on your Supabase project
- Self-host Docker compose: https://github.com/supabase/supabase/tree/master/docker
- Supabase Vault for secrets: https://supabase.com/docs/guides/database/vault

## Uganda / East Africa APIs

- Africa's Talking SMS: https://developers.africastalking.com/docs/sms
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- NCDC Uganda CBC Curriculum topics: https://ncdc.go.ug
- SchoolPay SMS format (for auto-recording payments): research per school setup

---

## Research Log

### 2025-05-17 — Initial architecture session
- Supabase custom hook: `public.custom_access_token_hook(event jsonb) RETURNS jsonb` ✓
- Hook registration: Dashboard → Authentication → Hooks → "Custom Access Token" ✓
- Tailwind v4: uses `@import "tailwindcss"` in CSS, not `tailwind.config.js` directives ✓
- TanStack Query v5: `useQuery({ queryKey: [], queryFn: async () => {} })` ✓ (no breaking change to basic usage)
- React Router v6: `<Routes>` + `<Route element={...}>` + `<Outlet />` ✓
- Supabase `app_metadata` confirmed as correct location for JWT custom claims ✓
- SheetJS community edition: `XLSX.read()` + `XLSX.utils.sheet_to_json()` — no auth needed for basic parse ✓
