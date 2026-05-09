// app.ts — all TypeScript types for the Shule system.
// TypeScript types are like contracts. When you say a Student has a firstName,
// TypeScript will warn you anywhere you forget to provide it or misspell it.
// This file is the single source of truth for what every data shape looks like.

// ── ROLES ──────────────────────────────────────────────────────────────────
// A union type — UserRole can be exactly one of these strings, nothing else.
// TypeScript will error if you type 'busar' (typo) anywhere in the codebase.
export type UserRole =
  | 'principal'
  | 'deputy'
  | 'dos'            // Director of Studies
  | 'secretary'
  | 'bursar'
  | 'class_teacher'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'it_admin'

// ── AUTH USER ──────────────────────────────────────────────────────────────
// What we store in AuthContext after a user logs in.
// Comes from the JWT custom claims we'll set up in Supabase.
export type AuthUser = {
  id: string          // Supabase Auth user UUID
  email: string
  role: UserRole      // Drives what they can see and do
  schoolId: string    // Every query filters by this — multi-school isolation
  name: string
}

// ── SCHOOL ─────────────────────────────────────────────────────────────────
export type School = {
  id: string
  schoolName: string
  shortName: string | null  // null means "not provided yet" — always be explicit
  logoUrl: string | null
  motto: string | null
  primaryColor: string
  curriculum: string        // 'ncdc_uganda', 'cbc_kenya', etc.
  deploymentMode: 'cloud' | 'local' | 'hybrid'
}

// ── STUDENTS ───────────────────────────────────────────────────────────────
export type Student = {
  id: string
  schoolId: string
  admissionNumber: string   // Unique per school e.g. KJA-2025-001
  firstName: string
  lastName: string
  dob: string | null        // ISO date string e.g. "2010-03-15"
  gender: 'male' | 'female' | null
  classId: string | null    // FK to classes table
  streamId: string | null   // FK to streams table e.g. "East", "West"
  photoUrl: string | null
  medicalNotes: string | null
  status: 'active' | 'suspended' | 'expelled'
  enrolledAt: string
}

// Guardian is stored separately — one student can have up to 2
export type Guardian = {
  id: string
  schoolId: string
  studentId: string
  guardianName: string
  relationship: string      // 'mother', 'father', 'uncle', etc.
  phone: string
  email: string | null
  doNotContact: boolean     // Bursar won't SMS this guardian if true
  communicationPreference: 'sms' | 'whatsapp' | 'both'
}

// ── STAFF ──────────────────────────────────────────────────────────────────
export type Staff = {
  id: string
  schoolId: string
  authUserId: string        // Links to Supabase Auth — how they log in
  staffNumber: string
  firstName: string
  lastName: string
  role: UserRole
  departmentId: string | null
  subjects: string[]        // Array of subject IDs they teach
  classes: string[]         // Array of class IDs they're assigned to
  qualificationLevel: number | null  // 1-7 Uganda MoES scale
  employmentType: 'permanent' | 'contract' | 'part_time' | null
  photoUrl: string | null
  isActive: boolean
}

// ── CLASSES & STREAMS ──────────────────────────────────────────────────────
export type Class = {
  id: string
  schoolId: string
  name: string              // e.g. "S.3", "P.6", "Form 2"
  level: string | null
  academicYearId: string | null
}

export type Stream = {
  id: string
  schoolId: string
  classId: string
  name: string              // e.g. "East", "West", "A", "B"
  classTeacherId: string | null
}

// ── FEES ───────────────────────────────────────────────────────────────────
export type FeePayment = {
  id: string
  schoolId: string
  studentId: string
  feeTypeId: string
  amountDue: number
  amountPaid: number
  balance: number           // Computed: amountDue - amountPaid
  paymentDate: string | null
  receiptNumber: string | null
  term: number              // 1, 2, or 3
  year: number              // e.g. 2025
  notes: string | null
  imported: boolean         // true if this record came from Excel import
}

// Secretary sees this only — no amounts, just the status flag
export type FeeStatus = 'paid' | 'partial' | 'unpaid'

// ── EXAMS ──────────────────────────────────────────────────────────────────
// Uganda NCDC CBC has specific assessment types — we model all of them
export type AssessmentType =
  | 'aoi'               // Activity of Integration
  | 'dit'               // DIT Assignment
  | 'beginning_of_term'
  | 'mid_term'
  | 'end_of_term'
  | 'ca'                // Continuous Assessment (auto-increments C1, C2, C3...)
  | 'practical'
  | 'class_test'
  | 'assignment'

// The journal is the exam metadata — not the marks themselves
export type ExamJournal = {
  id: string
  schoolId: string
  teacherId: string
  subjectId: string
  classId: string
  streamId: string | null
  assessmentType: AssessmentType
  name: string
  date: string
  totalMarks: number
  passMark: number
  term: number
  year: number
  notes: string | null  // Teacher's personal reflection
}

// One row per student per exam
export type ExamResult = {
  id: string
  schoolId: string
  examJournalId: string
  studentId: string
  subjectId: string
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  term: number
  year: number
  teacherId: string
}

// ── REPORT CARDS ───────────────────────────────────────────────────────────
// Status moves in one direction: draft → ready → approved → released
// Only the Principal can approve. Only released cards show on Parent Portal.
export type ReportCardStatus = 'draft' | 'ready' | 'approved' | 'released'

export type ReportCard = {
  id: string
  schoolId: string
  studentId: string
  term: number
  year: number
  status: ReportCardStatus
  principalRemarks: string | null
  generatedAt: string | null
  approvedAt: string | null
  releasedAt: string | null
  pdfUrl: string | null
}

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type Attendance = {
  id: string
  schoolId: string
  studentId: string
  classId: string
  date: string            // ISO date e.g. "2025-05-08"
  status: AttendanceStatus
  recordedBy: string      // Staff ID who marked it
}

// ── MESSAGES ───────────────────────────────────────────────────────────────
// Staff-only. Principal can read all via audit log (not this table directly).
export type Message = {
  id: string
  schoolId: string
  fromUserId: string
  toUserId: string
  body: string
  attachmentUrl: string | null
  sentAt: string
  readAt: string | null   // null means unread
}

// ── CBC GRADE CALCULATIONS ─────────────────────────────────────────────────
// These are pure functions — same input always gives same output.
// We put them here so any component can import and use them consistently.

// Converts a total mark (0-100) to a Uganda NCDC letter grade
export function calculateCBCGrade(total: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (total >= 90) return 'A'
  if (total >= 75) return 'B'
  if (total >= 65) return 'C'
  if (total >= 50) return 'D'
  return 'E'
}

// Calculates final subject total from CA scores + end of term exam
// totalPoints = sum of all competency scores (each out of 3)
// assessed    = number of competencies completed
// examScore   = end of term exam mark out of 80
export function calculateCBCTotal(
  totalPoints: number,
  assessed: number,
  examScore: number
): number {
  const maxPoints = assessed * 3                              // max possible CA score
  const outOf20 = maxPoints > 0                              // CA contributes 20%
    ? (totalPoints / maxPoints) * 20
    : 0
  const total = outOf20 + examScore                          // exam contributes 80%
  return Math.round(total * 10) / 10                         // round to 1 decimal
}