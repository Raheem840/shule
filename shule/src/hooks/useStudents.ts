import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { Student, StudentGuardian } from '../types/app'

// ── Column lists ───────────────────────────────────────────────
// List view only needs enough to render a table row.
// Detail view adds the heavy optional fields.
const LIST_COLS = [
  'id', 'school_id', 'admission_number', 'first_name', 'last_name',
  'dob', 'gender', 'class_id', 'stream_id',
  'photo_url', 'status', 'enrolled_at',
].join(', ')

const DETAIL_COLS = [
  'id', 'school_id', 'admission_number', 'first_name', 'last_name',
  'dob', 'gender', 'class_id', 'stream_id',
  'photo_url', 'medical_notes', 'status', 'enrolled_at',
].join(', ')

const GUARDIAN_COLS = [
  'id', 'school_id', 'student_id', 'full_name', 'relationship',
  'phone', 'email', 'do_not_contact', 'is_primary', 'comms_preference',
].join(', ')

// ── Row → TypeScript mappers ───────────────────────────────────
// DB returns snake_case. Our types use camelCase.
// All DB → UI mapping lives here. If a column renames, fix it once.
type AnyRow = Record<string, unknown>

function toStudent(r: AnyRow): Student {
  return {
    id:              r.id as string,
    schoolId:        r.school_id as string,
    admissionNumber: r.admission_number as string,
    firstName:       r.first_name as string,
    lastName:        r.last_name as string,
    dob:             (r.dob as string) ?? null,
    gender:          (r.gender as Student['gender']) ?? null,
    classId:         (r.class_id as string) ?? null,
    streamId:        (r.stream_id as string) ?? null,
    photoUrl:        (r.photo_url as string) ?? null,
    medicalNotes:    (r.medical_notes as string) ?? null,
    status:          r.status as Student['status'],
    enrolledAt:      r.enrolled_at as string,
    createdBy:       (r.created_by as string) ?? null,
    nationality:     (r.nationality as string) ?? null,
    religion:        (r.religion as string) ?? null,
    studentType:     (r.student_type as Student['studentType']) ?? null,
    previousSchool:  (r.previous_school as string) ?? null,
  }
}

function toGuardian(r: AnyRow): StudentGuardian {
  return {
    id:              r.id as string,
    schoolId:        r.school_id as string,
    studentId:       r.student_id as string,
    fullName:        (r.full_name as string) ?? '',
    relationship:    r.relationship as string,
    phone:           r.phone as string,
    email:           (r.email as string) ?? null,
    doNotContact:    (r.do_not_contact as boolean) ?? false,
    isPrimary:       (r.is_primary as boolean) ?? false,
    commsPreference: ((r.comms_preference as string) ?? 'sms') as StudentGuardian['commsPreference'],
  }
}

// ── Filter type ────────────────────────────────────────────────
export type StudentFilters = {
  classId?:  string
  streamId?: string
  status?:   Student['status']
  search?:   string   // matched against name + admission number in JS
}

// ── useStudents ────────────────────────────────────────────────
// Returns the full list for the school, optionally filtered.
// search is done client-side — the list is typically < 2000 rows.
export function useStudents(filters: StudentFilters = {}, enabled = true) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['students', user?.schoolId, filters],
    enabled:  !!user?.schoolId && enabled,
    queryFn: async () => {
      let q = supabase
        .from('students')
        .select(LIST_COLS)
        .eq('school_id', user!.schoolId)
        .order('last_name', { ascending: true })

      if (filters.classId)  q = q.eq('class_id',  filters.classId)
      if (filters.streamId) q = q.eq('stream_id', filters.streamId)
      if (filters.status)   q = q.eq('status',    filters.status)

      const { data, error } = await q
      if (error) throw error

      const students = (data ?? []).map(r => toStudent(r as unknown as AnyRow))

      // Client-side search across name + admission number
      if (filters.search) {
        const term = filters.search.toLowerCase()
        return students.filter(s =>
          s.firstName.toLowerCase().includes(term)      ||
          s.lastName.toLowerCase().includes(term)       ||
          s.admissionNumber.toLowerCase().includes(term)
        )
      }

      return students
    },
  })
}

// ── useStudentById ─────────────────────────────────────────────
export type StudentWithGuardians = Student & {
  guardians: StudentGuardian[]
}

