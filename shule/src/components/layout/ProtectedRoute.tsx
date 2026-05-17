import { Navigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import type { UserRole } from '../../store/AuthContext'

type Props = {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export function ProtectedRoute({ allowedRoles, children }: Props) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user)   return <Navigate to="/login" replace />

  if (!allowedRoles.includes(user.role)) return <AccessDenied />

  return <>{children}</>
}

function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f8fafc'
    }}>
      <div style={{
        width: 32, height: 32,
        border: '3px solid #e2e8f0',
        borderTopColor: '#0d9488',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function AccessDenied() {
  const { user, signOut } = useAuth()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: '#f8fafc',
      gap: 12, fontFamily: 'Space Grotesk, sans-serif'
    }}>
      <div style={{ fontSize: 48 }}>🚫</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
        Access Denied
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>
        Your role <strong style={{ color: '#0d9488' }}>{user?.role}</strong> cannot access this page.
      </div>
      <button
        onClick={() => signOut()}
        style={{
          marginTop: 8, padding: '8px 20px',
          background: '#0d9488', color: '#fff',
          border: 'none', borderRadius: 8,
          fontFamily: 'inherit', fontWeight: 700,
          cursor: 'pointer', fontSize: 13
        }}
      >
        Sign out
      </button>
    </div>
  )
}