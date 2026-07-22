import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { db } from '../lib/db'
import { listFiles } from '../lib/storage'
import type { SystemKpis, UserRow, SchoolSettings, ApiConfig } from '../types/week9'

// ── useSystemKpis ──────────────────────────────────────────────────────────
export function useSystemKpis() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['system-kpis', user?.schoolId],
    enabled: !!user?.schoolId && user?.role === 'it_admin',
    queryFn: async (): Promise<SystemKpis> => {
      const sid = user!.schoolId

      const [staffRes, syncRes] = await Promise.all([
        supabase
          .from('staff')
          .select('id, role, is_active')
          .eq('school_id', sid),
        db.sync_queue.where('status').anyOf(['pending', 'failed']).toArray(),
      ])

      if (staffRes.error) throw new Error(staffRes.error.message)

      const staff   = staffRes.data ?? []
      const pending = syncRes.filter(r => r.status === 'pending').length
      const failed  = syncRes.filter(r => r.status === 'failed').length

      const activeToday = 0  // last_login_at is tracked separately; not yet in staff schema

      // Storage size via Storage Management API (approximate) or 0 if unavailable
      let storageUsedMb = 0
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const est = await navigator.storage.estimate()
        storageUsedMb = Math.round((est.usage ?? 0) / (1024 * 1024))
      }

      return {
        totalUsers:        staff.length,
        activeToday,
        roleStats:         [],  // populated by consumer if needed
        storageUsedMb,
        syncQueuePending:  pending,
        syncQueueFailed:   failed,
      }
    },
    staleTime: 60_000,
  })
}

// ── useUserManagement ──────────────────────────────────────────────────────
export function useUserManagement() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['user-management', user?.schoolId],
    enabled: user?.role === 'it_admin',
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, auth_user_id, first_name, last_name, role, is_active, last_login_at')
        .eq('school_id', user!.schoolId)
        .order('first_name', { ascending: true })

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any) => ({
        staffId:    r.id,
        authUserId: r.auth_user_id,
        name:       `${r.first_name} ${r.last_name}`,
        role:       r.role,
        lastLogin:  (r.last_login_at as string) ?? null,
        isActive:   r.is_active,
      } satisfies UserRow))
    },
    staleTime: 60_000,
  })
}

// ── useDeactivateUser ──────────────────────────────────────────────────────
export function useDeactivateUser() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, isActive, authUserId }: { staffId: string; isActive: boolean; authUserId?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      if (user.role !== 'it_admin') throw new Error('Forbidden')

      const { error } = await supabase
        .from('staff')
        .update({ is_active: isActive })
        .eq('id', staffId)
        .eq('school_id', user.schoolId)

      if (error) throw new Error(error.message)

      // Enforce at Supabase Auth level so the user's active session is revoked.
      // This is the part that actually blocks login — if it fails, the DB flag
      // alone is not enough (the JWT hook still refuses claims for is_active=false,
      // but an already-issued token stays valid until it naturally expires).
      if (authUserId) {
        const { error: banError } = await supabase.functions.invoke('set-user-disabled', {
          body: { authUserId, disabled: !isActive, schoolId: user.schoolId },
        })
        if (banError) throw new Error(`Staff record updated, but the auth-level ${isActive ? 'reactivation' : 'ban'} failed: ${banError.message}`)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['credentials-vault', user?.schoolId] })
    },
  })
}

// ── useSchoolSettings ──────────────────────────────────────────────────────
export function useSchoolSettings() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['school-settings', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<SchoolSettings> => {
      // maybeSingle() returns null (not error) when the row doesn't exist
      const { data, error } = await supabase
        .from('school_profile')
        .select('id, school_name, short_name, motto, logo_url, primary_color, curriculum')
        .eq('id', user!.schoolId)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) throw new Error('School profile not found for this account. Contact your system administrator.')

      return {
        id:           data.id,
        schoolName:   data.school_name,
        shortName:    data.short_name,
        motto:        data.motto,
        logoUrl:      data.logo_url,
        primaryColor: data.primary_color ?? '#0d9488',
        currency:     'UGX',
        curriculum:   data.curriculum ?? null,
      }
    },
    staleTime: 10 * 60_000,
  })
}

