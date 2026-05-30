// week9.ts — New types added in Week 9. Imports from app.ts where needed.
// Only additive — never modifies existing types.

import type { UserRole } from './app'

// ── NOTIFICATION ───────────────────────────────────────────────────────────
export type NotificationType =
  | 'report_card'
  | 'attendance'
  | 'message'
  | 'announcement'
  | 'fee'
  | 'general'

export type Notification = {
  id: string
  schoolId: string
  userId: string              // recipient auth user ID
  type: NotificationType
  body: string
  link: string | null         // route to navigate when clicked
  readAt: string | null
  createdAt: string
}

// ── DISCIPLINE RECORD ──────────────────────────────────────────────────────
export type DisciplineNature =
  | 'lateness'
  | 'absenteeism'
  | 'misconduct'
  | 'violence'
  | 'other'

export type DisciplineRecord = {
  id: string
  schoolId: string
  studentId: string
  classId: string | null
  incidentDate: string
  nature: DisciplineNature
  resolution: string
  notes: string | null
  recordedBy: string          // Staff ID
  createdAt: string
  // Resolved display names (populated by useDisciplineRecords join)
  studentName?: string
  className?: string
}

// ── TIMETABLE ──────────────────────────────────────────────────────────────
export type TimetablePeriod = {
  id: string
  schoolId: string
  classId: string
  subjectId: string
  teacherId: string
  dayOfWeek: 1 | 2 | 3 | 4 | 5   // 1=Mon … 5=Fri
  periodNumber: number
  startTime: string               // HH:MM
  endTime: string
  term: string
  year: number
}

// ── CURRICULUM TOPIC ───────────────────────────────────────────────────────
export type CurriculumTopic = {
  id: string
  schoolId: string
  subjectId: string
  classId: string
  topicName: string
  ncdcCode: string | null
  term: string
  year: number
  plannedDate: string | null
  coveredAt: string | null
  coveredBy: string | null    // auth user ID of teacher who marked covered
  teacherId: string | null    // FK → staff.id
  sequenceOrder: number
}

// ── ANNOUNCEMENT ───────────────────────────────────────────────────────────
// Separate from 1:1 Message — stored in announcements table.
export type Announcement = {
  id: string
  schoolId: string
  fromUserId: string
  fromName: string            // denormalised for read performance
  body: string
  attachmentUrl: string | null
  postedAt: string
}

// ── MESSAGING CONTACT ─────────────────────────────────────────────────────
export type Contact = {
  id: string                  // auth_user_id (matches messages.from/to_user_id)
  staffId: string             // staff.id
  name: string
  role: UserRole
  photoUrl: string | null
  unreadCount: number
}

// ── SENIORITY ORDER ───────────────────────────────────────────────────────
// Used to sort contacts in the messaging panel.
export const ROLE_SENIORITY: Record<UserRole, number> = {
  principal:     1,
  deputy:        2,
  dos:           3,
  secretary:     4,
  bursar:        5,
  class_teacher: 6,
  teacher:       7,
  it_admin:      8,
  student:       9,
  parent:        10,
}

// ── DOS OVERVIEW TYPES ────────────────────────────────────────────────────
export type SubjectRanking = {
  subjectId: string
  subjectName: string
  classAverage: number
  passRate: number
  highest: number
  lowest: number
}

export type PassRatePoint = {
  label: string   // e.g. "T1 2025"
  rate: number
}

export type DosOverview = {
  totalStudents: number
  overallPassRate: number
  subjectsBelowFifty: number
  activeTeachers: number
  examJournalsThisTerm: number
  curriculumTopicsCovered: number
  passRateTrend: PassRatePoint[]
  subjectRankings: SubjectRanking[]
}

// ── DOS CLASS PERFORMANCE TYPES ───────────────────────────────────────────
export type ClassSubjectBreakdown = {
  subjectId: string
  subjectName: string
  average: number
  passRate: number
  studentCount: number
}

export type StudentRankEntry = {
  studentId: string
  name: string
  average: number
}

export type DosClassPerformance = {
  subjectBreakdown: ClassSubjectBreakdown[]
  topStudents: StudentRankEntry[]
  bottomStudents: StudentRankEntry[]
}

