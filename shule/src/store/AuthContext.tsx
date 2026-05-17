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

  // Decode the actual JWT to get our custom hook claims
  const jwt = decodeJWT(session.access_token)

  // Our hook puts claims inside app_metadata
  const meta = jwt.app_metadata ?? {}

  const role     = meta.user_role  as UserRole
  const schoolId = meta.school_id  as string
  const name     = meta.full_name  as string
  const studentIds = meta.student_ids as string[] | undefined

  if (!role || !schoolId) {
    console.warn('Shule: JWT custom claims missing.', {
      jwt_keys: Object.keys(jwt),
      app_metadata: meta
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