// supabase.ts — creates our single Supabase client instance.
// Think of this like opening one database connection for the whole app.
// We import this wherever we need to talk to the database.

import { createClient } from '@supabase/supabase-js'

// Vite exposes .env.local variables through import.meta.env
// VITE_ prefix is required — Vite strips anything without it for security
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly at startup if env vars are missing
// Better to crash here than get mysterious errors later
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check your .env.local file.'
  )
}

// createClient returns an object with everything we need:
// supabase.from('students').select() — query data
// supabase.auth.signIn() — authenticate users
// supabase.storage.from('photos') — upload files
// The anon key is safe to expose in frontend — RLS policies enforce security
export const supabase = createClient(supabaseUrl, supabaseAnonKey)