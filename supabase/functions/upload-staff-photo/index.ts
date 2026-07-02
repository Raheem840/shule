import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES  = ['secretary', 'principal', 'it_admin', 'deputy', 'dos', 'bursar', 'teacher', 'class_teacher']
// These roles manage other staff members' records and may upload a photo for
// someone else (e.g. during registration). Every other role may only upload
// their own photo — enforced by comparing staffId to the caller's own staff row.
const MANAGES_OTHERS_ROLES = ['secretary', 'principal', 'it_admin']
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

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Role resolution — always re-verify against the live staff table (is_active
    // required). A JWT/app_metadata role claim is NOT trusted on its own: a token
    // issued before the caller was deactivated stays valid until it expires, and
    // trusting a stale claim would let a deactivated staff member keep uploading
    // photos (including for other staff, per MANAGES_OTHERS_ROLES below). This
    // lookup also gives us the caller's own staff id, needed for the ownership
    // check below.
    const { data: callerStaff } = await serviceClient
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    const userRole = (callerStaff?.role as string | undefined) ?? ''

    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
      return json({ error: 'Insufficient permissions — staff account required' }, 403)
    }

    // ── 2. Parse multipart form data ───────────────────────────────────────
    const formData = await req.formData()
    const file    = formData.get('file')    as File   | null
    const staffId = formData.get('staffId') as string | null

    if (!file || !staffId) {
      return json({ error: 'Both file and staffId are required' }, 400)
    }

    // Only secretary/principal/it_admin may set a photo for someone else
    // (e.g. during staff registration) — every other role may only upload
    // their own.
    if (!MANAGES_OTHERS_ROLES.includes(userRole) && staffId !== callerStaff?.id) {
      return json({ error: 'You can only update your own profile photo' }, 403)
    }

    // ── 3. Validate file ───────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json({ error: `Invalid file type "${file.type}". Allowed: jpg, png, webp.` }, 400)
    }
    if (file.size > MAX_SIZE_BYTES) {
      return json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.` }, 400)
    }

    // ── 4. Upload via service role client (bypasses RLS) ──────────────────
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

    // ── 5. Update staff.photo_url via service role so all roles can update their own photo ─
    // (staff UPDATE RLS only allows secretary/principal/it_admin; service role bypasses this)
    const { error: dbError } = await serviceClient
      .from('staff')
      .update({ photo_url: filePath })
      .eq('id', staffId)

    if (dbError) {
      console.error('DB update error:', dbError)
      // Clean up the uploaded file to avoid orphaned storage objects
      await serviceClient.storage.from('staff-photos').remove([filePath])
      return json({ error: 'Failed to update photo in database', detail: dbError.message }, 500)
    }

    // ── 6. Return storage path only — never a signed URL ──────────────────
    return json({ path: filePath })

  } catch (err) {
    console.error('Unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
