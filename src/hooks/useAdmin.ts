import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { db } from '../lib/db'
import { listFiles } from '../lib/storage'
import { generateTempPassword } from '../lib/passwords'
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

// ── useResetPassword ───────────────────────────────────────────────────────
// Calls a Supabase Edge Function to reset a staff member's password.
// The Edge Function runs with service_role key — never expose it to the client.
export function useResetPassword() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (authUserId: string): Promise<{ newPassword: string }> => {
      if (!user) throw new Error('Not authenticated')
      if (user.role !== 'it_admin') throw new Error('Forbidden')

      const newPassword = generateTempPassword()
      const { error } = await supabase.functions.invoke('reset-staff-password', {
        body: { userId: authUserId, newPassword },
      })

      if (error) throw new Error(error.message)
      return { newPassword }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['credentials-vault', user?.schoolId] })
    },
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

      // Enforce at Supabase Auth level so the user's active session is revoked
      if (authUserId) {
        await supabase.functions.invoke('set-user-disabled', {
          body: { authUserId, disabled: !isActive },
        })
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
      // Derive "enabled" purely from whether the credentials exist. The schema
      // has no at_enabled/wa_enabled flags — and exposing the raw keys here
      // would breach the finance/secrets isolation rule, so we only return
      // booleans indicating presence.
      const { data } = await supabase
        .from('school_profile')
        .select('at_api_key, wa_access_token')
        .eq('id', user!.schoolId)
        .maybeSingle()

      const row = (data ?? {}) as Record<string, unknown>
      return {
        atApiKey:        null,
        atUsername:      null,
        atSenderId:      null,
        waPhoneNumberId: null,
        waAccessToken:   null,
        atEnabled:       Boolean(row['at_api_key']),
        waEnabled:       Boolean(row['wa_access_token']),
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

// ── useDeleteUser ──────────────────────────────────────────────────────────
// Removes the staff row and calls an Edge Function to delete the auth account.
// The Edge Function (delete-staff-user) runs with service_role — never expose it.
export function useDeleteUser() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ staffId, authUserId }: { staffId: string; authUserId: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      if (user.role !== 'it_admin') throw new Error('Forbidden')

      // Remove the staff row first (clears FK to auth user)
      const { error: deleteErr } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId)
        .eq('school_id', user.schoolId)

      if (deleteErr) throw new Error(deleteErr.message)

      // Delete auth account via Edge Function if auth user exists
      if (authUserId) {
        const { error: fnErr } = await supabase.functions.invoke('delete-staff-user', {
          body: { userId: authUserId },
        })
        if (fnErr) throw new Error(fnErr.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-management', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['system-kpis', user?.schoolId] })
    },
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

// ── usePromoteStudents ─────────────────────────────────────────────────────
// Promotes all active students to the next class. S4/S6 → completed.
export function usePromoteStudents() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (onProgress?: (current: number, total: number) => void) => {
      if (!user) throw new Error('Not authenticated')
      if (!['it_admin', 'principal'].includes(user.role)) throw new Error('Forbidden')

      // Fetch all active students with their class name
      const { data: students, error: studentsErr } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('school_id', user.schoolId)
        .eq('status', 'active')

      if (studentsErr) throw new Error(studentsErr.message)

      // Fetch all classes to build name → id map
      const { data: classes, error: classesErr } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user.schoolId)

      if (classesErr) throw new Error(classesErr.message)

      const classById   = new Map((classes ?? []).map((c: any) => [c.id, c.name as string]))
      const classByName = new Map((classes ?? []).map((c: any) => [c.name as string, c.id as string]))

      const NEXT_CLASS: Record<string, string | null> = {
        'S.1': 'S.2', 'S.2': 'S.3', 'S.3': 'S.4', 'S.4': null,
        'S.5': 'S.6', 'S.6': null,
        'S1':  'S2',  'S2':  'S3',   'S3':  'S4',  'S4':  null,
        'S5':  'S6',  'S6':  null,
      }

      const rows = students ?? []
      const total = rows.length

      // Group by outcome to avoid N+1 updates
      const toComplete: string[] = []
      const toPromoteMap = new Map<string, string[]>()

      for (const s of rows) {
        const className = classById.get(s.class_id ?? '') ?? ''
        const nextName  = NEXT_CLASS[className]
        if (nextName === undefined) continue
        if (nextName === null) {
          toComplete.push(s.id)
        } else {
          const nextId = classByName.get(nextName)
          if (nextId) {
            if (!toPromoteMap.has(nextId)) toPromoteMap.set(nextId, [])
            toPromoteMap.get(nextId)!.push(s.id)
          }
        }
      }

      let processed = 0
      if (toComplete.length > 0) {
        for (let i = 0; i < toComplete.length; i += 100) {
          const { error } = await supabase.from('students')
            .update({ status: 'completed', class_id: null, stream_id: null })
            .eq('school_id', user!.schoolId)
            .in('id', toComplete.slice(i, i + 100))
          if (error) throw new Error(error.message)
          processed += Math.min(100, toComplete.length - i)
          onProgress?.(processed, total)
        }
      }

      for (const [nextId, ids] of toPromoteMap) {
        for (let i = 0; i < ids.length; i += 100) {
          const { error } = await supabase.from('students')
            .update({ class_id: nextId, stream_id: null })
            .eq('school_id', user!.schoolId)
            .in('id', ids.slice(i, i + 100))
          if (error) throw new Error(error.message)
          processed += Math.min(100, ids.length - i)
          onProgress?.(processed, total)
        }
      }

      const promoted  = [...toPromoteMap.values()].reduce((s, arr) => s + arr.length, 0)
      const completed = toComplete.length
      return { promoted, completed, total }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
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
  isTerminal: boolean   // true for S.4 (O'Level terminal)
}

function scoreToGrade(avg: number | null): PerformanceGrade {
  if (avg === null) return 'No Data'
  if (avg >= 80)   return 'Exceptional'
  if (avg >= 60)   return 'Proficient'
  if (avg >= 50)   return 'Needs Improvement'
  return 'Advised to Stay Back'
}

const NEXT_CLASS_MAP: Record<string, string | null> = {
  'S.1': 'S.2', 'S.2': 'S.3', 'S.3': 'S.4', 'S.4': null,
  'S.5': 'S.6', 'S.6': null,
  'S1':  'S2',  'S2':  'S3',  'S3':  'S4',  'S4':  null,
  'S5':  'S6',  'S6':  null,
}

const TERMINAL_CLASSES = new Set(['S.4', 'S4', 'S.6', 'S6'])

export function useLoadPromotionCandidates() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ term, year }: { term: string; year: number }): Promise<PromotionCandidate[]> => {
      if (!user) throw new Error('Not authenticated')
      const sid = user.schoolId

      // Load students + classes in parallel with exam results aggregated in JS
      const [studentsRes, classesRes, resultsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, first_name, last_name, admission_number, class_id')
          .eq('school_id', sid)
          .eq('status', 'active'),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', sid),
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
        return {
          id:              s.id as string,
          firstName:       s.first_name as string,
          lastName:        s.last_name as string,
          admissionNumber: s.admission_number as string,
          classId:         s.class_id as string | null,
          className:       cName,
          avgScore:        avg !== null ? Math.round(avg * 10) / 10 : null,
          grade:           scoreToGrade(avg),
          isTerminal:      TERMINAL_CLASSES.has(cName),
        } satisfies PromotionCandidate
      })
    },
  })
}

