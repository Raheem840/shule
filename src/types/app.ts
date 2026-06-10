// app.ts — single source of truth for all TypeScript types in Shule.
// Types are contracts. TypeScript enforces them everywhere in the codebase.
// Field names: camelCase here → snake_case in Supabase column names.

// ── ROLES ──────────────────────────────────────────────────────────────────
export type UserRole =
  | 'principal'
  | 'deputy'
  | 'dos'
  | 'secretary'
  | 'bursar'
  | 'class_teacher'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'it_admin'

// ── AUTH USER ──────────────────────────────────────────────────────────────
export type AuthUser = {
  id: string
  email: string
  role: UserRole
  schoolId: string
  name: string
  studentIds?: string[]  // parent only — from JWT claims
}

// ── SCHOOL ─────────────────────────────────────────────────────────────────
// Maps to: school_profile
export type School = {
  id: string
  schoolName: string
  shortName: string | null
  logoUrl: string | null
  motto: string | null
  primaryColor: string
  curriculum: string
  deploymentMode: 'cloud' | 'local' | 'hybrid'
}

// ── DEPARTMENT ─────────────────────────────────────────────────────────────
// Maps to: departments
// Groups subjects under a head of department (HoD).
export type Department = {
  id: string
  schoolId: string
  name: string                  // e.g. "Sciences", "Humanities"
  headTeacherId: string | null   // FK -> staff.id
  accentColor: string | null     // hex colour shown on dept badges
  archived: boolean
}

// ── ACADEMIC YEAR ──────────────────────────────────────────────────────────
// Maps to: academic_years
// Every query that could return cross-year data must filter by academicYearId.
export type AcademicYear = {
  id: string
  schoolId: string
  name: string                  // e.g. "2025", "2024/2025"
  startDate: string             // ISO date
  endDate: string               // ISO date
  isActive: boolean
  term1Start: string | null
  term1End: string | null
  term2Start: string | null
  term2End: string | null
  term3Start: string | null
  term3End: string | null
  surveyActive: boolean         // DoS toggles this to open end-of-term survey for students
}

// ── STUDENTS ───────────────────────────────────────────────────────────────
// Maps to: students
export type Student = {
  id: string
  schoolId: string
  admissionNumber: string       // e.g. KJA/2025/0848 — unique per school
  firstName: string
  lastName: string
  dob: string | null             // ISO date
  gender: 'male' | 'female' | null
  classId: string | null
  streamId: string | null
  photoUrl: string | null
  medicalNotes: string | null
  status: 'active' | 'suspended' | 'expelled'
  enrolledAt: string
  createdBy: string | null
  nationality: string | null
  religion: string | null
  studentType: 'day' | 'boarder' | null
  previousSchool: string | null
  authUserId: string | null
  authEmail?: string | null   // stored by create-student-auth-user edge fn
}

// ── STUDENT GUARDIAN ───────────────────────────────────────────────────────
// Maps to: student_guardians
export type StudentGuardian = {
  id: string
  schoolId: string
  studentId: string
  fullName: string
  relationship: string          // 'mother' | 'father' | 'uncle' | 'aunt' | etc.
  phone: string
  email: string | null
  doNotContact: boolean         // bursar won't SMS this guardian
  isPrimary: boolean
  commsPreference: 'sms' | 'whatsapp' | 'both'
}

// ── STAFF ──────────────────────────────────────────────────────────────────
// Maps to: staff
export type Staff = {
  id: string
  schoolId: string
  authUserId: string | null
  staffNumber: string
  firstName: string
  lastName: string
  role: UserRole
  departmentId: string | null
  subjects: string[]            // array of subject IDs they teach
  classes: string[]             // array of class IDs they're assigned to
  qualificationLevel: number | null
  phone: string | null
  email: string | null
  nationalId: string | null
  joinDate: string | null
  employmentType: 'permanent' | 'contract' | 'volunteer' | null
  photoUrl: string | null
  isActive: boolean
  address: string | null
  qualificationTitle: string | null
  institution: string | null
  graduationYear: number | null
  dateOfBirth: string | null
  gender: 'male' | 'female' | null
  tempPassword: string | null
}

// ── STAFF DOCUMENT ─────────────────────────────────────────────────────────
// Maps to: staff_documents
// Stores HR documents: contracts, certificates, appraisal letters, etc.
export type StaffDocument = {
  id: string
  schoolId: string
  staffId: string
  documentType: string          // e.g. "contract", "certificate", "appraisal"
  fileName: string
  fileUrl: string
  uploadedBy: string            // Staff ID of uploader
  uploadedAt: string            // ISO datetime
}

// ── CLASSES & STREAMS ──────────────────────────────────────────────────────
// Maps to: classes, streams
export type Class = {
  id: string
  schoolId: string
  name: string                  // e.g. "S.1", "S.3", "Form 2"
  level: string | null
  academicYearId: string | null
}

