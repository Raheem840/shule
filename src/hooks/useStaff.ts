// ⚠ SECURITY: The staff table currently has RLS DISABLED in the database.
// All staff data is readable by any authenticated user from any school until fixed.
// Run this SQL in Supabase immediately:
//
//   ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "staff_select_own_school" ON staff FOR SELECT TO authenticated
//     USING (school_id = public.user_school_id());
//   CREATE POLICY "staff_insert_secretary" ON staff FOR INSERT TO authenticated
//     WITH CHECK (school_id = public.user_school_id()
//       AND public.user_role() IN ('principal','secretary','it_admin'));
//   CREATE POLICY "staff_update_admin" ON staff FOR UPDATE TO authenticated
//     USING (school_id = public.user_school_id()
//       AND public.user_role() IN ('principal','secretary','it_admin'));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { sendNotifications } from '../lib/notifications'
import type { Staff, StaffDocument } from '../types/app'

type AnyRow = Record<string, unknown>

const LIST_COLS = [
  'id', 'school_id', 'auth_user_id', 'staff_number', 'first_name', 'last_name',
  'role', 'department_id', 'phone', 'email', 'join_date',
  'employment_type', 'photo_url', 'is_active', 'temp_password',
].join(', ')

const DETAIL_COLS = [
  'id', 'school_id', 'auth_user_id', 'staff_number', 'first_name', 'last_name',
  'role', 'department_id', 'subjects', 'classes', 'phone', 'email',
  'national_id', 'address', 'join_date', 'employment_date', 'qualification_level',
  'qualification_title', 'institution', 'graduation_year',
  'date_of_birth', 'gender',
  'employment_type', 'photo_url', 'is_active',
].join(', ')

function toStaff(r: AnyRow): Staff {
  return {
    id:                 r.id as string,
    schoolId:           r.school_id as string,
    authUserId:         (r.auth_user_id as string) ?? null,
    staffNumber:        r.staff_number as string,
    firstName:          r.first_name as string,
    lastName:           r.last_name as string,
    role:               r.role as Staff['role'],
    departmentId:       (r.department_id as string) ?? null,
    subjects:           (r.subjects as string[]) ?? [],
    classes:            (r.classes as string[]) ?? [],
    phone:              (r.phone as string) ?? null,
    email:              (r.email as string) ?? null,
    nationalId:         (r.national_id as string) ?? null,
    joinDate:           (r.join_date as string) ?? null,
    qualificationLevel: (r.qualification_level as number) ?? null,
    employmentType:     (r.employment_type as Staff['employmentType']) ?? null,
    photoUrl:           (r.photo_url as string) ?? null,
    isActive:           (r.is_active as boolean) ?? true,
    tempPassword:       (r.temp_password as string) ?? null,
    address:            (r.address as string) ?? null,
    qualificationTitle: (r.qualification_title as string) ?? null,
    institution:        (r.institution as string) ?? null,
    graduationYear:     (r.graduation_year as number) ?? null,
    dateOfBirth:        (r.date_of_birth as string) ?? null,
    gender:             (r.gender as 'male' | 'female' | null) ?? null,
  }
}

// ── useStaff ───────────────────────────────────────────────────
export type StaffFilters = {
  role?:         Staff['role']
  departmentId?: string
  isActive?:     boolean
  search?:       string
}

export function useStaff(filters: StaffFilters = {}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['staff', user?.schoolId, filters],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from('staff')
        .select(LIST_COLS)
        .eq('school_id', user!.schoolId)
        .order('last_name', { ascending: true })

      if (filters.role)         q = q.eq('role', filters.role)
      if (filters.departmentId) q = q.eq('department_id', filters.departmentId)
      if (filters.isActive !== undefined) q = q.eq('is_active', filters.isActive)

      const { data, error } = await q
      if (error) throw error

      const list = (data ?? []).map(r => toStaff(r as unknown as AnyRow))

      if (filters.search) {
        const term = filters.search.toLowerCase()
        return list.filter(s =>
          s.firstName.toLowerCase().includes(term) ||
          s.lastName.toLowerCase().includes(term)  ||
          s.staffNumber.toLowerCase().includes(term)
        )
      }

      return list
    },
  })
}

// ── useStaffById ───────────────────────────────────────────────
export type StaffWithDocuments = Staff & { documents: StaffDocument[] }

export function useStaffById(id: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['staff-member', user?.schoolId, id],
    enabled:  !!id && !!user?.schoolId,
    queryFn: async () => {
      const [staffRes, docsRes] = await Promise.all([
        supabase
          .from('staff')
          .select(DETAIL_COLS)
          .eq('id', id!)
          .eq('school_id', user!.schoolId)
          .maybeSingle(),
        supabase
          .from('staff_documents')
          .select('id, school_id, staff_id, doc_type, file_name, file_url, uploaded_by, uploaded_at')
          .eq('school_id', user!.schoolId)
          .eq('staff_id', id!)
          .order('uploaded_at', { ascending: false }),
      ])

      if (staffRes.error) throw staffRes.error

      const documents: StaffDocument[] = (docsRes.data ?? []).map(r => ({
        id:           r.id as string,
        schoolId:     r.school_id as string,
        staffId:      r.staff_id as string,
        documentType: r.doc_type as string,
        fileName:     r.file_name as string,
        fileUrl:      r.file_url as string,
        uploadedBy:   r.uploaded_by as string,
        uploadedAt:   r.uploaded_at as string,
      }))

      return { ...toStaff(staffRes.data as unknown as AnyRow), documents }
    },
  })
}