// ── useSaveSchoolSettings ──────────────────────────────────────────────────
export function useSaveSchoolSettings() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<Omit<SchoolSettings, 'id'>>) => {
      if (!user) throw new Error('Not authenticated')
      if (!['it_admin', 'principal'].includes(user.role)) throw new Error('Forbidden')

      const updates: Record<string, unknown> = {}
      if (settings.schoolName  != null) updates['school_name']   = settings.schoolName
      if (settings.shortName   != null) updates['short_name']    = settings.shortName
      if (settings.motto       != null) updates['motto']         = settings.motto
      if (settings.logoUrl     != null) updates['logo_url']      = settings.logoUrl
      if (settings.primaryColor != null) updates['primary_color'] = settings.primaryColor

      const { error } = await supabase
        .from('school_profile')
        .update(updates)
        .eq('id', user.schoolId)

      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['school-settings', user?.schoolId] })
      // When short_name changes the DB trigger re-prefixes all staff numbers
      if (variables.shortName != null) {
        void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
        void qc.invalidateQueries({ queryKey: ['next-staff-num', user?.schoolId] })
      }
    },
  })
}

// ── useSaveApiConfig ───────────────────────────────────────────────────────
// API keys are NEVER returned in plain text after saving.
// The RPC uses SECURITY DEFINER to write to Supabase Vault.
// After save, the UI shows only masked values ("••••••••").
export function useSaveApiConfig() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (config: {
      keyName: 'at_api_key' | 'at_username' | 'at_sender_id' | 'wa_phone_number_id' | 'wa_access_token'
      keyValue: string
      enabled: boolean
    }) => {
      if (!user) throw new Error('Not authenticated')

      // RPC call — server function writes to Vault with service_role
      const { error } = await supabase.rpc('save_school_api_key', {
        p_school_id: user.schoolId,
        p_key_name:  config.keyName,
        p_key_value: config.keyValue,
        p_enabled:   config.enabled,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['api-config', user?.schoolId] })
    },
  })
}

// ── useApiConfigStatus ─────────────────────────────────────────────────────
// Returns only whether each API is configured and enabled — never the key value.
export function useApiConfigStatus() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['api-config', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<ApiConfig> => {
      // Derive "enabled"/"set" purely from whether each credential exists.
      // Calls a SECURITY DEFINER RPC that never returns the actual secret
      // values — only booleans — and is itself restricted to
      // principal/it_admin. The raw columns are no longer selectable by the
      // client at all (see migration 20260721_000001): even a
      // legitimately-authorized session used to receive the live API
      // keys/tokens over the network here just to compute presence flags
      // that were the only thing ever rendered.
      const { data } = await supabase.rpc('get_messaging_config_status').maybeSingle()

      const row = (data ?? {}) as Record<string, unknown>
      return {
        atApiKey:        null,
        atUsername:      null,
        atSenderId:      null,
        waPhoneNumberId: null,
        waAccessToken:   null,
        atEnabled:       Boolean(row['at_api_key_set']),
        waEnabled:       Boolean(row['wa_access_token_set']),
        atApiKeySet:       Boolean(row['at_api_key_set']),
        atUsernameSet:     Boolean(row['at_username_set']),
        atSenderIdSet:     Boolean(row['at_sender_id_set']),
        waPhoneNumberIdSet: Boolean(row['wa_phone_number_id_set']),
        waAccessTokenSet:   Boolean(row['wa_access_token_set']),
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useAcademicYears ───────────────────────────────────────────────────────
// IT Admin manages academic years and the survey_active toggle.
export function useAcademicYears() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['academic-years', user?.schoolId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select(
          'id, school_id, label, start_date, end_date, is_active,' +
          ' term1_start, term1_end, term2_start, term2_end,' +
          ' term3_start, term3_end, survey_active'
        )
        .eq('school_id', user!.schoolId)
        .order('start_date', { ascending: false })

      if (error) throw new Error(error.message)
      return (data ?? []).map((r: any) => ({ ...r, name: r.label }))  // label is the real column
    },
    staleTime: 5 * 60_000,
  })
}

// ── useStorageBuckets ──────────────────────────────────────────────────────
// listBuckets() requires the service role key and returns empty with the
// anon key. Use the known bucket names from the schema instead, then query
// each for file count/size (which the anon key CAN do via RLS).
const KNOWN_BUCKETS: Array<{ name: string; public: boolean }> = [
  { name: 'staff-photos',      public: false },
  { name: 'student-photos',    public: false },
  { name: 'documents',         public: false },
  { name: 'report-cards',      public: true  },
  { name: 'templates',         public: false },
  { name: 'staff-attachments', public: true  },
]