export type Stream = {
  id: string
  schoolId: string
  classId: string
  name: string                  // e.g. "East", "West", "A", "B"
  classTeacherId: string | null
}

// ── SUBJECT ────────────────────────────────────────────────────────────────
// Maps to: subjects
export type Subject = {
  id: string
  schoolId: string
  departmentId: string | null
  name: string                  // e.g. "Mathematics", "Biology"
  curriculumCode: string | null
  level: string | null          // 'O-Level' | 'A-Level'
  isActive: boolean
}

// ── FEES ───────────────────────────────────────────────────────────────────
// Maps to: fee_structure — one row per fee type per term per academic year
export type FeeStructure = {
  id:             string
  schoolId:       string
  name:           string                         // e.g. "School Fees", "Boarding Fees"
  amount:         number                         // UGX per student
  appliesTo:      'all' | 'boarders' | 'day_scholars'
  term:           1 | 2 | 3
  isActive:       boolean
  academicYearId: string
  classId:        string | null  // null = applies to ALL classes
  isCompulsory:   boolean        // false = optional fee
}

// Maps to: fee_payments — one row per student per fee type per term
export type FeePayment = {
  id:              string
  schoolId:        string
  studentId:       string
  feeStructureId:  string | null   // FK → fee_structure.id; null for imported records
  academicYearId:  string | null
  amountDue:       number
  amountPaid:      number
  balance:         number          // computed: amountDue - amountPaid
  paymentDate:     string | null
  receiptNumber:   string | null
  term:            number          // integer 1, 2, or 3
  year:            number
  notes:           string | null
  imported:        boolean         // true if this row came from Excel import
  createdBy:       string | null
}

// Secretary sees this only — no amounts, just the status flag
// ── PARENT ACCOUNT ─────────────────────────────────────────────────────────
// Maps to: parent_accounts
export type ParentAccount = {
  id: string
  schoolId: string
  authUserId: string | null
  email: string
  fullName: string | null
  phone: string | null
  studentIds: string[]      // children this parent can access
  tempPassword: string | null
  createdBy: string
  createdAt: string
}

export type FeeStatus = 'paid' | 'partial' | 'unpaid'

// ── SMS / WHATSAPP COMMS ────────────────────────────────────────────────────
export type SmsChannel = 'sms' | 'whatsapp'
export type SmsStatus  = 'pending' | 'sent' | 'delivered' | 'failed'

// Maps to: sms_reminders
export type SmsReminder = {
  id:            string
  schoolId:      string
  studentId:     string
  guardianPhone: string
  channel:       SmsChannel
  message:       string
  status:        SmsStatus
  sentAt:        string | null
  createdAt:     string
}

// ── EXAMS ──────────────────────────────────────────────────────────────────
// Maps to: exam_journal, exam_results
export type AssessmentType =
  | 'aoi'
  | 'dit'
  | 'beginning_of_term'
  | 'mid_term'
  | 'end_of_term'
  | 'ca'
  | 'practical'
  | 'class_test'
  | 'assignment'

export type ExamJournal = {
  id: string
  schoolId: string
  teacherId: string
  subjectId: string
  classId: string
  streamId: string | null
  academicYearId: string | null
  assessmentType: AssessmentType
  name: string
  dateGiven: string | null       // DB column: date_given (NOT 'date')
  totalMarks: number
  passMark: number
  term: string                   // TEXT in DB
  year: number
  teacherNotes: string | null    // DB column: teacher_notes (NOT 'notes')
  status: 'draft' | 'published'
  // Conditional — set based on assessmentType
  learningArea:     string | null  // aoi
  competency:       string | null  // aoi
  integrationTheme: string | null  // aoi
  tradeArea:        string | null  // dit
  ditModuleCode:    string | null  // dit
  caComponent: 'oral' | 'written' | 'project' | 'portfolio' | null  // ca
  caWeighting:      number | null  // ca
  caLabel:          string | null  // ca — auto-label: "C1", "C2", etc.
}

export type ExamResult = {
  id: string
  schoolId: string
  examJournalId: string
  studentId: string
  subjectId: string
  score: number | null            // null when is_absent = true
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | null  // null for end_of_term (needs CA to calculate)
  isAbsent: boolean
  term: string
  year: number
  teacherId: string
}

// ── TEACHER REMARKS ────────────────────────────────────────────────────────────
// Maps to: teacher_remarks
export type TeacherRemark = {
  id: string
  schoolId: string
  studentId: string
  teacherId: string
  classId: string | null
  streamId: string | null
  term: string
  year: number
  remarks: string
  createdAt: string | null
}

// ── REPORT CARDS ───────────────────────────────────────────────────────────
// Status moves in one direction: draft → ready → approved → released
export type ReportCardStatus = 'draft' | 'ready' | 'approved' | 'released'

