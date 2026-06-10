import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES  = ['secretary', 'principal', 'it_admin', 'deputy', 'dos', 'bursar', 'teacher', 'class_teacher']
const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024  // 5 MB

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Verify JWT and extract role ─────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    // Role is in app_metadata (set by the custom access token hook)
    const userRole = (user.app_metadata?.user_role ?? '') as string
    if (!ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — secretary, principal or IT admin required' }, 403)
    }

    // ── 2. Parse multipart form data ───────────────────────────────────────
    const formData = await req.formData()
    const file    = formData.get('file')    as File   | null
    const staffId = formData.get('staffId') as string | null

    if (!file || !staffId) {
      return json({ error: 'Both file and staffId are required' }, 400)
    }

    // ── 3. Validate file ───────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json({ error: `Invalid file type "${file.type}". Allowed: jpg, png, webp.` }, 400)
    }
    if (file.size > MAX_SIZE_BYTES) {
      return json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.` }, 400)
    }

    // ── 4. Upload via service role client (bypasses RLS) ──────────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    const filePath   = `${staffId}/${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await serviceClient.storage
      .from('staff-photos')
      .upload(filePath, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return json({ error: 'Upload failed', detail: uploadError.message }, 500)
    }

    // ── 5. Return storage path only — never a signed URL ──────────────────
    return json({ path: filePath })

  } catch (err) {
    console.error('Unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
