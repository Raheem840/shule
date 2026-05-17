import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/AuthContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/auth/LoginPage'
import type { UserRole } from './store/AuthContext'

// ─── Placeholder page (used until real dashboards are built) ──────────────────
// These sit INSIDE AppShell, so they don't need their own chrome.
function Placeholder({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: 8,
      fontFamily: 'var(--font2, Space Grotesk, sans-serif)',
    }}>
      <div style={{ fontSize: 32 }}>🚧</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt, #0f172a)' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--txt3, #94a3b8)' }}>
        Coming in the next session
      </div>
    </div>
  )
}

// ─── Role → home route ────────────────────────────────────────────────────────
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

// ─── Helper: wraps a role's routes in ProtectedRoute + AppShell ───────────────
function RoleShell({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={roles}>
      <AppShell />
    </ProtectedRoute>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/"      element={<RoleRedirect />} />

      {/* ── Principal ──────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['principal']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/principal/dashboard"    element={<Placeholder label="Principal Dashboard" />} />
        <Route path="/principal/analytics"    element={<Placeholder label="Analytics" />} />
        <Route path="/principal/audit"        element={<Placeholder label="Audit Log" />} />
        <Route path="/principal/students"     element={<Placeholder label="Students" />} />
        <Route path="/principal/staff"        element={<Placeholder label="Staff" />} />
        <Route path="/principal/classes"      element={<Placeholder label="Classes" />} />
        <Route path="/principal/report-cards" element={<Placeholder label="Report Cards" />} />
        <Route path="/principal/academic-year"element={<Placeholder label="Academic Year" />} />
        <Route path="/principal/messages"     element={<Placeholder label="Messages" />} />
        <Route path="/principal/announcements"element={<Placeholder label="Announcements" />} />
        <Route path="/principal/settings"     element={<Placeholder label="Settings" />} />
      </Route>

      {/* ── Deputy ─────────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['deputy', 'principal']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/deputy/dashboard"  element={<Placeholder label="Deputy Dashboard" />} />
        <Route path="/deputy/discipline" element={<Placeholder label="Discipline Records" />} />
        <Route path="/deputy/timetable"  element={<Placeholder label="Timetable" />} />
        <Route path="/deputy/students"   element={<Placeholder label="Students" />} />
        <Route path="/deputy/messages"   element={<Placeholder label="Messages" />} />
      </Route>

      {/* ── DoS ────────────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['dos', 'principal']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/dos/dashboard"  element={<Placeholder label="DoS Dashboard" />} />
        <Route path="/dos/subjects"   element={<Placeholder label="Subjects" />} />
        <Route path="/dos/classes"    element={<Placeholder label="Classes" />} />
        <Route path="/dos/teachers"   element={<Placeholder label="Teachers" />} />
        <Route path="/dos/curriculum" element={<Placeholder label="Curriculum Plan" />} />
        <Route path="/dos/journals"   element={<Placeholder label="All Journals" />} />
        <Route path="/dos/timetable"  element={<Placeholder label="Timetable" />} />
        <Route path="/dos/messages"   element={<Placeholder label="Messages" />} />
      </Route>

      {/* ── Secretary ──────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['secretary', 'principal']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/secretary/dashboard"    element={<Placeholder label="Secretary Dashboard" />} />
        <Route path="/secretary/students"     element={<Placeholder label="Students" />} />
        <Route path="/secretary/staff"        element={<Placeholder label="Staff" />} />
        <Route path="/secretary/classes"      element={<Placeholder label="Classes" />} />
        <Route path="/secretary/fee-status"   element={<Placeholder label="Fee Status" />} />
        <Route path="/secretary/report-cards" element={<Placeholder label="Report Cards" />} />
        <Route path="/secretary/portal-links" element={<Placeholder label="Portal Links" />} />
        <Route path="/secretary/import"       element={<Placeholder label="Import Data" />} />
        <Route path="/secretary/messages"     element={<Placeholder label="Messages" />} />
      </Route>

      {/* ── Bursar ─────────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['bursar', 'principal']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/bursar/dashboard"     element={<Placeholder label="Bursar Dashboard" />} />
        <Route path="/bursar/fees"          element={<Placeholder label="Fee Ledger" />} />
        <Route path="/bursar/import"        element={<Placeholder label="Import Fees" />} />
        <Route path="/bursar/fee-structure" element={<Placeholder label="Fee Structure" />} />
        <Route path="/bursar/add-payment"   element={<Placeholder label="Add Payment" />} />
        <Route path="/bursar/reminders"     element={<Placeholder label="SMS Reminders" />} />
        <Route path="/bursar/delivery-log"  element={<Placeholder label="Delivery Log" />} />
        <Route path="/bursar/salaries"      element={<Placeholder label="Salary Records" />} />
        <Route path="/bursar/reports"       element={<Placeholder label="Fee Reports" />} />
      </Route>

      {/* ── Teacher / Class Teacher ─────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['teacher', 'class_teacher', 'dos', 'principal']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/teacher/dashboard"      element={<Placeholder label="Teacher Dashboard" />} />
        <Route path="/teacher/exams"          element={<Placeholder label="Exam Journal" />} />
        <Route path="/teacher/marks"          element={<Placeholder label="Enter Marks" />} />
        <Route path="/teacher/attendance"     element={<Placeholder label="Attendance" />} />
        <Route path="/teacher/curriculum"     element={<Placeholder label="Curriculum" />} />
        <Route path="/teacher/report-preview" element={<Placeholder label="Report Preview" />} />
        <Route path="/teacher/messages"       element={<Placeholder label="Messages" />} />
      </Route>

      {/* ── Student ────────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['student']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/student/portal"       element={<Placeholder label="Student Portal" />} />
        <Route path="/student/results"      element={<Placeholder label="My Results" />} />
        <Route path="/student/fees"         element={<Placeholder label="My Fees" />} />
        <Route path="/student/attendance"   element={<Placeholder label="Attendance" />} />
        <Route path="/student/report-cards" element={<Placeholder label="Report Cards" />} />
        <Route path="/student/notices"      element={<Placeholder label="Notices" />} />
        <Route path="/student/survey"       element={<Placeholder label="Term Survey" />} />
      </Route>

      {/* ── Parent ─────────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['parent']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/parent/portal"        element={<Placeholder label="Parent Portal" />} />
        <Route path="/parent/results"       element={<Placeholder label="Results" />} />
        <Route path="/parent/fees"          element={<Placeholder label="Fee Balance" />} />
        <Route path="/parent/attendance"    element={<Placeholder label="Attendance" />} />
        <Route path="/parent/report-cards"  element={<Placeholder label="Report Cards" />} />
        <Route path="/parent/notices"       element={<Placeholder label="Notices" />} />
      </Route>

      {/* ── IT Admin ───────────────────────────────────────────── */}
      <Route element={
        <ProtectedRoute allowedRoles={['it_admin', 'principal']}>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route path="/admin/dashboard" element={<Placeholder label="IT Admin Dashboard" />} />
        <Route path="/admin/users"     element={<Placeholder label="Users" />} />
        <Route path="/admin/resets"    element={<Placeholder label="Password Resets" />} />
        <Route path="/admin/school"    element={<Placeholder label="School Profile" />} />
        <Route path="/admin/api"       element={<Placeholder label="SMS / WhatsApp" />} />
        <Route path="/admin/templates" element={<Placeholder label="Report Templates" />} />
        <Route path="/admin/settings"  element={<Placeholder label="System Settings" />} />
      </Route>

      {/* ── Catch-all ──────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