// Recursively list all files in a bucket prefix, up to 4 levels deep.
// Items with a non-null id are files; null-id items are virtual folders.
async function listBucketFiles(
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<{ fileCount: number; totalBytes: number }> {
  if (depth > 4) return { fileCount: 0, totalBytes: 0 }
  const items = await listFiles(bucket, prefix, { limit: 1000 }).catch(() => [] as Awaited<ReturnType<typeof listFiles>>)
  let fileCount = 0
  let totalBytes = 0
  await Promise.all(
    items.map(async item => {
      if (item.id !== null) {
        fileCount++
        totalBytes += (item.metadata as { size?: number } | null)?.size ?? 0
      } else {
        const sub = prefix ? `${prefix}/${item.name}` : item.name
        const r = await listBucketFiles(bucket, sub, depth + 1)
        fileCount  += r.fileCount
        totalBytes += r.totalBytes
      }
    })
  )
  return { fileCount, totalBytes }
}

export function useStorageBuckets() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['storage-buckets', user?.schoolId],
    enabled: !!user && user?.role === 'it_admin',
    queryFn: async () => {
      const results = await Promise.allSettled(
        KNOWN_BUCKETS.map(async (b) => {
          const { fileCount, totalBytes } = await listBucketFiles(b.name, '')
          return {
            name:      b.name,
            isPublic:  b.public,
            fileCount,
            sizeMb:    +(totalBytes / (1024 * 1024)).toFixed(2),
          }
        })
      )

      return results
        .filter((r): r is PromiseFulfilledResult<{ name: string; isPublic: boolean; fileCount: number; sizeMb: number }> =>
          r.status === 'fulfilled'
        )
        .map(r => r.value)
    },
    staleTime: 5 * 60_000,
  })
}

// ── Promotion year-rollover helpers ─────────────────────────────────────────
// Classes are year-scoped (classes.academic_year_id is required — each academic
// year has its own class rows). Promotion must therefore move a student not just
// to the next grade LEVEL, but into the NEXT academic year's class at that level,
// creating that year/those classes if they don't exist yet.

type YearRow = {
  id: string; label: string; start_date: string | null; end_date: string | null; is_active: boolean
  term1_start: string | null; term1_end: string | null
  term2_start: string | null; term2_end: string | null
  term3_start: string | null; term3_end: string | null
}

function shiftDate(d: string | null, days: number): string | null {
  if (!d) return null
  const dt = new Date(d)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

// Resolves the academic year that comes chronologically after the school's
// active year. If none exists yet, creates one — shifting the active year's
// own date structure (and each term's dates) forward by its exact day-count,
// so an irregular (non-Jan-Dec) calendar is preserved rather than reset to
// AcademicYearPage's generic Jan 1 – Dec 31 "+ New Year" default. Always
// is_active=false — the principal still explicitly activates it via that
// page when the new year actually begins.
async function resolveOrCreateNextAcademicYear(schoolId: string): Promise<{ id: string; label: string }> {
  const { data: yearsData, error } = await supabase
    .from('academic_years')
    .select('id, label, start_date, end_date, is_active, term1_start, term1_end, term2_start, term2_end, term3_start, term3_end')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: true })
  if (error) throw new Error(error.message)

  const years  = (yearsData ?? []) as YearRow[]
  const active = years.find(y => y.is_active)
  if (!active) throw new Error('No active academic year is set. Configure one in Academic Years before promoting students.')

  const candidates = years
    .filter(y => y.id !== active.id && active.start_date && y.start_date && y.start_date > active.start_date)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
  if (candidates.length > 0) return { id: candidates[0].id, label: candidates[0].label }

  let offsetDays = 365
  if (active.start_date && active.end_date) {
    offsetDays = Math.round((new Date(active.end_date).getTime() - new Date(active.start_date).getTime()) / 86_400_000) + 1
  }
  const nextStart = shiftDate(active.end_date, 1)
  const nextEnd   = active.start_date && active.end_date ? shiftDate(nextStart, offsetDays - 1) : null
  // Increment EVERY 4-digit year found (not just the first) — a "2025/2026"
  // range label must become "2026/2027", not "2026/2026".
  const nextLabel = /\d{4}/.test(active.label)
    ? active.label.replace(/\d{4}/g, m => String(Number(m) + 1))
    : `${active.label} (Next)`

  const { data: created, error: createErr } = await supabase
    .from('academic_years')
    .insert({
      school_id: schoolId, label: nextLabel,
      start_date: nextStart, end_date: nextEnd,
      is_active: false, survey_active: false,
      term1_start: shiftDate(active.term1_start, offsetDays), term1_end: shiftDate(active.term1_end, offsetDays),
      term2_start: shiftDate(active.term2_start, offsetDays), term2_end: shiftDate(active.term2_end, offsetDays),
      term3_start: shiftDate(active.term3_start, offsetDays), term3_end: shiftDate(active.term3_end, offsetDays),
    })
    .select('id')
    .single()
  if (createErr) throw new Error(createErr.message)
  return { id: created!.id as string, label: nextLabel }
}

