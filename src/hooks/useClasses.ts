import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { Class, Stream, Subject, Department } from '../types/app'

// Small standalone lookup for pages that need just the active year's id
// (e.g. to scope a finance chart to the current year instead of aggregating
// across every year's fee_payments rows) without pulling the full class list.
export function useActiveAcademicYearId() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['active-academic-year-id', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .maybeSingle()
      return data?.id ?? null
    },
    staleTime: 5 * 60_000,
  })
}

// ── useClasses ─────────────────────────────────────────────────
// Used in registration wizard and filter dropdowns. Classes are year-scoped
// (academic_year_id is required — each academic year gets its own class rows,
// per how promotion/rollover works), so this defaults to the school's ACTIVE
// year only — otherwise every dropdown/list would accumulate one duplicate
// "S.1"/"S.2"/etc. per year the school has ever operated. Pass `null`
// explicitly for the rare case that genuinely needs every class ever created.
export function useClasses(academicYearId?: string | null) {
  const { user } = useAuth()
  const scopeToActive = academicYearId === undefined

  return useQuery({
    queryKey: ['classes', user?.schoolId, academicYearId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      let yearId = academicYearId ?? null
      if (scopeToActive) {
        const { data: activeYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', user!.schoolId)
          .eq('is_active', true)
          .maybeSingle()
        yearId = activeYear?.id ?? null
      }

      let q = supabase
        .from('classes')
        .select('id, school_id, name, level, academic_year_id')
        .eq('school_id', user!.schoolId)
        .order('level', { ascending: true })
      if (yearId) q = q.eq('academic_year_id', yearId)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map(r => ({
        id:             r.id as string,
        schoolId:       r.school_id as string,
        name:           r.name as string,
        level:          (r.level as string) ?? null,
        academicYearId: (r.academic_year_id as string) ?? null,
      } satisfies Class))
    },
  })
}

// ── useStreams ─────────────────────────────────────────────────
// Pass classId to get only that class's streams (for the wizard
// Step 2 where stream dropdown filters after class is chosen).
export function useStreams(classId?: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['streams', user?.schoolId, classId ?? 'all'],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from('streams')
        .select('id, school_id, class_id, name, class_teacher_id')
        .eq('school_id', user!.schoolId)
        .order('name', { ascending: true })

      if (classId) q = q.eq('class_id', classId)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map(r => ({
        id:              r.id as string,
        schoolId:        r.school_id as string,
        classId:         r.class_id as string,
        name:            r.name as string,
        classTeacherId:  (r.class_teacher_id as string) ?? null,
      } satisfies Stream))
    },
  })
}

// ── useSubjects ────────────────────────────────────────────────
// Used by exam journal dropdowns (teacher entering marks).
export function useSubjects(level?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['subjects', user?.schoolId, level ?? 'all'],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from('subjects')
        .select('id, name, curriculum_code, level, department_id, is_active, is_ple_core')
        .eq('school_id', user!.schoolId)
        .order('name', { ascending: true })

      // level=NULL means "Both" (applies to every level) — a subject
      // filtered to a specific level should still include those, not just
      // exact matches, or a cross-cutting subject silently disappears from
      // the O-Level/A-Level filtered view even though it does apply there.
      if (level) q = q.or(`level.eq.${level},level.is.null`)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map(r => ({
        id:             r.id as string,
        schoolId:       user!.schoolId,
        departmentId:   (r.department_id as string) ?? null,
        name:           r.name as string,
        curriculumCode: (r.curriculum_code as string) ?? null,
        level:          (r.level as string) ?? null,
        isActive:       (r.is_active as boolean) ?? true,
        isPleCore:      (r.is_ple_core as boolean) ?? false,
      } satisfies Subject))
    },
  })
}

// ── useAddSubject ──────────────────────────────────────────────
export function useAddSubject() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; curriculumCode?: string; level?: string; departmentId?: string | null; isPleCore?: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          school_id:       user!.schoolId,
          name:            input.name,
          curriculum_code: input.curriculumCode || null,
          level:           input.level || null,
          department_id:   input.departmentId ?? null,
          is_active:       true,
          is_ple_core:     input.isPleCore ?? false,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subjects', user?.schoolId] })
    },
  })
}

// ── useUpdateSubject ───────────────────────────────────────────
export function useUpdateSubject() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; curriculumCode?: string; level?: string; departmentId?: string | null; isPleCore?: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      const patch: Record<string, unknown> = {}
      if (input.name !== undefined)           patch.name            = input.name
      if (input.curriculumCode !== undefined) patch.curriculum_code = input.curriculumCode || null
      if (input.level !== undefined)          patch.level           = input.level || null
      if (input.departmentId !== undefined)   patch.department_id   = input.departmentId
      if (input.isPleCore !== undefined)      patch.is_ple_core     = input.isPleCore
      const { error } = await supabase
        .from('subjects')
        .update(patch)
        .eq('id', input.id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      return input.id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subjects', user?.schoolId] })
    },
  })
}

// ── useToggleSubjectActive ─────────────────────────────────────
export function useToggleSubjectActive() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('subjects')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subjects', user?.schoolId] })
    },
  })
}