// ── useSelectivePromote ────────────────────────────────────────────────────
// Promotes only the explicitly selected students.
// S.4/S.6 terminal students are set to status='completed', class_id=null.
export function useSelectivePromote() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      selectedIds: string[],
    ): Promise<{ promoted: number; completed: number }> => {
      if (!user) throw new Error('Not authenticated')
      if (!['it_admin', 'principal'].includes(user.role ?? '')) throw new Error('Forbidden')
      if (selectedIds.length === 0) return { promoted: 0, completed: 0 }

      const sid = user.schoolId

      // Fetch class info for selected students
      const { data: students, error } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('school_id', sid)
        .in('id', selectedIds)

      if (error) throw new Error(error.message)

      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', sid)

      if (classErr) throw new Error(classErr.message)

      const classById   = new Map((classes ?? []).map((c: any) => [c.id as string, c.name as string]))
      const classByName = new Map((classes ?? []).map((c: any) => [c.name as string, c.id as string]))

      const toComplete: string[] = []
      const toPromoteMap = new Map<string, string[]>()

      for (const s of students ?? []) {
        const cName = classById.get(s.class_id ?? '') ?? ''
        const next  = NEXT_CLASS_MAP[cName]
        if (next === undefined) continue
        if (next === null) {
          toComplete.push(s.id)
        } else {
          const nextId = classByName.get(next)
          if (nextId) {
            if (!toPromoteMap.has(nextId)) toPromoteMap.set(nextId, [])
            toPromoteMap.get(nextId)!.push(s.id)
          }
        }
      }

      if (toComplete.length > 0) {
        for (let i = 0; i < toComplete.length; i += 100) {
          const { error } = await supabase.from('students')
            .update({ status: 'completed', class_id: null, stream_id: null })
            .eq('school_id', sid).in('id', toComplete.slice(i, i + 100))
          if (error) throw new Error(error.message)
        }
      }

      for (const [nextId, ids] of toPromoteMap) {
        for (let i = 0; i < ids.length; i += 100) {
          const { error } = await supabase.from('students')
            .update({ class_id: nextId, stream_id: null })
            .eq('school_id', sid).in('id', ids.slice(i, i + 100))
          if (error) throw new Error(error.message)
        }
      }

      return {
        promoted:  [...toPromoteMap.values()].reduce((s, arr) => s + arr.length, 0),
        completed: toComplete.length,
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
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