type ClassRow  = { id: string; name: string; level: string | null }
type StreamRow = { id: string; name: string; class_id: string }

// Ensures the target year has a class for every class the source year has
// (matched by name), auto-creating any missing ones (and their streams) by
// copying the source year's structure forward. Returns lookups needed to
// resolve where a promoted student's new class_id/stream_id should point.
async function ensureClassesForYear(schoolId: string, sourceYearId: string, targetYearId: string) {
  const [sourceRes, targetRes] = await Promise.all([
    supabase.from('classes').select('id, name, level').eq('school_id', schoolId).eq('academic_year_id', sourceYearId),
    supabase.from('classes').select('id, name, level').eq('school_id', schoolId).eq('academic_year_id', targetYearId),
  ])
  if (sourceRes.error) throw new Error(sourceRes.error.message)
  if (targetRes.error) throw new Error(targetRes.error.message)

  const sourceClasses = (sourceRes.data ?? []) as ClassRow[]
  let targetClasses   = (targetRes.data ?? []) as ClassRow[]
  const targetByName  = new Map(targetClasses.map(c => [c.name, c]))

  const missing = sourceClasses.filter(c => !targetByName.has(c.name))
  if (missing.length > 0) {
    const { error: insErr } = await supabase.from('classes').insert(
      missing.map(c => ({ school_id: schoolId, academic_year_id: targetYearId, name: c.name, level: c.level }))
    )
    if (insErr) throw new Error(insErr.message)
    const { data: refetched, error: refErr } = await supabase
      .from('classes').select('id, name, level').eq('school_id', schoolId).eq('academic_year_id', targetYearId)
    if (refErr) throw new Error(refErr.message)
    targetClasses = (refetched ?? []) as ClassRow[]
    targetClasses.forEach(c => targetByName.set(c.name, c))
  }

  const sourceToTargetClassId = new Map<string, string>()
  for (const sc of sourceClasses) {
    const tc = targetByName.get(sc.name)
    if (tc) sourceToTargetClassId.set(sc.id, tc.id)
  }

  // Copy streams for any newly-created target class that has none yet.
  const [sourceStreamsRes, targetStreamsRes] = await Promise.all([
    sourceClasses.length
      ? supabase.from('streams').select('id, name, class_id').eq('school_id', schoolId).in('class_id', sourceClasses.map(c => c.id))
      : Promise.resolve({ data: [], error: null }),
    targetClasses.length
      ? supabase.from('streams').select('id, name, class_id').eq('school_id', schoolId).in('class_id', targetClasses.map(c => c.id))
      : Promise.resolve({ data: [], error: null }),
  ])
  if (sourceStreamsRes.error) throw new Error(sourceStreamsRes.error.message)
  if (targetStreamsRes.error) throw new Error(targetStreamsRes.error.message)

  const targetStreamsByClass = new Map<string, Map<string, string>>()
  for (const st of (targetStreamsRes.data ?? []) as StreamRow[]) {
    if (!targetStreamsByClass.has(st.class_id)) targetStreamsByClass.set(st.class_id, new Map())
    targetStreamsByClass.get(st.class_id)!.set(st.name, st.id)
  }

  const streamsToInsert: { school_id: string; class_id: string; name: string }[] = []
  for (const st of (sourceStreamsRes.data ?? []) as StreamRow[]) {
    const targetClassId = sourceToTargetClassId.get(st.class_id)
    if (!targetClassId) continue
    const alreadyHas = targetStreamsByClass.get(targetClassId)?.has(st.name)
    if (!alreadyHas) streamsToInsert.push({ school_id: schoolId, class_id: targetClassId, name: st.name })
  }
  if (streamsToInsert.length > 0) {
    const { error: streamInsErr } = await supabase.from('streams').insert(streamsToInsert)
    if (streamInsErr) throw new Error(streamInsErr.message)
    const { data: refetchedStreams } = await supabase
      .from('streams').select('id, name, class_id').eq('school_id', schoolId).in('class_id', targetClasses.map(c => c.id))
    targetStreamsByClass.clear()
    for (const st of (refetchedStreams ?? []) as StreamRow[]) {
      if (!targetStreamsByClass.has(st.class_id)) targetStreamsByClass.set(st.class_id, new Map())
      targetStreamsByClass.get(st.class_id)!.set(st.name, st.id)
    }
  }

  return { sourceToTargetClassId, targetStreamsByClass, sourceClasses }
}

