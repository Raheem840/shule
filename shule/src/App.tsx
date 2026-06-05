import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/AuthContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { PageLoader } from './components/ui/PageLoader'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { ChunkErrorBoundary } from './components/shared/ChunkErrorBoundary'
import type { UserRole } from './store/AuthContext'

// ─── Lazy page imports ─────────────────────────────────────────────────────
const LoginPage               = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const ParentLoginPage         = lazy(() => import('./pages/auth/ParentLoginPage').then(m => ({ default: m.ParentLoginPage })))
const ResetPasswordPage       = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))

// Principal
const PrincipalDashboard       = lazy(() => import('./pages/principal/PrincipalDashboard').then(m => ({ default: m.PrincipalDashboard })))
const PrincipalStudentsPage    = lazy(() => import('./pages/principal/PrincipalStudentsPage').then(m => ({ default: m.PrincipalStudentsPage })))
const StudentFullProfilePage   = lazy(() => import('./pages/principal/StudentFullProfilePage').then(m => ({ default: m.StudentFullProfilePage })))
const PrincipalStaffPage       = lazy(() => import('./pages/principal/PrincipalStaffPage').then(m => ({ default: m.PrincipalStaffPage })))
const PrincipalStaffProfilePage = lazy(() => import('./pages/principal/PrincipalStaffProfilePage').then(m => ({ default: m.PrincipalStaffProfilePage })))
const PrincipalReportCardsPage = lazy(() => import('./pages/principal/PrincipalReportCardsPage').then(m => ({ default: m.PrincipalReportCardsPage })))
const AuditLogPage             = lazy(() => import('./pages/principal/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const PrincipalSettingsPage    = lazy(() => import('./pages/principal/PrincipalSettingsPage').then(m => ({ default: m.PrincipalSettingsPage })))
const PrincipalAnalyticsPage   = lazy(() => import('./pages/principal/PrincipalAnalyticsPage').then(m => ({ default: m.PrincipalAnalyticsPage })))
const PrincipalClassesPage     = lazy(() => import('./pages/principal/PrincipalClassesPage').then(m => ({ default: m.PrincipalClassesPage })))
const AcademicYearPage         = lazy(() => import('./pages/principal/AcademicYearPage').then(m => ({ default: m.AcademicYearPage })))

// Deputy
const DeputyDashboard          = lazy(() => import('./pages/deputy/DeputyDashboard').then(m => ({ default: m.DeputyDashboard })))
const DeputyTimetablePage      = lazy(() => import('./pages/deputy/DeputyTimetablePage').then(m => ({ default: m.DeputyTimetablePage })))
const DisciplinePage           = lazy(() => import('./pages/deputy/DisciplinePage').then(m => ({ default: m.DisciplinePage })))
const DeputyStudentsPage       = lazy(() => import('./pages/deputy/DeputyStudentsPage').then(m => ({ default: m.DeputyStudentsPage })))
const DeputyStaffPage          = lazy(() => import('./pages/deputy/DeputyStaffPage').then(m => ({ default: m.DeputyStaffPage })))

// DoS
const DosDashboard             = lazy(() => import('./pages/dos/DosDashboard').then(m => ({ default: m.DosDashboard })))
const DosTimetablePage         = lazy(() => import('./pages/dos/DosTimetablePage').then(m => ({ default: m.DosTimetablePage })))
const DosSurveysPage           = lazy(() => import('./pages/dos/DosSurveysPage').then(m => ({ default: m.DosSurveysPage })))
const DosSubjectsPage          = lazy(() => import('./pages/dos/DosSubjectsPage').then(m => ({ default: m.DosSubjectsPage })))
const DosClassesPage           = lazy(() => import('./pages/dos/DosClassesPage').then(m => ({ default: m.DosClassesPage })))
const DosTeachersPage          = lazy(() => import('./pages/dos/DosTeachersPage').then(m => ({ default: m.DosTeachersPage })))
const DosCurriculumPage        = lazy(() => import('./pages/dos/DosCurriculumPage').then(m => ({ default: m.DosCurriculumPage })))
const DosJournalsPage          = lazy(() => import('./pages/dos/DosJournalsPage').then(m => ({ default: m.DosJournalsPage })))
const DosStudentsPage          = lazy(() => import('./pages/dos/DosStudentsPage').then(m => ({ default: m.DosStudentsPage })))

// Secretary
const SecretaryDashboard       = lazy(() => import('./pages/secretary/SecretaryDashboard').then(m => ({ default: m.SecretaryDashboard })))
const SecretaryStudentsPage    = lazy(() => import('./pages/secretary/SecretaryStudentsPage').then(m => ({ default: m.SecretaryStudentsPage })))
const SecretaryStaffPage       = lazy(() => import('./pages/secretary/SecretaryStaffPage').then(m => ({ default: m.SecretaryStaffPage })))
const ClassListPage            = lazy(() => import('./pages/secretary/ClassListPage').then(m => ({ default: m.ClassListPage })))
const ParentCredentialsPage    = lazy(() => import('./pages/secretary/ParentCredentialsPage').then(m => ({ default: m.ParentCredentialsPage })))
const ReportCardsPage          = lazy(() => import('./pages/secretary/ReportCardsPage').then(m => ({ default: m.ReportCardsPage })))
const SecretaryStudentEditPage = lazy(() => import('./pages/secretary/SecretaryStudentEditPage').then(m => ({ default: m.SecretaryStudentEditPage })))
const FeeStatusPage            = lazy(() => import('./pages/secretary/FeeStatusPage').then(m => ({ default: m.FeeStatusPage })))
const ImportDataPage           = lazy(() => import('./pages/secretary/ImportDataPage').then(m => ({ default: m.ImportDataPage })))
const SchoolAtAGlancePage      = lazy(() => import('./pages/secretary/SchoolAtAGlancePage').then(m => ({ default: m.SchoolAtAGlancePage })))
const SecretaryReportsPage     = lazy(() => import('./pages/secretary/SecretaryReportsPage').then(m => ({ default: m.SecretaryReportsPage })))

// Bursar
const BursarDashboard          = lazy(() => import('./pages/bursar/BursarDashboard').then(m => ({ default: m.BursarDashboard })))
const FeeLedgerPage            = lazy(() => import('./pages/bursar/FeeLedgerPage').then(m => ({ default: m.FeeLedgerPage })))
const FeeStructurePage         = lazy(() => import('./pages/bursar/FeeStructurePage').then(m => ({ default: m.FeeStructurePage })))
const SmsReminderPage          = lazy(() => import('./pages/bursar/SmsReminderPage').then(m => ({ default: m.SmsReminderPage })))
const BursarImportPage         = lazy(() => import('./pages/bursar/BursarImportPage').then(m => ({ default: m.BursarImportPage })))
const AddPaymentPage           = lazy(() => import('./pages/bursar/AddPaymentPage').then(m => ({ default: m.AddPaymentPage })))
const DeliveryLogPage          = lazy(() => import('./pages/bursar/DeliveryLogPage').then(m => ({ default: m.DeliveryLogPage })))
const FeeReportsPage           = lazy(() => import('./pages/bursar/FeeReportsPage').then(m => ({ default: m.FeeReportsPage })))
const BursarStudentsPage       = lazy(() => import('./pages/bursar/BursarStudentsPage').then(m => ({ default: m.BursarStudentsPage })))
const BursarMessagesPage       = lazy(() => import('./pages/bursar/BursarMessagesPage').then(m => ({ default: m.BursarMessagesPage })))

// Teacher
const TeacherDashboard         = lazy(() => import('./pages/teacher/TeacherDashboard').then(m => ({ default: m.TeacherDashboard })))
const TeacherEventsPage        = lazy(() => import('./pages/teacher/TeacherEventsPage').then(m => ({ default: m.TeacherEventsPage })))
const ExamJournalPage          = lazy(() => import('./pages/teacher/ExamJournalPage').then(m => ({ default: m.ExamJournalPage })))
const MarkEntryPage            = lazy(() => import('./pages/teacher/MarkEntryPage').then(m => ({ default: m.MarkEntryPage })))
const TeacherRemarksPage       = lazy(() => import('./pages/teacher/TeacherRemarksPage').then(m => ({ default: m.TeacherRemarksPage })))
const AttendancePage           = lazy(() => import('./pages/teacher/AttendancePage').then(m => ({ default: m.AttendancePage })))
const TeacherTimetablePage     = lazy(() => import('./pages/teacher/TeacherTimetablePage').then(m => ({ default: m.TeacherTimetablePage })))
const TeacherCurriculumPage         = lazy(() => import('./pages/teacher/TeacherCurriculumPage').then(m => ({ default: m.TeacherCurriculumPage })))
const ReportPreviewPage             = lazy(() => import('./pages/teacher/ReportPreviewPage').then(m => ({ default: m.ReportPreviewPage })))
const ClassTeacherStudentsPage      = lazy(() => import('./pages/teacher/ClassTeacherStudentsPage').then(m => ({ default: m.ClassTeacherStudentsPage })))
const TeacherMyClassesPage          = lazy(() => import('./pages/teacher/TeacherMyClassesPage').then(m => ({ default: m.TeacherMyClassesPage })))
const TeacherParentMessagesPage     = lazy(() => import('./pages/teacher/TeacherParentMessagesPage').then(m => ({ default: m.TeacherParentMessagesPage })))

// Student / Parent
const StudentPortalPage        = lazy(() => import('./pages/student/StudentPortalPage').then(m => ({ default: m.StudentPortalPage })))
const ParentPortalPage         = lazy(() => import('./pages/parent/ParentPortalPage').then(m => ({ default: m.ParentPortalPage })))

// Admin
const AdminDashboard           = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminUsersPage           = lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const PasswordResetsPage       = lazy(() => import('./pages/admin/PasswordResetsPage').then(m => ({ default: m.PasswordResetsPage })))
const SchoolProfilePage        = lazy(() => import('./pages/admin/SchoolProfilePage').then(m => ({ default: m.SchoolProfilePage })))
const ApiConfigPage            = lazy(() => import('./pages/admin/ApiConfigPage').then(m => ({ default: m.ApiConfigPage })))
const TemplatesPage            = lazy(() => import('./pages/admin/TemplatesPage').then(m => ({ default: m.TemplatesPage })))
const SystemSettingsPage       = lazy(() => import('./pages/admin/SystemSettingsPage').then(m => ({ default: m.SystemSettingsPage })))
const CredentialsMgmtPage     = lazy(() => import('./pages/admin/CredentialsMgmtPage').then(m => ({ default: m.CredentialsMgmtPage })))

// Shared
const MessagingPage            = lazy(() => import('./pages/shared/MessagingPage').then(m => ({ default: m.MessagingPage })))
const ProfilePage              = lazy(() => import('./pages/shared/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SharedEventsPage         = lazy(() => import('./pages/shared/SharedEventsPage').then(m => ({ default: m.SharedEventsPage })))
const RemarksViewPage          = lazy(() => import('./pages/shared/RemarksViewPage').then(m => ({ default: m.RemarksViewPage })))

// ─── Role → home route ────────────────────────────────────────────────────
const ROLE_HOME: Record<UserRole, string> = {
  principal:     '/principal/dashboard',
  deputy:        '/deputy/dashboard',
  dos:           '/dos/dashboard',
  secretary:     '/secretary/dashboard',
  bursar:        '/bursar/dashboard',
  class_teacher: '/teacher/dashboard',
  teacher:       '/teacher/dashboard',
  student:       '/student/portal',
  parent:        '/parent/portal',
  it_admin:      '/admin/dashboard',
}

function RoleRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />
  return <Navigate to={ROLE_HOME[user.role]} replace />
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <ErrorBoundary>
      <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/parent/login"  element={<ParentLoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/"              element={<RoleRedirect />} />

          {/* ── Principal ──────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['principal']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/principal/dashboard"            element={<PrincipalDashboard />} />
            <Route path="/principal/analytics"            element={<PrincipalAnalyticsPage />} />
            <Route path="/principal/audit"                element={<AuditLogPage />} />
            <Route path="/principal/students"             element={<PrincipalStudentsPage />} />
            <Route path="/principal/students/:studentId"  element={<StudentFullProfilePage />} />
            <Route path="/principal/staff"                element={<PrincipalStaffPage />} />
            <Route path="/principal/staff/:staffId"       element={<PrincipalStaffProfilePage />} />
            <Route path="/principal/classes"              element={<PrincipalClassesPage />} />
            <Route path="/principal/report-cards"         element={<PrincipalReportCardsPage />} />
            <Route path="/principal/academic-year"        element={<AcademicYearPage />} />
            <Route path="/principal/events"               element={<SharedEventsPage />} />
            <Route path="/principal/messages"             element={<MessagingPage />} />
            <Route path="/principal/announcements"        element={<Navigate to="/principal/messages" replace />} />
            <Route path="/principal/settings"             element={<PrincipalSettingsPage />} />
            <Route path="/principal/surveys"              element={<DosSurveysPage />} />
            <Route path="/principal/remarks"              element={<RemarksViewPage />} />
          </Route>

          {/* ── Deputy ─────────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['deputy', 'principal']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/deputy/dashboard"  element={<DeputyDashboard />} />
            <Route path="/deputy/discipline" element={<DisciplinePage />} />
            <Route path="/deputy/timetable"  element={<DeputyTimetablePage />} />
            <Route path="/deputy/students"   element={<DeputyStudentsPage />} />
            <Route path="/deputy/staff"      element={<DeputyStaffPage />} />
            <Route path="/deputy/events"     element={<SharedEventsPage />} />
            <Route path="/deputy/messages"   element={<MessagingPage />} />
            <Route path="/deputy/surveys"    element={<DosSurveysPage />} />
            <Route path="/deputy/remarks"    element={<RemarksViewPage />} />
          </Route>

          {/* ── DoS ────────────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['dos', 'principal']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/dos/dashboard"  element={<DosDashboard />} />
            <Route path="/dos/subjects"   element={<DosSubjectsPage />} />
            <Route path="/dos/classes"    element={<DosClassesPage />} />
            <Route path="/dos/teachers"   element={<DosTeachersPage />} />
            <Route path="/dos/curriculum" element={<DosCurriculumPage />} />
            <Route path="/dos/journals"   element={<DosJournalsPage />} />
            <Route path="/dos/timetable"  element={<DosTimetablePage />} />
            <Route path="/dos/surveys"    element={<DosSurveysPage />} />
            <Route path="/dos/students"   element={<DosStudentsPage />} />
            <Route path="/dos/remarks"    element={<RemarksViewPage />} />
            <Route path="/dos/events"     element={<TeacherEventsPage />} />
            <Route path="/dos/messages"   element={<MessagingPage />} />
          </Route>

          {/* ── Secretary ──────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['secretary', 'principal']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/secretary/dashboard"    element={<SecretaryDashboard />} />
            <Route path="/secretary/students"                element={<SecretaryStudentsPage />} />
            <Route path="/secretary/students/:studentId"    element={<SecretaryStudentEditPage />} />
            <Route path="/secretary/staff"        element={<SecretaryStaffPage />} />
            <Route path="/secretary/classes"      element={<ClassListPage />} />
            <Route path="/secretary/fee-status"   element={<FeeStatusPage />} />
            <Route path="/secretary/report-cards" element={<ReportCardsPage />} />
            <Route path="/secretary/portal-links" element={<ParentCredentialsPage />} />
            <Route path="/secretary/import"       element={<ImportDataPage />} />
            <Route path="/secretary/messages"     element={<MessagingPage />} />
            <Route path="/secretary/briefing"     element={<SchoolAtAGlancePage />} />
            <Route path="/secretary/reports"      element={<SecretaryReportsPage />} />
          </Route>

          {/* ── Bursar ─────────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['bursar', 'principal']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/bursar/dashboard"     element={<BursarDashboard />} />
            <Route path="/bursar/fees"          element={<FeeLedgerPage />} />
            <Route path="/bursar/fee-structure" element={<FeeStructurePage />} />
            <Route path="/bursar/import"        element={<BursarImportPage />} />
            <Route path="/bursar/reminders"     element={<SmsReminderPage />} />
            <Route path="/bursar/add-payment"   element={<AddPaymentPage />} />
            <Route path="/bursar/delivery-log"  element={<DeliveryLogPage />} />
            <Route path="/bursar/reports"       element={<FeeReportsPage />} />
            <Route path="/bursar/students"        element={<BursarStudentsPage />} />
            <Route path="/bursar/messages"        element={<MessagingPage />} />
            <Route path="/bursar/parent-messages" element={<BursarMessagesPage />} />
          </Route>

          {/* ── Teacher / Class Teacher ─────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['teacher', 'class_teacher', 'dos', 'principal']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/teacher/dashboard"              element={<TeacherDashboard />} />
            <Route path="/teacher/events"                 element={<TeacherEventsPage />} />
            <Route path="/teacher/my-class"               element={<ClassTeacherStudentsPage />} />
            <Route path="/teacher/my-classes"             element={<TeacherMyClassesPage />} />
            <Route path="/teacher/exams"                  element={<ExamJournalPage />} />
            <Route path="/teacher/exams/:journalId/marks" element={<MarkEntryPage />} />
            <Route path="/teacher/exams/remarks"          element={<TeacherRemarksPage />} />
            <Route path="/teacher/attendance"             element={<AttendancePage />} />
            <Route path="/teacher/timetable"              element={<TeacherTimetablePage />} />
            <Route path="/teacher/curriculum"             element={<TeacherCurriculumPage />} />
            <Route path="/teacher/report-preview"          element={<ReportPreviewPage />} />
            <Route path="/teacher/messages"               element={<MessagingPage />} />
            <Route path="/teacher/parent-messages"        element={<TeacherParentMessagesPage />} />
          </Route>

          {/* ── Student ────────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['student']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/student/portal"       element={<StudentPortalPage />} />
            <Route path="/student/events"       element={<SharedEventsPage />} />
            <Route path="/student/results"      element={<Navigate to="/student/portal" replace />} />
            <Route path="/student/fees"         element={<Navigate to="/student/portal" replace />} />
            <Route path="/student/attendance"   element={<Navigate to="/student/portal" replace />} />
            <Route path="/student/report-cards" element={<Navigate to="/student/portal" replace />} />
            <Route path="/student/notices"      element={<Navigate to="/student/portal" replace />} />
            <Route path="/student/survey"       element={<Navigate to="/student/portal" replace />} />
          </Route>

          {/* ── Parent ─────────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['parent']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/parent/portal"        element={<ParentPortalPage />} />
            <Route path="/parent/events"        element={<SharedEventsPage />} />
            <Route path="/parent/results"       element={<Navigate to="/parent/portal" replace />} />
            <Route path="/parent/fees"          element={<Navigate to="/parent/portal" replace />} />
            <Route path="/parent/attendance"    element={<Navigate to="/parent/portal" replace />} />
            <Route path="/parent/report-cards"  element={<Navigate to="/parent/portal" replace />} />
            <Route path="/parent/notices"       element={<Navigate to="/parent/portal" replace />} />
          </Route>

          {/* ── IT Admin ───────────────────────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['it_admin', 'principal']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users"     element={<AdminUsersPage />} />
            <Route path="/admin/resets"    element={<PasswordResetsPage />} />
            <Route path="/admin/school"    element={<SchoolProfilePage />} />
            <Route path="/admin/api"       element={<ApiConfigPage />} />
            <Route path="/admin/templates" element={<TemplatesPage />} />
            <Route path="/admin/settings"     element={<SystemSettingsPage />} />
            <Route path="/admin/credentials" element={<CredentialsMgmtPage />} />
            <Route path="/admin/messages"  element={<MessagingPage />} />
          </Route>

          {/* ── Profile — all staff roles ──────────────────────────── */}
          <Route element={
            <ProtectedRoute allowedRoles={['principal','deputy','dos','secretary','bursar','class_teacher','teacher','it_admin']}>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* ── Catch-all ──────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ChunkErrorBoundary>
    </ErrorBoundary>
  )
}