export function useStudentById(id: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student', id],
    enabled:  !!id && !!user?.schoolId,
    queryFn: async () => {
      const [studentRes, guardianRes] = await Promise.all([
        supabase
          .from('students')
          .select(DETAIL_COLS)
          .eq('id', id!)
          .eq('school_id', user!.schoolId)
          .single(),
        supabase
          .from('student_guardians')
          .select(GUARDIAN_COLS)
          .eq('student_id', id!)
          .order('id', { ascending: true }),
      ])

      if (studentRes.error)  throw studentRes.error
      if (guardianRes.error) throw guardianRes.error

      return {
        ...toStudent(studentRes.data as unknown as AnyRow),
        guardians: (guardianRes.data ?? []).map(r => toGuardian(r as unknown as AnyRow)),
      } satisfies StudentWithGuardians
    },
  })
}

// ── useNextAdmissionNumber ─────────────────────────────────────
// staleTime: 0 — two secretaries could register at the same time.
// Always fetch fresh to avoid duplicate admission numbers.
export function useNextAdmissionNumber(year: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['next-adm-num', user?.schoolId, year],
    enabled:  !!user?.schoolId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('admission_number')
        .eq('school_id', user!.schoolId)
        .like('admission_number', `%/${year}/%`)
        .order('admission_number', { ascending: false })
        .limit(1)

      if (error) throw error

      if (!data || data.length === 0) return 1

      // Format: KJA/2025/0049 → split on '/' → take last segment
      const last = data[0].admission_number as string
      const seq  = parseInt(last.split('/').pop() ?? '0', 10)
      return isNaN(seq) ? 1 : seq + 1
    },
  })
}

// ── Mutation input types ───────────────────────────────────────
export type GuardianInput = {
  fullName:        string
  relationship:    string
  phone:           string
  email:           string | null
  isPrimary:       boolean
  doNotContact:    boolean
  commsPreference: StudentGuardian['commsPreference']
}

export type RegisterStudentInput = {
  // Step 1 — Personal info
  firstName:     string
  lastName:      string
  dob:           string | null
  gender:        Student['gender']
  nationality:   string | null
  religion:      string | null
  photoUrl:      string | null
  medicalNotes:  string | null
  // Step 2 — Academic placement
  admissionNumber:  string
  classId:          string
  streamId:         string | null
  academicYearId:   string | null
  studentType:      Student['studentType']
  previousSchool:   string | null
  enrolledAt:       string
  // Step 3 — Guardians
  guardians: GuardianInput[]
}

export type UpdateStudentInput = {
  id: string
} & Partial<Omit<RegisterStudentInput, 'guardians'>>

// ── useRegisterStudent ─────────────────────────────────────────
// Two-step insert: student row first → get new id → guardian rows.
// If guardian insert fails the student exists but without guardians.
// This is recoverable via the Edit Student flow. A DB transaction
// (supabase.rpc) would be cleaner but adds complexity for Week 5.
export function useRegisterStudent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: RegisterStudentInput) => {
      // students.created_by is a FK → staff.id (the staff row's own PK),
      // NOT auth.users.id. Resolve the staff row first, same pattern as
      // useExamJournal. If the lookup fails we still proceed with null
      // created_by so registration doesn't block entirely.
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('auth_user_id', user!.id)
        .eq('school_id', user!.schoolId)
        .maybeSingle()

      const { data: newStudent, error: studentErr } = await supabase
        .from('students')
        .insert({
          school_id:         user!.schoolId,
          admission_number:  input.admissionNumber,
          first_name:        input.firstName,
          last_name:         input.lastName,
          dob:               input.dob,
          gender:            input.gender,
          class_id:          input.classId,
          stream_id:         input.streamId,
          academic_year_id:  input.academicYearId,
          photo_url:         input.photoUrl,
          medical_notes:     input.medicalNotes,
          enrolled_at:       input.enrolledAt,
          status:            'active',
          nationality:       input.nationality,
          religion:          input.religion,
          student_type:      input.studentType,
          previous_school:   input.previousSchool,
          created_by:        (staffRow as { id: string } | null)?.id ?? null,
        })
        .select('id')
        .single()

      if (studentErr) throw studentErr

      if (input.guardians.length > 0) {
        const { error: guardianErr } = await supabase
          .from('student_guardians')
          .insert(
            input.guardians.map(g => ({
              school_id:       user!.schoolId,
              student_id:      newStudent.id,
              full_name:       g.fullName,
              relationship:    g.relationship,
              phone:           g.phone,
              email:           g.email,
              do_not_contact:  g.doNotContact,
              is_primary:      g.isPrimary,
              comms_preference: g.commsPreference,
            }))
          )

        if (guardianErr) throw guardianErr
      }

      return newStudent.id as string
    },
    onSuccess: () => {
      // Invalidate by prefix — catches all filter variations
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['next-adm-num', user?.schoolId] })
    },
  })
}