function parseLevel(level: string | null): number | null {
  if (level == null || level === '') return null
  const n = Number(level)
  return Number.isFinite(n) ? n : null
}

export type PromotionOutcome = { promoted: number; completed: number; skipped: number; total: number; nextYearLabel: string }

// Shared by usePromoteStudents (all active students) and useSelectivePromote
// (an explicit subset). Resolves/creates the next academic year, mirrors its
// class/stream structure forward, then moves each student to the class one
// level up IN THAT YEAR (never just the same year's differently-named class —
// classes are year-scoped, so "promoting" must mean moving year, not just level).
async function runPromotion(
  schoolId: string, scope: 'all' | string[],
  onProgress?: (current: number, total: number) => void,
): Promise<PromotionOutcome> {
  let sq = supabase.from('students').select('id, class_id, stream_id').eq('school_id', schoolId).eq('status', 'active')
  if (scope !== 'all') sq = sq.in('id', scope)
  const { data: studentsData, error: stuErr } = await sq
  if (stuErr) throw new Error(stuErr.message)
  const students = (studentsData ?? []) as { id: string; class_id: string | null; stream_id: string | null }[]
  const total = students.length
  if (total === 0) return { promoted: 0, completed: 0, skipped: 0, total: 0, nextYearLabel: '' }

  const { data: activeYearRow, error: yearErr } = await supabase
    .from('academic_years').select('id').eq('school_id', schoolId).eq('is_active', true).maybeSingle()
  if (yearErr) throw new Error(yearErr.message)
  if (!activeYearRow) throw new Error('No active academic year is set. Configure one in Academic Years before promoting students.')
  const sourceYearId = activeYearRow.id as string

  const { id: targetYearId, label: nextYearLabel } = await resolveOrCreateNextAcademicYear(schoolId)
  const { sourceToTargetClassId, targetStreamsByClass, sourceClasses } = await ensureClassesForYear(schoolId, sourceYearId, targetYearId)

  const levelById = new Map<string, number | null>()
  let maxLevel: number | null = null
  for (const c of sourceClasses) {
    const lvl = parseLevel(c.level)
    levelById.set(c.id, lvl)
    if (lvl != null && (maxLevel === null || lvl > maxLevel)) maxLevel = lvl
  }
  // level -> this year's class id, so we can find "level+1" then map that
  // source class id through sourceToTargetClassId to the actual next-year class.
  // If two classes share the same level (e.g. parallel classes modeled as
  // separate `classes` rows instead of `streams`), the mapping is genuinely
  // ambiguous — mark it so affected students are skipped with a clear count
  // instead of silently collapsing onto whichever class was seen last.
  const sourceClassIdByLevel = new Map<number, string>()
  const ambiguousLevels = new Set<number>()
  for (const c of sourceClasses) {
    const lvl = levelById.get(c.id)
    if (lvl == null) continue
    if (sourceClassIdByLevel.has(lvl) && sourceClassIdByLevel.get(lvl) !== c.id) ambiguousLevels.add(lvl)
    else sourceClassIdByLevel.set(lvl, c.id)
  }

  const relevantClassIds = [...new Set(students.map(s => s.class_id).filter((id): id is string => !!id))]
  const { data: sourceStreamsData } = relevantClassIds.length
    ? await supabase.from('streams').select('id, name, class_id').eq('school_id', schoolId).in('class_id', relevantClassIds)
    : { data: [] as StreamRow[] }
  const sourceStreamById = new Map(((sourceStreamsData ?? []) as StreamRow[]).map(s => [s.id, s.name]))

  const toComplete: string[] = []
  const skipped: string[] = []
  // Group by (targetClassId, targetStreamId) to batch updates.
  const toPromoteMap = new Map<string, { classId: string; streamId: string | null; ids: string[] }>()

  for (const s of students) {
    const level = s.class_id ? levelById.get(s.class_id) : undefined
    if (!s.class_id || level == null) { skipped.push(s.id); continue }
    if (maxLevel != null && level === maxLevel) { toComplete.push(s.id); continue }
    if (ambiguousLevels.has(level + 1)) { skipped.push(s.id); continue }

    const nextSourceClassId = sourceClassIdByLevel.get(level + 1)
    const targetClassId     = nextSourceClassId ? sourceToTargetClassId.get(nextSourceClassId) : undefined
    if (!targetClassId) { skipped.push(s.id); continue }

    const streamName = s.stream_id ? sourceStreamById.get(s.stream_id) : undefined
    const targetStreamId = streamName ? targetStreamsByClass.get(targetClassId)?.get(streamName) ?? null : null

    const key = `${targetClassId}::${targetStreamId ?? 'none'}`
    if (!toPromoteMap.has(key)) toPromoteMap.set(key, { classId: targetClassId, streamId: targetStreamId, ids: [] })
    toPromoteMap.get(key)!.ids.push(s.id)
  }

  let processed = 0
  if (toComplete.length > 0) {
    for (let i = 0; i < toComplete.length; i += 100) {
      const { error } = await supabase.from('students')
        .update({ status: 'completed', class_id: null, stream_id: null })
        .eq('school_id', schoolId)
        .in('id', toComplete.slice(i, i + 100))
      if (error) throw new Error(error.message)
      processed += Math.min(100, toComplete.length - i)
      onProgress?.(processed, total)
    }
  }

  for (const { classId, streamId, ids } of toPromoteMap.values()) {
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from('students')
        .update({ class_id: classId, stream_id: streamId, academic_year_id: targetYearId })
        .eq('school_id', schoolId)
        .in('id', ids.slice(i, i + 100))
      if (error) throw new Error(error.message)
      processed += Math.min(100, ids.length - i)
      onProgress?.(processed, total)
    }
  }

  const promoted = [...toPromoteMap.values()].reduce((sum, g) => sum + g.ids.length, 0)
  return { promoted, completed: toComplete.length, skipped: skipped.length, total, nextYearLabel }
}

