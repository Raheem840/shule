import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { primeOfflineCache } from '../lib/syncQueue'
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
  user:          AuthUser | null
  loading:       boolean
  isOfflineMode: boolean
  authError:     string | null
  signOut:       () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, isOfflineMode: false, authError: null, signOut: async () => {}
})

// ── Decode the JWT access token to get custom claims ──────────
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

  const jwt = decodeJWT(session.access_token)
  const meta = jwt.app_metadata ?? {}

  const role       = (jwt.user_role   ?? meta.user_role)   as UserRole | undefined
  const schoolId   = (jwt.school_id   ?? meta.school_id)   as string   | undefined
  const name       = (jwt.full_name   ?? meta.full_name)   as string   | undefined
  const studentIds = (jwt.student_ids ?? meta.student_ids) as string[] | undefined

  if (!role || !schoolId) {
    console.warn('Shule: JWT custom claims missing.', {
      jwt_keys:     Object.keys(jwt),
      app_metadata: meta,
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

// ── Cache session to IndexedDB for offline use ────────────────
async function cacheSessionToDb(session: Session, user: AuthUser): Promise<void> {
  try {
    await db.auth_session.put({
      id:      'current',
      session: session as unknown,
      user,
      savedAt: new Date().toISOString(),
    })
  } catch { /* ignore */ }
}

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,          setUser]          = useState<AuthUser | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [authError,     setAuthError]     = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        let u = sessionToUser(session)
        let activeSession = session

        if (!u) {
          // Claims not in this token yet — refresh once to get hook claims
          const { data } = await supabase.auth.refreshSession()
          if (data.session) {
            activeSession = data.session
            u = sessionToUser(data.session)
          }
        }

        if (u) {
          setUser(u)
          setAuthError(null)
          await cacheSessionToDb(activeSession, u)
          void primeOfflineCache(u.schoolId)
        } else {
          if (import.meta.env.DEV) {
            console.error(
              '⚠ SHULE AUTH: JWT missing user_role/school_id.\n' +
              'Check:\n' +
              '1. Supabase Dashboard → Authentication → Hooks → Custom Access Token hook is registered\n' +
              '2. public.custom_access_token_hook function exists\n' +
              '3. Staff row has auth_user_id matching this auth user\n' +
              '4. Hook function is SECURITY DEFINER'
            )
          }
          setAuthError('Account not linked to a school role. Contact your IT Admin.')
        }
      } else if (!navigator.onLine) {
        // Offline — attempt to restore cached session
        try {
          const cached = await db.auth_session.get('current')
          if (cached?.user) {
            setUser(cached.user as AuthUser)
            setIsOfflineMode(true)
          }
        } catch { /* ignore */ }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          let u = sessionToUser(session)
          setIsOfflineMode(false)

          if (!u && event === 'SIGNED_IN') {
            // Fresh sign-in — hook claims may not be in this first token
            const { data } = await supabase.auth.refreshSession()
            if (data.session) u = sessionToUser(data.session)
          }

          if (u) {
            setUser(u)
            setAuthError(null)
            await cacheSessionToDb(session, u)
            void primeOfflineCache(u.schoolId)
          } else if (event === 'SIGNED_IN') {
            setAuthError('Account not linked to a school role. Contact your IT Admin.')
          }
        } else {
          setUser(null)
          setAuthError(null)
          setIsOfflineMode(false)
          try { await db.auth_session.delete('current') } catch { /* ignore */ }
        }
        setLoading(false)
      }
    )

    const handleOnline = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setIsOfflineMode(false)
      })
    }
    window.addEventListener('online', handleOnline)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const signOut = async () => {
    try { await db.auth_session.delete('current') } catch { /* ignore */ }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, isOfflineMode, authError, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
