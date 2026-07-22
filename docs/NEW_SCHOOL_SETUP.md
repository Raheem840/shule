# Adding a New School to Shule

## Local School (no internet)
```
npm run usb:prepare "School Name"
Copy shule-install/ to USB
On school server: sudo bash install.sh
```
`usb:prepare` generates a unique secret set for this school (JWT secret,
anon/service keys, DB password, Studio login) and builds every image the
on-prem server needs — including pre-cached edge functions — so nothing on
the USB needs internet access once you're at the school. Run it at home.

## Cloud School (reliable internet)
```
npm run install:school NEW_PROJECT_REF
npm run build:school "School Name" \
  https://xxx.supabase.co ANON_KEY cloud
```

## Hybrid School (local + cloud backup)
```
npm run usb:prepare "School Name" hybrid \
  https://xxx.supabase.co CLOUD_SERVICE_ROLE_KEY
Copy shule-install/ to USB
On school server: sudo bash install.sh
```
Note this needs the cloud project's **service_role** key (Settings → API),
not its anon key — it only ever runs server-side in the nightly backup cron,
never in the browser.

Same as Local — the app still runs entirely against the school's own local
Supabase stack, there is no live dual-write. What Hybrid actually adds:
every night's local backup also gets uploaded to the cloud project's
Storage, so the school's data survives even if the local server itself is
lost, stolen, or its disk fails. See "Backups & Restore" below.

## After Every Installation

**Cloud:** register the Custom Access Token Hook manually —
Supabase Dashboard → Authentication → Hooks → Custom Access Token Hook →
schema `public`, function `custom_access_token_hook`.

**Local/Hybrid:** the hook is already configured via an environment
variable in `docker-compose.school.yml` — nothing to do here.

**All modes**, in order:
1. Edit `supabase/seed/school_template.sql` with the school's real
   name/motto/curriculum, run Step 1 in the SQL Editor, copy the returned
   `school_id`.
2. Authentication → Users → Add User: create the IT Admin's login, copy
   their user ID.
3. Run Step 2 of `school_template.sql` with both IDs filled in.
4. Run Step 3 of `school_template.sql` (fills `school_registry` — your own
   ops record for this install: contact info, deployment type, install
   notes. Deny-all to every school JWT, so this is purely for your own
   support use, never visible inside the app).
5. Log in as IT Admin — they create every other staff member from inside
   the app.

## Backups & Restore

Every Local or Hybrid install gets a nightly `pg_dump` at 2 AM into
`/opt/shule/backups`, 30-day retention, set up automatically by
`install.sh` step 9. Hybrid installs also upload each night's dump to the
cloud project's Storage (`scripts/backup-upload.sh`) — off-site coverage
for a lost/destroyed/stolen server.

To restore, on the school server:
```
sudo bash /opt/shule/restore.sh                  # newest local backup
sudo bash /opt/shule/restore.sh --file <path>     # a specific local backup
sudo bash /opt/shule/restore.sh --from-cloud      # Hybrid only — pulls the
                                                   # newest cloud backup first,
                                                   # for when local backups
                                                   # are gone too
```
Prompts for confirmation before touching anything (`--yes` skips it). Stops
the app + edge functions, restores the database, restarts everything.

Cloud School installs don't need this script — restore via Supabase's own
point-in-time recovery / dashboard backup tooling instead.

## Every Time the Database Changes
```
npm run migrate:new "description of change"
Write SQL in the created file
npm run migrate:push
git add supabase/migrations/
git commit -m "db: description of change"
```
