import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

type AnyRow = Record<string, unknown>

// ── useParentAccounts ─────────────────────────────────────────
export function useParentAccounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-accounts', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, school_id, email, full_name, phone, auth_user_id, temp_password, student_ids, created_by, created_at')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map(r => ({
        id:           r.id as string,
        schoolId:     r.school_id as string,
        email:        r.email as string,
        studentIds:   (r.student_ids as string[]) ?? [],
        createdBy:    r.created_by as string,
        createdAt:    r.created_at as string,
        fullName:     (r.full_name as string) ?? null,
        phone:        (r.phone as string) ?? null,
        authUserId:   (r.auth_user_id as string) ?? null,
        tempPassword: (r.temp_password as string) ?? null,
      }))
    },
  })
}

// ── useGenerateParentAccess ──────────────────────────────────
// Full flow:
//   1. Look up student's primary guardian (from student_guardians)
//   2. Use guardian's email if available; otherwise generate from admission number
//   3. Check if a parent_account with that email already exists
//      → If yes: add this student to student_ids (shared account across siblings)
//      → If no:  create new parent_account with guardian info
//   4. Call create-parent-auth-user Edge Function to create Supabase auth user
//      and set parent_accounts.auth_user_id (service role, server-side)
//   5. Return { email, tempPassword, isNew, guardianName }
export type GeneratedAccess = {
  email:        string
  tempPassword: string
  isNew:        boolean
  guardianName: string | null
}

export function useGenerateParentAccess() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (student: { id: string; admissionNumber: string }): Promise<GeneratedAccess> => {
      // ── 1. School short name for fallback email ──────────────
      const { data: school } = await supabase
        .from('school_profile')
        .select('short_name')
        .eq('id', user!.schoolId)
        .single()

      const shortName = ((school?.short_name as string) ?? 'school')
        .toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')

      const TEMP_PASSWORD = 'Parent@2025'

      // ── 2. Fetch student's guardians ─────────────────────────
      const { data: guardianRows } = await supabase
        .from('student_guardians')
        .select('id, full_name, email, phone, is_primary, relationship, do_not_contact')
        .eq('school_id', user!.schoolId)
        .eq('student_id', student.id)
        .order('is_primary', { ascending: false })  // primary first

      const guardians = guardianRows ?? []
      const primaryGuardian = guardians[0] ?? null

      // ── 3. Decide login email ────────────────────────────────
      // Use guardian email if available, else generate from admission number
      const guardianEmail = (primaryGuardian as AnyRow)?.email as string | null | undefined
      const guardianName  = (primaryGuardian as AnyRow)?.full_name as string | null | undefined

      const loginEmail = guardianEmail?.trim()
        ? guardianEmail.trim().toLowerCase()
        : `parent.${student.admissionNumber.toLowerCase().replace(/\//g, '-').replace(/[^a-z0-9-]/g, '')}@${shortName}.ug`

      // ── 4. Check if parent account already exists for this email ──
      const { data: existingByEmail } = await supabase
        .from('parent_accounts')
        .select('id, email, student_ids, auth_user_id, temp_password')
        .eq('school_id', user!.schoolId)
        .eq('email', loginEmail)
        .maybeSingle()

      if (existingByEmail) {
        const existing = existingByEmail as AnyRow
        const currentIds = (existing.student_ids as string[]) ?? []

        // Add this student to the existing account if not already there
        if (!currentIds.includes(student.id)) {
          await supabase
            .from('parent_accounts')
            .update({ student_ids: [...currentIds, student.id] })
            .eq('id', existing.id as string)
        }

        // Try to create auth user if not already done
        if (!existing.auth_user_id) {
          await supabase.functions.invoke('create-parent-auth-user', {
            body: {
              parentAccountId: existing.id as string,
              email:           loginEmail,
              schoolId:        user!.schoolId,
            },
          }).catch(() => { /* Edge Function not deployed yet — auth_user_id stays null */ })
        }

        return {
          email:        loginEmail,
          tempPassword: (existing.temp_password as string) ?? TEMP_PASSWORD,
          isNew:        false,
          guardianName: guardianName ?? null,
        }
      }

      // ── 5. Also check if this student already has an account ─
      const { data: existingByStudent } = await supabase
        .from('parent_accounts')
        .select('id, email, student_ids, auth_user_id, temp_password')
        .eq('school_id', user!.schoolId)
        .contains('student_ids', [student.id])
        .maybeSingle()

      if (existingByStudent) {
        const existing = existingByStudent as AnyRow
        return {
          email:        (existing.email as string),
          tempPassword: (existing.temp_password as string) ?? TEMP_PASSWORD,
          isNew:        false,
          guardianName: guardianName ?? null,
        }
      }

      // ── 6. Create new parent account ─────────────────────────
      const { data: newAccount, error: insertError } = await supabase
        .from('parent_accounts')
        .insert({
          school_id:     user!.schoolId,
          email:         loginEmail,
          full_name:     guardianName ?? null,
          phone:         (primaryGuardian as AnyRow)?.phone as string ?? null,
          temp_password: TEMP_PASSWORD,
          student_ids:   [student.id],
          created_by:    user!.id,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // ── 7. Create Supabase auth user via Edge Function ───────
      await supabase.functions.invoke('create-parent-auth-user', {
        body: {
          parentAccountId: (newAccount as AnyRow).id as string,
          email:           loginEmail,
          schoolId:        user!.schoolId,
        },
      }).catch(() => { /* Edge Function not deployed — auth_user_id stays null for now */ })

      return {
        email:        loginEmail,
        tempPassword: TEMP_PASSWORD,
        isNew:        true,
        guardianName: guardianName ?? null,
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-accounts'] })
    },
  })
}

// ── useStudentGuardians ──────────────────────────────────────
// Fetch guardians for a specific student (used in ParentCredentialsPage)
export function useStudentGuardians(studentId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-guardians', studentId],
    enabled:  !!studentId && !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_guardians')
        .select('id, full_name, relationship, phone, email, is_primary, do_not_contact')
        .eq('school_id', user!.schoolId)
        .eq('student_id', studentId!)
        .order('is_primary', { ascending: false })

      if (error) throw error
      return (data ?? []).map(r => ({
        id:           r.id as string,
        fullName:     (r.full_name as string) ?? '',
        relationship: (r.relationship as string) ?? '',
        phone:        (r.phone as string) ?? null,
        email:        (r.email as string) ?? null,
        isPrimary:    (r.is_primary as boolean) ?? false,
        doNotContact: (r.do_not_contact as boolean) ?? false,
      }))
    },
  })
}