export type ReportCard = {
  id: string
  schoolId: string
  studentId: string
  term: string                   // TEXT in DB (not integer)
  year: number
  status: ReportCardStatus
  principalRemarks: string | null
  generatedAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  releasedAt: string | null
  releasedBy: string | null
  unlockReason: string | null
  unlockCount: number
  pdfUrl: string | null
}

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
// Maps to: attendance
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type Attendance = {
  id: string
  schoolId: string
  studentId: string
  classId: string
  date: string
  status: AttendanceStatus
  recordedBy: string            // Staff ID
}

// Computed stats for a student over a date range — used by portals and the attendance page.
export type AttendanceSummary = {
  studentId:        string
  totalDays:        number
  presentDays:      number
  absentDays:       number
  lateDays:         number
  excusedDays:      number
  rate:             number    // % present (0–100)
  isBelowThreshold: boolean   // rate < 80% and totalDays > 0
}

// ── MESSAGES ───────────────────────────────────────────────────────────────
export type Message = {
  id: string
  schoolId: string
  fromUserId: string | null
  toUserId: string | null
  isAnnouncement: boolean
  body: string | null
  attachmentUrl: string | null
  attachmentName: string | null
  attachmentType: string | null
  sentAt: string
  readAt: string | null         // null means unread
}

// ── STUDENT SURVEY ─────────────────────────────────────────────────────────
// Maps to: student_surveys (the richer primary survey table)
export type StudentSurvey = {
  id: string
  schoolId: string
  studentId: string
  academicYearId: string | null
  term: string | null
  year: number | null
  rating: number | null              // 1–5 overall term rating
  hardestSubjectId: string | null
  favouriteSubjectId: string | null
  teacherRating: number | null       // 1–5
  suggestions: string | null
  submittedAt: string
}

// ── CBC GRADE CALCULATION ──────────────────────────────────────────────────
// CBCResult bundles every output value into one object.
// The Week 7 report card PDF generator reads all fields directly from here.
export type CBCResult = {
  totalPoints: number              // raw sum of competency scores (0–3 each)
  maxPoints: number                // assessed × 3 (maximum achievable)
  outOf20: number                  // CA score scaled to /20
  examScore: number                // end-of-term exam mark (out of 80)
  total: number                    // outOf20 + examScore (out of 100)
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  gradePoints: 1 | 2 | 3 | 4 | 5  // UNEB grade point: A=5, B=4, C=3, D=2, E=1
  descriptor: string               // UNEB wording: Exceptional/Outstanding/Satisfactory/Basic/Elementary
}

// UNEB CBC grade scale — A 80–100 · B 70–79 · C 60–69 · D 50–59 · E 0–49
// Source: official UNEB CBC Grading Reference.
// Pass threshold is 50 (start of grade D). Score distribution charts draw
// their reference line at the journal's passMark, not the grade cutoff.
export function calculateCBCGrade(total: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (total >= 80) return 'A'
  if (total >= 70) return 'B'
  if (total >= 60) return 'C'
  if (total >= 50) return 'D'
  return 'E'
}

const GRADE_POINTS: Record<'A' | 'B' | 'C' | 'D' | 'E', 1 | 2 | 3 | 4 | 5> = {
  A: 5, B: 4, C: 3, D: 2, E: 1,
}

// Exact UNEB descriptor wording — do not paraphrase or substitute.
const GRADE_DESCRIPTORS: Record<'A' | 'B' | 'C' | 'D' | 'E', string> = {
  A: 'Exceptional',
  B: 'Outstanding',
  C: 'Satisfactory',
  D: 'Basic',
  E: 'Elementary',
}

// Calculates final subject total from CA scores + end-of-term exam.
// totalPoints = sum of all competency scores — each scored 0, 1, 2, or 3:
//   3 = Naturalization/Characterization (highest)
//   2 = Precision/Valuing
//   1 = Imitation/Receiving (entry level)
//   0 = not demonstrated / absent
// assessed    = number of competencies completed this term
// examScore   = end-of-term exam mark out of 80
export function calculateCBCTotal(
  totalPoints: number,
  assessed: number,
  examScore: number
): number {
  const maxPoints = assessed * 3
  const outOf20 = maxPoints > 0 ? (totalPoints / maxPoints) * 20 : 0
  return Math.round((outOf20 + examScore) * 10) / 10
}

// Full convenience function — returns a complete CBCResult in one call.
// Usage: const result = calcCBC(totalPoints, assessed, examScore)
export function calcCBC(
  totalPoints: number,
  assessed: number,
  examScore: number
): CBCResult {
  const maxPoints = assessed * 3
  const outOf20 = maxPoints > 0
    ? Math.round((totalPoints / maxPoints) * 20 * 10) / 10
    : 0
  const total = Math.round((outOf20 + examScore) * 10) / 10
  const grade = calculateCBCGrade(total)
  return {
    totalPoints,
    maxPoints,
    outOf20,
    examScore,
    total,
    grade,
    gradePoints: GRADE_POINTS[grade],
    descriptor:  GRADE_DESCRIPTORS[grade],
  }
}