// ── useDepartments ─────────────────────────────────────────────
// Used in staff registration and subject management.
export function useDepartments() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['departments', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, school_id, name, description, head_teacher_id, accent_color, archived')
        .eq('school_id', user!.schoolId)
        .order('name', { ascending: true })

      if (error) throw error

      return (data ?? []).map(r => ({
        id:       r.id as string,
        schoolId: r.school_id as string,
        name:     r.name as string,
        description: (r.description as string) ?? null,
        headTeacherId: (r.head_teacher_id as string) ?? null,
        accentColor:   (r.accent_color as string) ?? null,
        archived:      (r.archived as boolean) ?? false,
      } satisfies Department))
    },
  })
}

// ── useCreateDepartment ────────────────────────────────────────
export function useCreateDepartment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; accentColor?: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('departments')
        .insert({
          school_id:    user!.schoolId,
          name:         input.name.trim(),
          description:  input.description ?? null,
          accent_color: input.accentColor ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments', user?.schoolId] }) },
  })
}

// ── useUpdateDepartment ────────────────────────────────────────
export function useUpdateDepartment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; accentColor?: string; headTeacherId?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      const patch: Record<string, unknown> = {}
      if (input.name        !== undefined) patch.name           = input.name.trim()
      if (input.description !== undefined) patch.description    = input.description
      if (input.accentColor !== undefined) patch.accent_color   = input.accentColor
      if (input.headTeacherId !== undefined) patch.head_teacher_id = input.headTeacherId
      const { error } = await supabase
        .from('departments').update(patch)
        .eq('id', input.id).eq('school_id', user!.schoolId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments', user?.schoolId] }) },
  })
}

// ── useArchiveDepartment ───────────────────────────────────────
export function useArchiveDepartment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('departments').update({ archived })
        .eq('id', id).eq('school_id', user!.schoolId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments', user?.schoolId] }) },
  })
}

// ── useCreateClass ─────────────────────────────────────────────
// Secretary and DoS can create classes. Fetches the active academic year internally.
export function useCreateClass() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; level?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      const { data: ayData } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .maybeSingle()

      if (!ayData?.id) {
        throw new Error('No active academic year found. Please set an active year before creating classes.')
      }

      const { data, error } = await supabase
        .from('classes')
        .insert({
          school_id:        user!.schoolId,
          name:             input.name.trim(),
          level:            input.level ?? null,
          academic_year_id: ayData.id,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes', user?.schoolId] })
    },
  })
}

// ── useCreateStream ────────────────────────────────────────────
export function useCreateStream() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ classId, name }: { classId: string; name: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('streams')
        .insert({ school_id: user!.schoolId, class_id: classId, name: name.trim() })
        .select('id')
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['streams', user?.schoolId] })
    },
  })
}

// ── useMoveStudent ─────────────────────────────────────────────
export function useMoveStudent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ studentId, toStreamId }: { studentId: string; toStreamId: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('students')
        .update({ stream_id: toStreamId })
        .eq('id', studentId)
        .eq('school_id', user!.schoolId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
    },
  })
}

// ── useMyAssignedClasses ───────────────────────────────────────────────────────
// Returns only the classes the current teacher is assigned to teach (staff.classes[]).
// Used to filter dropdowns in teacher-facing pages.
export function useMyAssignedClasses() {
  const { user } = useAuth()
  const { data: allClasses = [] } = useClasses()

  const { data: assignedIds = [] } = useQuery({
    queryKey: ['my-staff-classes', user?.schoolId, user?.id],
    enabled: !!user && ['teacher', 'class_teacher'].includes(user.role ?? ''),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id, classes')
        .eq('auth_user_id', user!.id)
        .eq('school_id', user!.schoolId)
        .maybeSingle()
      const fromStaff = ((staffRow as any)?.classes ?? []) as string[]

      // A homeroom class_teacher's assignment lives in streams.class_teacher_id,
      // not necessarily in staff.classes[] — union both, matching the same
      // "my classes" definition used by messaging scoping and the attendance RLS.
      const staffId = (staffRow as any)?.id as string | undefined
      let fromStreams: string[] = []
      if (staffId) {
        const { data: streamRows } = await supabase
          .from('streams')
          .select('class_id')
          .eq('school_id', user!.schoolId)
          .eq('class_teacher_id', staffId)
        fromStreams = ((streamRows ?? []) as any[]).map(r => r.class_id as string)
      }

      return Array.from(new Set([...fromStaff, ...fromStreams]))
    },
  })

  if (!['teacher', 'class_teacher'].includes(user?.role ?? '')) return allClasses
  // No fallback to "all classes" when unassigned — an unassigned teacher
  // should see zero classes, not the whole school's roster.
  return allClasses.filter(c => assignedIds.includes(c.id))
}

// ── useMyAssignedSubjects ──────────────────────────────────────────────────────
// Returns only the subjects the current teacher is assigned to teach (staff.subjects[]).
// Falls back to all subjects for non-teacher roles or when staff row has no subjects.
export function useMyAssignedSubjects() {
  const { user } = useAuth()
  const { data: allSubjects = [] } = useSubjects()

  const { data: assignedIds = [] } = useQuery({
    queryKey: ['my-staff-subjects', user?.schoolId, user?.id],
    enabled: !!user && ['teacher', 'class_teacher'].includes(user.role ?? ''),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('subjects')
        .eq('auth_user_id', user!.id)
        .eq('school_id', user!.schoolId)
        .maybeSingle()
      return ((data as any)?.subjects ?? []) as string[]
    },
  })

  if (!['teacher', 'class_teacher'].includes(user?.role ?? '')) return allSubjects
  // No fallback to "all subjects" when unassigned — see useMyAssignedClasses.
  return allSubjects.filter(s => assignedIds.includes(s.id))
}

