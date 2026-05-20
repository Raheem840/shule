import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

export type UserRole =
  | 'principal' | 'deputy'       | 'dos'      | 'secretary'
  | 'bursar'    | 'class_teacher' | 'teacher'
  | 'student'   | 'parent'       | 'it_admin'

export type AuthUser = {
  id:          string
  email:       string
  role:        UserRole
  schoolId:    string
  name:        string
  studentIds?: string[]
}

type AuthCtx = {
  user:    AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, signOut: async () => {}
})

// ── Decode the JWT access token to get custom claims ──────────
// The Supabase JS client does NOT automatically parse custom hook
// claims into session.user — we must decode the JWT ourselves.
function decodeJWT(token: string): Record<string, any> {
  try {
    const base64 = token.split('.')[1]
    const padded  = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4, '='
    )
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function sessionToUser(session: Session | null): AuthUser | null {
  if (!session) return null

  // Decode the actual JWT to get our custom hook claims.
  // The hook may place claims either inside app_metadata or at the top level
  // of the JWT payload depending on which jsonb_set path was used in the SQL.
  // We read from both locations so the app works with either hook variant.
  const jwt = decodeJWT(session.access_token)

  const meta = jwt.app_metadata ?? {}

  // Prefer app_metadata path; fall back to top-level claim
  const role       = (meta.user_role   ?? jwt.user_role)   as UserRole      | undefined
  const schoolId   = (meta.school_id   ?? jwt.school_id)   as string        | undefined
  const name       = (meta.full_name   ?? jwt.full_name)   as string        | undefined
  const studentIds = (meta.student_ids ?? jwt.student_ids) as string[]      | undefined

  if (!role || !schoolId) {
    console.warn('Shule: JWT custom claims missing.', {
      jwt_keys:     Object.keys(jwt),
      app_metadata: meta,
      top_level:    { user_role: jwt.user_role, school_id: jwt.school_id },
    })
    return null
  }

  return {
    id:    session.user.id,
    email: session.user.email!,
    role,
    schoolId,
    name:  name ?? session.user.email!,
    studentIds,
  }
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(sessionToUser(session))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(sessionToUser(session))
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)