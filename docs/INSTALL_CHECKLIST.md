# Shule — Installation Checklist

## Before Leaving Office
- [ ] Frontend Docker image built and saved to USB
- [ ] All Supabase Docker images saved to USB
- [ ] Migration files copied to USB
- [ ] school_template.sql copied to USB
- [ ] install.sh, restore.sh, backup-upload.sh on USB
- [ ] Credentials sheet printed and sealed
- [ ] QR code printed (http://192.168.1.100)

## On-Site Technical (45 min)
- [ ] sudo bash install.sh ran successfully
- [ ] All containers running (docker ps)
- [ ] Shule accessible at http://192.168.1.100
- [ ] Supabase Studio at http://192.168.1.100:8000
- [ ] JWT hook registered (Auth → Hooks)
- [ ] IT Admin created in Auth → Users
- [ ] IT Admin row inserted into staff table
- [ ] IT Admin logs in successfully
- [ ] Nightly backup cron confirmed in crontab (`crontab -l`) — plus cloud
      upload configured, for Hybrid installs

## On-Site Setup (30 min)
- [ ] School profile configured
- [ ] School logo uploaded
- [ ] Academic year configured
- [ ] Departments created
- [ ] Secretary account created by IT Admin

## Staff Registration (45 min)
- [ ] All teaching staff registered
- [ ] Principal registered
- [ ] Bursar registered
- [ ] All staff log in and verify access
- [ ] Each role sees correct dashboard

## Devices (30 min)
- [ ] All staff devices on school WiFi
- [ ] Shule opens on all devices
- [ ] PWA installed on key devices
- [ ] QR code posted in staffroom

## Training (2 hours)
- [ ] IT Admin (30 min)
- [ ] Secretary (45 min)
- [ ] Bursar (45 min)
- [ ] Teachers (30 min)
- [ ] Principal (30 min)

## Handover
- [ ] Credentials envelope handed to Principal
- [ ] Support WhatsApp number shared
- [ ] School added to Shule Admin Dashboard
- [ ] Status set to Active
