import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/AuthContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import type { UserRole } from './store/AuthContext'

// ─── Placeholder pages (we'll replace these with real ones) ───
const Placeholder = ({ label }: { label: string }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', fontFamily: 'Space Grotesk, sans-serif',
    flexDirection: 'column', gap: 8
  }}>
    <div style={{ fontSize: 32 }}>🚧</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{label}</div>
    <div style={{ fontSize: 12, color: '#94a3b8' }}>Coming soon</div>
  </div>
)

// ─── Login page (minimal — we'll style it properly next) ──────
import { LoginPage } from './pages/auth/LoginPage'

// ─── Role → home route ────────────────────────────────────────
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

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/"      element={<RoleRedirect />} />

      {/* Principal */}
      <Route path="/principal/*" element={
        <ProtectedRoute allowedRoles={['principal']}>
          <Placeholder label="Principal Dashboard" />
        </ProtectedRoute>
      } />

      {/* Deputy */}
      <Route path="/deputy/*" element={
        <ProtectedRoute allowedRoles={['deputy', 'principal']}>
          <Placeholder label="Deputy Dashboard" />
        </ProtectedRoute>
      } />

      {/* DoS */}
      <Route path="/dos/*" element={
        <ProtectedRoute allowedRoles={['dos', 'principal']}>
          <Placeholder label="Director of Studies" />
        </ProtectedRoute>
      } />

      {/* Secretary */}
      <Route path="/secretary/*" element={
        <ProtectedRoute allowedRoles={['secretary', 'principal']}>
          <Placeholder label="Secretary Dashboard" />
        </ProtectedRoute>
      } />

      {/* Bursar — finance hard block */}
      <Route path="/bursar/*" element={
        <ProtectedRoute allowedRoles={['bursar', 'principal']}>
          <Placeholder label="Bursar Dashboard" />
        </ProtectedRoute>
      } />

      {/* Teacher */}
      <Route path="/teacher/*" element={
        <ProtectedRoute allowedRoles={['teacher', 'class_teacher', 'dos', 'principal']}>
          <Placeholder label="Teacher Dashboard" />
        </ProtectedRoute>
      } />

      {/* Student */}
      <Route path="/student/*" element={
        <ProtectedRoute allowedRoles={['student']}>
          <Placeholder label="Student Portal" />
        </ProtectedRoute>
      } />

      {/* Parent */}
      <Route path="/parent/*" element={
        <ProtectedRoute allowedRoles={['parent']}>
          <Placeholder label="Parent Portal" />
        </ProtectedRoute>
      } />

      {/* IT Admin */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['it_admin', 'principal']}>
          <Placeholder label="IT Admin Dashboard" />
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}