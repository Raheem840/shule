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

## Hybrid School (local + cloud sync)
```
npm run usb:prepare "School Name" hybrid \
  https://xxx.supabase.co CLOUD_ANON_KEY
Copy shule-install/ to USB
On school server: sudo bash install.sh
```
Same as Local, but also wires up the cloud project as a sync target.

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
4. Log in as IT Admin — they create every other staff member from inside
   the app.

## Every Time the Database Changes
```
npm run migrate:new "description of change"
Write SQL in the created file
npm run migrate:push
git add supabase/migrations/
git commit -m "db: description of change"
```
