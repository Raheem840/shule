#!/usr/bin/env node
// Generates a unique, per-school secret set for an on-prem / local Supabase
// stack: a random JWT signing secret, anon + service_role JWTs signed with
// it, a strong Postgres password, Kong dashboard credentials, and a
// Realtime SECRET_KEY_BASE.
//
// Deliberately built on Node's built-in `crypto` module only (no npm
// dependencies) so it runs on a bare `node` install before `npm ci` — this
// script is meant to run "at home" as the first step of packaging an
// install for a school, before the frontend Docker image is even built.
//
// IMPORTANT: every school gets its OWN secret set. Never reuse one school's
// JWT_SECRET/keys for another install, and never commit the output file —
// anyone who has it can forge auth tokens for that school's database.
//
// Usage:
//   node scripts/generate-local-secrets.js "School Name" http://192.168.1.100 > shule-install/secrets.env
//   node scripts/generate-local-secrets.js "School Name" http://192.168.1.100 hybrid \
//     https://xxx.supabase.co CLOUD_SERVICE_ROLE_KEY > shule-install/secrets.env
//
// The last two args (only meaningful when mode=hybrid) are the school's
// SEPARATE cloud Supabase project, used only as an off-site target for
// nightly backup uploads (scripts/backup-upload.sh) — never for live
// traffic, and CLOUD_SERVICE_KEY must be that project's service_role key,
// not its anon key. This file only ever lives on the school's own server
// and this operator's machine — it is never bundled into the frontend
// build, so a service-role key here is safe in a way it would NOT be as a
// VITE_-prefixed build arg.

import crypto from 'node:crypto'

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerPart = base64url(JSON.stringify(header))
  const payloadPart = base64url(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${headerPart}.${payloadPart}.${signature}`
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, bytes)
}

const schoolName = process.argv[2]
const siteUrl = process.argv[3]
const mode = process.argv[4] || 'local'
const cloudUrl = process.argv[5] || ''
const cloudServiceKey = process.argv[6] || ''

if (!schoolName || !siteUrl) {
  console.error('Usage: node scripts/generate-local-secrets.js "School Name" http://192.168.1.100 [hybrid CLOUD_URL CLOUD_SERVICE_KEY]')
  process.exit(1)
}

const jwtSecret = randomToken(48)
const now = Math.floor(Date.now() / 1000)
const tenYears = 10 * 365 * 24 * 60 * 60

const anonKey = signJwt({ role: 'anon', iss: 'shule-onprem', iat: now, exp: now + tenYears }, jwtSecret)
const serviceRoleKey = signJwt({ role: 'service_role', iss: 'shule-onprem', iat: now, exp: now + tenYears }, jwtSecret)

const siteUrlClean = siteUrl.replace(/\/+$/, '')

const env = {
  SCHOOL_NAME: schoolName,
  SITE_URL: siteUrlClean,
  API_EXTERNAL_URL: `${siteUrlClean}:8000/auth/v1`,
  SUPABASE_PUBLIC_URL: `${siteUrlClean}:8000`,
  JWT_SECRET: jwtSecret,
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceRoleKey,
  POSTGRES_PASSWORD: randomToken(32),
  DASHBOARD_USERNAME: 'admin',
  DASHBOARD_PASSWORD: randomToken(20),
  SECRET_KEY_BASE: randomToken(64),
  MODE: mode,
  CLOUD_URL: cloudUrl,
  CLOUD_SERVICE_KEY: cloudServiceKey,
}

// Quoted so this file is safe to both `source` in bash (SCHOOL_NAME can
// contain spaces) and load via `docker compose --env-file`.
for (const [key, value] of Object.entries(env)) {
  console.log(`${key}="${String(value).replace(/(["\\$`])/g, '\\$1')}"`)
}

console.error('')
console.error(`✓ Generated secrets for "${schoolName}"`)
console.error('  Keep this file safe — it is the only copy. Losing it means every')
console.error('  school-side login and API key must be regenerated and re-issued.')
console.error('  It is already git-ignored; never commit it.')
