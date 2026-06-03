# Adding a New School to Shule

## Local School (no internet)
```
npm run usb:prepare "School Name" \
  http://192.168.1.100:8000 ANON_KEY
Copy shule-install/ to USB
On school server: sudo bash install.sh
```

## Cloud School (reliable internet)
```
npm run install:school NEW_PROJECT_REF
npm run build:school "School Name" \
  https://xxx.supabase.co ANON_KEY cloud
```

## Hybrid School (local + cloud)
```
npm run install:school CLOUD_PROJECT_REF
npm run build:school "School Name" \
  http://192.168.1.100:8000 LOCAL_ANON_KEY hybrid \
  https://xxx.supabase.co CLOUD_ANON_KEY
```

## After Every Installation
1. Register JWT hook in Supabase Dashboard
   Authentication → Hooks → Custom Access Token Hook
2. Create IT Admin in Authentication → Users
3. INSERT IT Admin row into staff table
4. IT Admin creates all other staff through the app

## Every Time the Database Changes
```
npm run migrate:new "description of change"
Write SQL in the created file
npm run migrate:push
git add supabase/migrations/
git commit -m "db: description of change"
```