// ── DOS TEACHER PERFORMANCE TYPES ─────────────────────────────────────────
export type TeacherPerfRow = {
  staffId: string
  name: string
  subjects: string[]
  classes: string[]
  passRate: number
  assessmentsThisTerm: number
  curriculumCoverage: number   // 0–100 %
}

// ── SYSTEM KPI TYPES ──────────────────────────────────────────────────────
export type RoleLoginStat = {
  role: UserRole
  lastLogin: string | null
  activeToday: number
}

export type SystemKpis = {
  totalUsers: number
  activeToday: number
  roleStats: RoleLoginStat[]
  storageUsedMb: number
  syncQueuePending: number
  syncQueueFailed: number
}

// ── USER MANAGEMENT ROW ───────────────────────────────────────────────────
export type UserRow = {
  staffId: string
  authUserId: string | null
  name: string
  role: UserRole
  lastLogin: string | null
  isActive: boolean
}

// ── SCHOOL SETTINGS ───────────────────────────────────────────────────────
export type SchoolSettings = {
  id: string
  schoolName: string
  shortName: string | null
  motto: string | null
  logoUrl: string | null
  primaryColor: string
  currency: string  // DB NEEDS: ADD COLUMN currency TEXT — hardcoded 'UGX' until then
}

export type ApiConfig = {
  atApiKey: string | null        // Africa's Talking — masked after save
  atUsername: string | null
  atSenderId: string | null
  waPhoneNumberId: string | null // WhatsApp Cloud API
  waAccessToken: string | null   // masked after save
  atEnabled: boolean
  waEnabled: boolean
}

// ── TERM PROGRESS ─────────────────────────────────────────────────────────
export type TermEventType = 'exam' | 'ca' | 'aoi' | 'general'

export type TermEvent = {
  id: string
  title: string
  date: string       // ISO date string
  type: TermEventType
  subjectName?: string
  className?: string
  classAverage?: number  // filled when past + results available
}

export type TermProgress = {
  termStart: string     // ISO date
  termEnd: string       // ISO date
  currentTerm: string   // e.g. "Term 1"
  percentElapsed: number
  weekNumber: number
  totalWeeks: number
  daysRemaining: number
  events: TermEvent[]
}

// ── SCHOOL EVENT ──────────────────────────────────────────────────────────
export type SchoolEvent = {
  id: string
  schoolId: string
  title: string
  eventDate: string
  eventType: string
  description: string | null
  subjectId: string | null
  classId: string | null
  streamId: string | null
  totalMarks: number | null
  passMark: number | null
  journaled: boolean
  journalId: string | null
  createdBy: string
  term: string | null
  year: number | null
  createdAt: string
}

// ── TIMETABLE SLOT ────────────────────────────────────────────────────────
export type TimetableSlot = {
  id: string
  schoolId: string
  classId: string
  streamId: string | null
  subjectId: string
  teacherId: string
  dayOfWeek: 1 | 2 | 3 | 4 | 5
  periodNumber: number
  startTime: string | null
  endTime: string | null
  term: string
  year: number
  isPublished: boolean
  // Joined fields (populated by hook)
  subjectName?: string
  teacherName?: string
  className?: string
}

// ── PRINCIPAL DASHBOARD ───────────────────────────────────────────────────
export type PrincipalKpis = {
  totalStudents: number
  totalStaff: number
  overallPassRate: number
  feeCollectionRate: number
  attendanceRateThisWeek: number
  pendingReportCards: number
}

export type TopClass = {
  classId: string
  className: string
  passRate: number
  studentCount: number
}

export type FeeSummary = {
  totalExpected: number
  totalCollected: number
  outstanding: number
  overdueCount: number
}

export type AuditEntry = {
  id: string
  action: string
  tableName: string
  entityName: string | null
  userId: string
  userRole: string
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  createdAt: string
}

// ── STAFF FULL PROFILE ────────────────────────────────────────────────────
export type StaffFullProfile = {
  id: string
  authUserId: string | null
  firstName: string
  lastName: string
  role: UserRole
  email: string | null
  phone: string | null
  departmentId: string | null
  qualificationLevel: number | null
  employmentType: string | null
  staffNumber: string | null
  photoUrl: string | null
  isActive: boolean
  salaryBand: string | null
  joinDate: string | null
}