// ── usePromoteStudents ─────────────────────────────────────────────────────
// Promotes all active students to next year's class one level up. Students at
// the highest configured level (e.g. S.4/S.6) → completed.
export function usePromoteStudents() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (onProgress?: (current: number, total: number) => void): Promise<PromotionOutcome> => {
      if (!user) throw new Error('Not authenticated')
      if (!['deputy', 'secretary'].includes(user.role)) throw new Error('Forbidden')
      return runPromotion(user.schoolId, 'all', onProgress)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years-full', user?.schoolId] })
    },
  })
}

// ── useLoadPromotionCandidates ─────────────────────────────────────────────
// Loads students with their avg exam score for the given term/year.
// Returns one entry per student with their performance grade.

export type PerformanceGrade = 'Exceptional' | 'Proficient' | 'Needs Improvement' | 'Advised to Stay Back' | 'No Data'

export type PromotionCandidate = {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
  classId: string | null
  className: string
  avgScore: number | null
  grade: PerformanceGrade
  isTerminal: boolean   // true when at the school's highest configured class level
}

function scoreToGrade(avg: number | null): PerformanceGrade {
  if (avg === null) return 'No Data'
  if (avg >= 80)   return 'Exceptional'
  if (avg >= 60)   return 'Proficient'
  if (avg >= 50)   return 'Needs Improvement'
  return 'Advised to Stay Back'
}

