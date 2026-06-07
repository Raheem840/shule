import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { Class, Stream, Subject, Department } from '../types/app'

// ── useClasses ─────────────────────────────────────────────────
// Used in registration wizard and filter dropdowns.
export function useClasses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['classes', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, school_id, name, level, academic_year_id')
        .eq('school_id', user!.schoolId)
        .order('level', { ascending: true })

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
    queryKey: ['subjects', level],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from('subjects')
        .select('id, name, curriculum_code, level, department_id, is_active')
        .eq('school_id', user!.schoolId)
        .order('name', { ascending: true })

      if (level) q = q.eq('level', level)

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
      } satisfies Subject))
    },
  })
}

// ── useAddSubject ──────────────────────────────────────────────
export function useAddSubject() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; curriculumCode?: string; level?: string; departmentId?: string | null }) => {
      const { data, error } = await supabase
        .from('subjects')
        .insert({
          school_id:       user!.schoolId,
          name:            input.name,
          curriculum_code: input.curriculumCode || null,
          level:           input.level || null,
          department_id:   input.departmentId ?? null,
          is_active:       true,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subjects'] })
    },
  })
}

// ── useUpdateSubject ───────────────────────────────────────────
export function useUpdateSubject() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; curriculumCode?: string; level?: string; departmentId?: string | null }) => {
      const patch: Record<string, unknown> = {}
      if (input.name !== undefined)           patch.name            = input.name
      if (input.curriculumCode !== undefined) patch.curriculum_code = input.curriculumCode || null
      if (input.level !== undefined)          patch.level           = input.level || null
      if (input.departmentId !== undefined)   patch.department_id   = input.departmentId
      const { error } = await supabase
        .from('subjects')
        .update(patch)
        .eq('id', input.id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      return input.id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subjects'] })
    },
  })
}

// ── useToggleSubjectActive ─────────────────────────────────────
export function useToggleSubjectActive() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('subjects')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subjects'] })
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
        .select('id, school_id, name, head_teacher_id, accent_color, archived')
        .eq('school_id', user!.schoolId)
        .order('name', { ascending: true })

      if (error) throw error

      return (data ?? []).map(r => ({
        id:       r.id as string,
        schoolId: r.school_id as string,
        name:     r.name as string,
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
      const { error } = await supabase
        .from('departments').update({ archived })
        .eq('id', id).eq('school_id', user!.schoolId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments', user?.schoolId] }) },
  })
}

// ── useCreateStream ────────────────────────────────────────────
export function useCreateStream() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ classId, name }: { classId: string; name: string }) => {
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
      const { data } = await supabase
        .from('staff')
        .select('classes')
        .eq('auth_user_id', user!.id)
        .eq('school_id', user!.schoolId)
        .maybeSingle()
      return ((data as any)?.classes ?? []) as string[]
    },
  })

  if (!['teacher', 'class_teacher'].includes(user?.role ?? '')) return allClasses
  if (!assignedIds.length) return allClasses
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
  if (!assignedIds.length) return allSubjects
  return allSubjects.filter(s => assignedIds.includes(s.id))
}

