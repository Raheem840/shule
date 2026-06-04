import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../store/AuthContext'
import { uploadTemplate, getSignedUrl, BUCKETS } from '../../lib/storage'
import { validateFile } from '../../lib/fileValidation'
import { supabase } from '../../lib/supabase'

export function TemplatesPage() {
  const { user }       = useAuth()
  const fileRef        = useRef<HTMLInputElement>(null)
  const [uploading,    setUploading]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null)
  const [fileName,     setFileName]     = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return

    const err = validateFile(file, 'TEMPLATE')
    if (err) { setError(err); return }

    setError(null)
    setSuccess(false)
    setUploading(true)
    try {
      const path = await uploadTemplate(user.schoolId, file)
      setFileName(file.name)
      setSuccess(true)

      // Save the storage path into school_profile.report_template_url
      // so the PDF generator can find and download it when generating report cards
      await supabase
        .from('school_profile')
        .update({ report_template_url: path })
        .eq('id', user.schoolId)

      // Generate a short-lived signed URL for the preview only
      const signed = await getSignedUrl(BUCKETS.TEMPLATES, path, 300)
      setPreviewUrl(signed)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Report Templates</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Upload and manage report card templates</p>
        </div>
      </div>

      <div className="sui-glass-card" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 8h10M7 12h10M7 16h6" />
        </svg>

        <div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font2)', color: 'var(--txt)', marginBottom: 4 }}>
            Report Card Template
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 380 }}>
            Upload a PDF or image of your school's report card header/layout.
            Accepted: PDF, JPG, PNG, SVG — max 20MB.
          </div>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger)',
            borderRadius: 'var(--r)', padding: '0.6rem 1rem',
            fontSize: 12.5, color: 'var(--danger)', fontFamily: 'var(--font2)', width: '100%',
          }}>
            {error}
          </div>
        )}

        {success && fileName && (
          <div style={{
            background: 'var(--success-bg)', border: '1px solid var(--success)',
            borderRadius: 'var(--r)', padding: '0.6rem 1rem',
            fontSize: 12.5, color: 'var(--success)', fontFamily: 'var(--font2)', width: '100%',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>✓ {fileName} uploaded successfully</span>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', textDecoration: 'none' }}
              >
                Preview →
              </a>
            )}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.svg"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <Button
          variant="primary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload Template'}
        </Button>
      </div>
    </div>
  )
}