// ── useUpdateStudent ───────────────────────────────────────────
export function useUpdateStudent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateStudentInput) => {
      // Build update object with only provided fields
      const patch: AnyRow = {}
      if (fields.firstName    !== undefined) patch.first_name    = fields.firstName
      if (fields.lastName     !== undefined) patch.last_name     = fields.lastName
      if (fields.dob          !== undefined) patch.dob           = fields.dob
      if (fields.gender       !== undefined) patch.gender        = fields.gender
      if (fields.classId      !== undefined) patch.class_id      = fields.classId
      if (fields.streamId     !== undefined) patch.stream_id     = fields.streamId
      if (fields.photoUrl     !== undefined) patch.photo_url     = fields.photoUrl
      if (fields.medicalNotes !== undefined) patch.medical_notes = fields.medicalNotes
      if (fields.enrolledAt   !== undefined) patch.enrolled_at   = fields.enrolledAt
      // DB NEEDS: nationality, religion, student_type, previous_school — skip until columns added

      const { error } = await supabase
        .from('students')
        .update(patch)
        .eq('id', id)
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return id
    },
    onSuccess: id => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['student', id] })
    },
  })
}

// ── useDeleteStudent ───────────────────────────────────────────
// Hard delete. For suspension/expulsion, use useUpdateStudent with
// status: 'suspended' | 'expelled' — that keeps the audit trail.
export function useDeleteStudent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)
        .eq('school_id', user!.schoolId)

      if (error) throw error
      return studentId
    },
    onSuccess: studentId => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      qc.removeQueries({ queryKey: ['student', studentId] })
    },
  })
}

// ── useSetStudentStatus ─────────────────────────────────────────
// Change a student's status: active | suspended | expelled.
// Preferred over full useUpdateStudent for this single-field action.
export function useSetStudentStatus() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Student['status'] }) => {
      const { error } = await supabase
        .from('students')
        .update({ status })
        .eq('id', id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      return id
    },
    onSuccess: id => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      qc.invalidateQueries({ queryKey: ['student', id] })
    },
  })
}

// ── Student login result ────────────────────────────────────────
export type StudentLoginResult = {
  email:        string
  tempPassword: string
  manual:       boolean   // true = Edge Function not deployed, login NOT created in auth
}

// ── useCreateStudentLogin ───────────────────────────────────────
// Secretary one-click: auto-generate an auth user for a student.
// Email format: student.{sanitised_admNo}@{shortName}.ug
// Tries the Edge Function first; falls back gracefully if not deployed.
// Returns { email, tempPassword, manual } — manual=true means the IT admin
// must create the auth user manually using the returned credentials.
export function useCreateStudentLogin() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (studentId: string): Promise<StudentLoginResult> => {
      if (!user) throw new Error('Not authenticated')

      // 1. Fetch student row — needs auth_user_id to check if already activated
      const { data: studentRow, error: studentErr } = await supabase
        .from('students')
        .select('id, school_id, admission_number, first_name, last_name, auth_user_id')
        .eq('id', studentId)
        .eq('school_id', user.schoolId)
        .single()

      if (studentErr) throw studentErr
      if (!studentRow) throw new Error('Student not found')

      const row = studentRow as AnyRow
      if (row.auth_user_id) throw new Error('Login already activated')

      // 2. Fetch school short_name
      const { data: school } = await supabase
        .from('school_profile')
        .select('short_name')
        .eq('id', user.schoolId)
        .single()

      const shortName = ((school?.short_name as string) ?? 'school').toLowerCase().replace(/\s+/g, '')
      const admNo     = (row.admission_number as string).toLowerCase().replace(/\//g, '-').replace(/\s+/g, '')
      const email     = `student.${admNo}@${shortName}.ug`
      const tempPassword = 'Shule@2025'

      // 3. Try the Edge Function (may not be deployed yet)
      try {
        const { error: fnError } = await supabase.functions.invoke('create-student-auth-user', {
          body: { studentId, email, schoolId: user.schoolId },
        })
        if (!fnError) return { email, tempPassword, manual: false }
        // Edge function returned an error — fall through to manual mode
      } catch {
        // Network error or function not deployed — fall through to manual mode
      }

      // 4. Graceful fallback: return credentials for manual activation
      return { email, tempPassword, manual: true }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
    },
  })
}
