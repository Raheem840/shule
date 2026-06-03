━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SHULE — School Management System
 USB Installation Package
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PREREQUISITES
─────────────
• A server PC or laptop running Ubuntu 20.04+ or Windows 10+
• Docker Desktop installed (https://docs.docker.com/get-docker/)
• At least 4 GB RAM, 20 GB free disk space
• Local network (Wi-Fi router or LAN switch) for the school
• This USB drive

WHAT'S ON THIS USB
───────────────────
  shule-*.tar              The Shule app (pre-built Docker image)
  docker-compose.school.yml  One command to run everything
  migrations/              Database schema files
  install.sh               Automated setup script
  README.txt               This file

INSTALLATION (5 STEPS)
──────────────────────

Step 1 — Copy this USB folder to the server
  Copy the entire contents of this USB to a folder on the server,
  e.g. C:\shule-install\ or /opt/shule/

Step 2 — Load the Docker image
  Open a terminal in that folder and run:

    Windows:  docker load -i shule-frontend.tar
    Linux:    docker load < shule-frontend.tar

Step 3 — Run the install script
  Windows:  .\install.sh
  Linux:    bash install.sh

  OR do it manually:
    docker compose -f docker-compose.school.yml up -d

Step 4 — Open Shule in any browser on the school network
  On the server itself:   http://localhost
  From any other device:  http://192.168.1.100   (server's IP)

Step 5 — Log in as IT Admin
  Use the credentials provided by the Shule team.
  Then:
    → School Settings: set school name, logo, colors
    → Create the Principal account
    → Create the Secretary account
    → Secretary registers all staff and students

ONBOARDING FLOW
───────────────
  IT Admin logs in
  └── Sets school profile (name, logo, colors, SMS keys)
      └── Creates Principal + Secretary accounts in the app

  Secretary logs in
  ├── Registers all teachers through Staff Wizard
  ├── Registers all students through Student Wizard
  └── Generates parent portal access (SMS or printed credentials)

  Bursar logs in
  └── Imports fee structure and existing payment records

  Principal logs in
  └── Reviews dashboards, confirms academic year is active

SUPPORT
───────
  Email: support@shule.app
  WhatsApp: +256 700 000 000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