// ── useNextStaffNumber ─────────────────────────────────────────
// staleTime: 0 prevents two registrations colliding on the same number.
export function useNextStaffNumber() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['next-staff-num', user?.schoolId],
    enabled:  !!user?.schoolId,
    staleTime: 0,
    queryFn: async () => {
      const [staffRes, schoolRes] = await Promise.all([
        supabase
          .from('staff')
          .select('staff_number')
          .eq('school_id', user!.schoolId)
          .order('staff_number', { ascending: false })
          .limit(1),
        supabase
          .from('school_profile')
          .select('short_name')
          .eq('id', user!.schoolId)
          .maybeSingle(),
      ])

      if (staffRes.error) throw staffRes.error

      const prefix = (schoolRes.data?.short_name as string | null) ?? 'STF'
      const last   = staffRes.data?.[0]?.staff_number as string | undefined
      const seq    = last ? parseInt(last.split('/').pop() ?? '0', 10) : 0
      const next   = isNaN(seq) ? 1 : seq + 1
      return `${prefix}/STAFF/${String(next).padStart(3, '0')}`
    },
  })
}

// ── Mutation types ─────────────────────────────────────────────
export type DocumentInput = {
  documentType: string
  fileName:     string
  fileUrl:      string
}

export type RegisterStaffInput = {
  // Step 1 — Personal
  firstName:    string
  lastName:     string
  dateOfBirth:  string | null
  gender:       Staff['gender']
  phone:        string | null
  email:        string | null
  nationalId:   string | null
  photoUrl:     string | null
  // Step 2 — Professional
  role:             Staff['role']
  staffNumber:      string
  departmentId:     string | null
  employmentType:   Staff['employmentType']
  joinDate:         string | null
  subjects:         string[]
  classes:          string[]
  // Step 3 — Qualification
  qualificationLevel: number | null
  qualificationTitle: string | null
  institution:        string | null
  graduationYear:     number | null
  // Step 4 — Documents
  documents: DocumentInput[]
}

// ── useRegisterStaff ───────────────────────────────────────────
export function useRegisterStaff() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: RegisterStaffInput) => {
      const { data: newStaff, error: staffErr } = await supabase
        .from('staff')
        .insert({
          school_id:            user!.schoolId,
          staff_number:         input.staffNumber,
          first_name:           input.firstName,
          last_name:            input.lastName,
          date_of_birth:        input.dateOfBirth,
          gender:               input.gender,
          phone:                input.phone,
          email:                input.email,
          national_id:          input.nationalId,
          photo_url:            input.photoUrl,
          role:                 input.role,
          department_id:        input.departmentId,
          employment_type:      input.employmentType,
          join_date:            input.joinDate,
          subjects:             input.subjects,
          classes:              input.classes,
          qualification_level:  input.qualificationLevel,
          qualification_title:  input.qualificationTitle,
          institution:          input.institution,
          graduation_year:      input.graduationYear,
          is_active:            true,
        })
        .select('id')
        .single()

      if (staffErr) throw staffErr

      if (input.documents.length > 0) {
        const { error: docErr } = await supabase
          .from('staff_documents')
          .insert(
            input.documents.map(d => ({
              school_id:     user!.schoolId,
              staff_id:      newStaff.id,
              doc_type:      d.documentType,
              file_name:     d.fileName,
              file_url:      d.fileUrl,
              uploaded_by:   user!.id,
              uploaded_at:   new Date().toISOString(),
            }))
          )
        if (docErr?.code === '42P01') { /* staff_documents table not yet created — skip silently */ }
        else if (docErr) throw docErr
      }

      const staffId = newStaff.id as string

      // Notify DoS users about the new teacher (best-effort)
      void (async () => {
        try {
          const { data: dosUsers } = await supabase
            .from('staff')
            .select('auth_user_id')
            .eq('school_id', user!.schoolId)
            .in('role', ['dos', 'principal'])
            .not('auth_user_id', 'is', null)
          const recipients = (dosUsers ?? []).map((d: any) => d.auth_user_id as string)
          if (recipients.length > 0) {
            await sendNotifications({
              schoolId: user!.schoolId,
              userIds:  recipients,
              type:     'general',
              title:    'New Teacher Registered',
              body:     `${input.firstName} ${input.lastName} has been registered. Click to assign class and subjects.`,
              link:     `/dos/teachers`,
              fromUser: user!.id,
            })
          }
        } catch { /* best-effort */ }
      })()

      return staffId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['next-staff-num', user?.schoolId] })
    },
  })
}

// ── useSetStaffActive ───────────────────────────────────────────
// Deactivate (isActive: false) or reactivate (isActive: true) a staff member.
export function useSetStaffActive() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      return id
    },
    onSuccess: id => {
      qc.invalidateQueries({ queryKey: ['staff',        user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['staff-member', user?.schoolId, id] })
    },
  })
}