export function useLoadPromotionCandidates() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ term, year }: { term: string; year: number }): Promise<PromotionCandidate[]> => {
      if (!user) throw new Error('Not authenticated')
      if (!['deputy', 'secretary'].includes(user.role)) throw new Error('Forbidden')
      const sid = user.schoolId

      // Same active-year scoping runPromotion itself uses for maxLevel/terminal
      // detection — otherwise a stale/duplicate class row from another year
      // could shift maxLevel and make this preview disagree with what the
      // actual promotion run does for the same student.
      const { data: activeYearRow, error: activeYearErr } = await supabase
        .from('academic_years').select('id').eq('school_id', sid).eq('is_active', true).maybeSingle()
      if (activeYearErr) throw new Error(activeYearErr.message)

      // Load students + classes in parallel with exam results aggregated in JS
      const [studentsRes, classesRes, resultsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, first_name, last_name, admission_number, class_id')
          .eq('school_id', sid)
          .eq('status', 'active'),
        (() => {
          let q = supabase.from('classes').select('id, name, level').eq('school_id', sid)
          if (activeYearRow?.id) q = q.eq('academic_year_id', activeYearRow.id)
          return q
        })(),
        supabase
          .from('exam_results')
          .select('student_id, score')
          .eq('school_id', sid)
          .eq('term', term)
          .eq('year', year),
      ])

      if (studentsRes.error) throw new Error(studentsRes.error.message)
      if (classesRes.error)  throw new Error(classesRes.error.message)

      const classById = new Map((classesRes.data ?? []).map((c: any) => [c.id as string, c.name as string]))
      let maxLevel: number | null = null
      for (const c of (classesRes.data ?? []) as { level: string | null }[]) {
        const lvl = parseLevel(c.level)
        if (lvl != null && (maxLevel === null || lvl > maxLevel)) maxLevel = lvl
      }
      const levelByClassId = new Map((classesRes.data ?? []).map((c: any) => [c.id as string, parseLevel(c.level)]))

      // Aggregate scores per student
      const scoreMap = new Map<string, { sum: number; count: number }>()
      for (const r of (resultsRes.data ?? []) as Array<{ student_id: string; score: number | null }>) {
        if (r.score == null) continue
        const entry = scoreMap.get(r.student_id) ?? { sum: 0, count: 0 }
        entry.sum += r.score
        entry.count++
        scoreMap.set(r.student_id, entry)
      }

      return (studentsRes.data ?? []).map((s: any) => {
        const entry   = scoreMap.get(s.id as string)
        const avg     = entry && entry.count > 0 ? entry.sum / entry.count : null
        const cName   = classById.get(s.class_id as string) ?? '—'
        const level   = levelByClassId.get(s.class_id as string) ?? null
        return {
          id:              s.id as string,
          firstName:       s.first_name as string,
          lastName:        s.last_name as string,
          admissionNumber: s.admission_number as string,
          classId:         s.class_id as string | null,
          className:       cName,
          avgScore:        avg !== null ? Math.round(avg * 10) / 10 : null,
          grade:           scoreToGrade(avg),
          isTerminal:      level != null && maxLevel != null && level === maxLevel,
        } satisfies PromotionCandidate
      })
    },
  })
}

// ── useSelectivePromote ────────────────────────────────────────────────────
// Promotes only the explicitly selected students, into next year's class one
// level up. Students at the highest configured level → completed.
export function useSelectivePromote() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (selectedIds: string[]): Promise<PromotionOutcome> => {
      if (!user) throw new Error('Not authenticated')
      if (!['deputy', 'secretary'].includes(user.role ?? '')) throw new Error('Forbidden')
      if (selectedIds.length === 0) return { promoted: 0, completed: 0, skipped: 0, total: 0, nextYearLabel: '' }
      return runPromotion(user.schoolId, selectedIds)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years-full', user?.schoolId] })
    },
  })
}

// ── useToggleSurvey ────────────────────────────────────────────────────────
// DoS (and IT Admin) toggles survey_active on an academic year.
export function useToggleSurvey() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ yearId, active }: { yearId: string; active: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      if (!['it_admin', 'dos', 'principal'].includes(user.role ?? '')) throw new Error('Forbidden')

      const { error } = await supabase
        .from('academic_years')
        .update({ survey_active: active })
        .eq('id', yearId)
        .eq('school_id', user.schoolId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years-full', user?.schoolId] })
    },
  })
}
