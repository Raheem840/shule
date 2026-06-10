/**
 * Seed script — academic year, classes, and streams for school 00000000-0000-0000-0000-000000000001
 *
 * Run with tsx (handles ESM TypeScript with zero config — ts-node needs extra
 * flags because this project is "type":"module" + moduleResolution:"bundler"):
 *
 *   npx tsx scripts/seed-academic-year.ts
 *
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Safe to re-run only if you delete the rows first — upsert is not used so
 * duplicate school_id+label rows will surface as a DB constraint error.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Load .env.local (no dotenv dependency needed) ──────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

try {
  const raw = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(k in process.env)) process.env[k] = v   // don't overwrite shell env
  }
} catch {
  console.error('✗  Could not read .env.local — make sure it exists in the project root.')
  process.exit(1)
}

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '✗  Missing env vars.\n' +
    '   VITE_SUPABASE_URL        : ' + (SUPABASE_URL      ? '✓' : 'MISSING') + '\n' +
    '   SUPABASE_SERVICE_ROLE_KEY: ' + (SERVICE_ROLE_KEY  ? '✓' : 'MISSING')
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Constants ───────────────────────────────────────────────────────────────
const SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

// ── Helpers ─────────────────────────────────────────────────────────────────
function die(context: string, msg: string): never {
  console.error(`\n✗  ${context}: ${msg}`)
  process.exit(1)
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nShule seed — academic year, classes, streams')
  console.log('school_id:', SCHOOL_ID)
  console.log('─'.repeat(52))

  // 1. Academic year ──────────────────────────────────────────────────────
  console.log('\n[1/3] Inserting academic year…')

  const { data: year, error: yearErr } = await supabase
    .from('academic_years')
    .insert({
      school_id:     SCHOOL_ID,
      label:         '2026',          // real stored column
      // 'name' is a generated alias of label in this DB — omit from insert
      start_date:    '2026-02-03',    // overall year start (first term start)
      end_date:      '2026-11-27',    // overall year end   (last term end)
      is_active:     true,
      survey_active: false,
      term1_start:   '2026-02-03',
      term1_end:     '2026-05-22',
      term2_start:   '2026-05-18',
      term2_end:     '2026-08-14',
      term3_start:   '2026-09-07',
      term3_end:     '2026-11-27',
    })
    .select('id, label')
    .single()

  if (yearErr) die('academic_years', yearErr.message)
  console.log(`    ✓ academic_year  label="${year.label}"  id=${year.id}`)

  const academicYearId = year.id

  // 2. Classes ────────────────────────────────────────────────────────────
  console.log('\n[2/3] Inserting classes…')

  const classInput = [
    { name: 'S.1', level: 'S1' },
    { name: 'S.2', level: 'S2' },
    { name: 'S.3', level: 'S3' },
    { name: 'S.4', level: 'S4' },
  ].map(c => ({
    school_id:        SCHOOL_ID,
    academic_year_id: academicYearId,
    name:             c.name,
    level:            c.level,
  }))

  const { data: classes, error: classErr } = await supabase
    .from('classes')
    .insert(classInput)
    .select('id, name')

  if (classErr) die('classes', classErr.message)
  for (const c of classes) {
    console.log(`    ✓ class  name="${c.name}"  id=${c.id}`)
  }

  // 3. Streams ────────────────────────────────────────────────────────────
  console.log('\n[3/3] Inserting streams…')

  // S.1 + S.2 → East / West    |    S.3 + S.4 → A / B
  const STREAM_NAMES: Record<string, string[]> = {
    'S.1': ['East', 'West'],
    'S.2': ['East', 'West'],
    'S.3': ['East', 'West'],
    'S.4': ['East', 'West'],
  }

  const streamInput = classes.flatMap(cls =>
    (STREAM_NAMES[cls.name] ?? ['A', 'B']).map(name => ({
      school_id: SCHOOL_ID,
      class_id:  cls.id,
      name,
    }))
  )

  const { data: streams, error: streamErr } = await supabase
    .from('streams')
    .insert(streamInput)
    .select('id, name, class_id')

  if (streamErr) die('streams', streamErr.message)

  // Print each stream grouped under its class
  const classById = new Map(classes.map(c => [c.id, c.name]))
  for (const s of streams) {
    const className = classById.get(s.class_id) ?? s.class_id
    console.log(`    ✓ stream  name="${s.name}"  class="${className}"  id=${s.id}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(52))
  console.log(`✓ Done — 1 academic year · ${classes.length} classes · ${streams.length} streams`)
  console.log('─'.repeat(52) + '\n')
}

main().catch(err => {
  console.error('\n✗ Unexpected error:', err)
  process.exit(1)
})
