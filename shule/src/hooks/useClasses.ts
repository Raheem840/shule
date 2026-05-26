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
        .select('id, name, curriculum_code, level')
        .eq('school_id', user!.schoolId)
        .order('name', { ascending: true })

      if (level) q = q.eq('level', level)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map(r => ({
        id:             r.id as string,
        schoolId:       user!.schoolId,
        name:           r.name as string,
        curriculumCode: (r.curriculum_code as string) ?? null,
        level:          (r.level as string) ?? null,
        isActive:       true,
      } satisfies Subject))
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
