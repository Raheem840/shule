import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useStudents, useStudentById, useCreateStudentLogin, type StudentFilters, type StudentLoginResult } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useGenerateParentAccess, type GeneratedAccess } from '../../hooks/useParentPortal'
import { useSendCredentialsSms } from '../../hooks/useStaffAuth'
import { Avatar } from '../../components/shared/Avatar'
import type { Student, StudentGuardian } from '../../types/app'

// ── Print credential slip ─────────────────────────────────────────────────────
function printCredentialSlip(params: {
  studentName: string
  admNo: string
  className: string
  email: string
  password: string
  schoolName: string
  isParent?: boolean
  guardianName?: string
}) {
  const { studentName, admNo, className, email, password, schoolName, isParent, guardianName } = params
  const loginUrl = window.location.origin
  const title = isParent ? 'Parent Portal Login Credentials' : 'Student Portal Login Credentials'
  const recipientLabel = isParent ? (guardianName ?? 'Parent/Guardian') : studentName

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .slip { width: 148mm; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,.15); }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%); padding: 24px; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: -40px; right: -40px; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,.08); }
    .header::after { content: ''; position: absolute; bottom: -20px; left: 20px; width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,.06); }
    .school-name { font-size: 13px; font-weight: 800; color: rgba(255,255,255,.9); letter-spacing: .3px; position: relative; }
    .slip-title { font-size: 20px; font-weight: 900; color: #fff; margin-top: 4px; position: relative; }
    .slip-subtitle { font-size: 11px; color: rgba(255,255,255,.7); margin-top: 3px; position: relative; }
    .body { padding: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: .5px solid #e2e8f0; }
    .info-row:last-of-type { border-bottom: none; }
    .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; }
    .info-value { font-size: 12px; font-weight: 700; color: #0f172a; }
    .divider { height: 1px; background: #e2e8f0; margin: 16px 0; }
    .cred-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px; }
    .cred-card { background: #f1f5f9; border: .5px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; }
    .cred-card code { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-all; }
    .warning { background: rgba(245,158,11,.08); border: .5px solid #f59e0b; border-radius: 10px; padding: 10px 14px; margin-top: 16px; font-size: 11px; color: #b45309; line-height: 1.5; font-weight: 600; }
    .footer { border-top: .5px solid #e2e8f0; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .sig-line { border-top: 1px solid #0f172a; padding-top: 6px; font-size: 10px; color: #475569; font-weight: 600; min-width: 100px; text-align: center; }
    .date-line { font-size: 10px; color: #94a3b8; }
    .login-url { font-size: 10px; color: #0d9488; font-weight: 600; margin-top: 8px; }
    @media print { body { background: white; } .slip { box-shadow: none; border-radius: 0; width: 100%; } }
  </style>
</head>
<body>
  <div class="slip">
    <div class="header">
      <div class="school-name">${schoolName}</div>
      <div class="slip-title">${title}</div>
      <div class="slip-subtitle">Confidential — Keep in a safe place</div>
    </div>
    <div class="body">
      <div class="info-row"><span class="info-label">${isParent ? 'Guardian' : 'Student Name'}</span><span class="info-value">${recipientLabel}</span></div>
      ${isParent ? `<div class="info-row"><span class="info-label">Student</span><span class="info-value">${studentName}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Admission No.</span><span class="info-value">${admNo}</span></div>
      <div class="info-row"><span class="info-label">Class</span><span class="info-value">${className}</span></div>
      <div class="divider"></div>
      <div class="cred-label">Login Email</div>
      <div class="cred-card"><code>${email}</code></div>
      <div class="cred-label">Temporary Password</div>
      <div class="cred-card"><code>${password}</code></div>
      <div class="login-url">Login at: ${loginUrl}</div>
      <div class="warning">&#9888; Change your password after the first login. Do not share these credentials with anyone.</div>
    </div>
    <div class="footer">
      <div class="sig-line">Secretary</div>
      <div class="date-line">${new Date().toLocaleDateString('en-UG', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>
  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=620,height=820')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ── Credential Delivery Row ───────────────────────────────────────────────────
function DeliveryOptions({
  email,
  password,
  phone,
  name,
  studentName,
  admNo,
  className,
  schoolName,
  isParent,
  guardianName,
}: {
  email: string
  password: string
  phone: string | null
  name: string
  studentName: string
  admNo: string
  className: string
  schoolName: string
  isParent?: boolean
  guardianName?: string
}) {
  const { mutateAsync: sendSms, isPending: smsPending } = useSendCredentialsSms()
  const [smsSent, setSmsSent] = useState(false)
  const [smsError, setSmsError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSms = async () => {
    if (!phone) return
    setSmsError(null)
    try {
      await sendSms({ phone, name, email, password })
      setSmsSent(true)
    } catch (e: unknown) {
      setSmsError(e instanceof Error ? e.message : 'SMS failed')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => printCredentialSlip({ studentName, admNo, className, email, password, schoolName, isParent, guardianName })}
          style={{ flex: '1 1 auto', padding: '7px 12px', borderRadius: 9, border: '.5px solid rgba(13,148,136,.35)', background: 'rgba(13,148,136,.08)', color: '#0f766e', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print Slip
        </button>
        {phone && (
          <button
            onClick={() => void handleSms()}
            disabled={smsPending || smsSent}
            style={{ flex: '1 1 auto', padding: '7px 12px', borderRadius: 9, border: '.5px solid rgba(14,165,233,.35)', background: smsSent ? 'rgba(16,185,129,.08)' : 'rgba(14,165,233,.08)', color: smsSent ? '#065f46' : '#0369a1', fontWeight: 700, fontSize: 11.5, cursor: smsPending || smsSent ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.72A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
            {smsPending ? 'Sending…' : smsSent ? 'SMS Sent!' : 'Send SMS'}
          </button>
        )}
        <button
          onClick={handleCopy}
          style={{ flex: '1 1 auto', padding: '7px 12px', borderRadius: 9, border: '.5px solid rgba(139,92,246,.35)', background: copied ? 'rgba(16,185,129,.08)' : 'rgba(139,92,246,.08)', color: copied ? '#065f46' : '#6d28d9', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          {copied ? 'Copied!' : 'Copy All'}
        </button>
      </div>
      {smsError && (
        <div style={{ fontSize: 11, color: 'var(--danger)', padding: '4px 8px', background: 'rgba(244,63,94,.06)', borderRadius: 6 }}>
          SMS error: {smsError}
        </div>
      )}
    </div>
  )
}

// ── Credential Field Card ─────────────────────────────────────────────────────
function CredField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
        <span style={{ fontFamily: 'var(--font3)', fontSize: 12.5, color: 'var(--txt)', wordBreak: 'break-all' }}>{value}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', color: copied ? '#10b981' : 'var(--brand)', padding: '0 4px', flexShrink: 0, marginLeft: 8 }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

// ── Parent Login Section ──────────────────────────────────────────────────────
function ParentLoginSection({
  guardian,
  student,
  className,
  schoolName,
}: {
  guardian: StudentGuardian
  student: Student
  className: string
  schoolName: string
}) {
  const { mutateAsync: generateParent, isPending } = useGenerateParentAccess()
  const [result, setResult] = useState<GeneratedAccess | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setError(null)
    try {
      const r = await generateParent({ id: student.id, admissionNumber: student.admissionNumber })
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: result ? 12 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{guardian.fullName}</div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
            {guardian.relationship.charAt(0).toUpperCase() + guardian.relationship.slice(1)}
            {guardian.phone ? ` · ${guardian.phone}` : ''}
          </div>
        </div>
        {!result ? (
          <button
            onClick={() => void handleGenerate()}
            disabled={isPending}
            style={{ padding: '6px 12px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {isPending ? 'Generating…' : 'Generate Access'}
          </button>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#065f46', background: 'rgba(16,185,129,.12)', border: '.5px solid #10b981', borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
            {result.isNew ? 'Created' : 'Retrieved'}
          </span>
        )}
      </div>
      {error && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 6 }}>{error}</div>
      )}
      {result && (
        <>
          <CredField label="Parent Email" value={result.email} />
          <CredField label="Password" value={result.tempPassword} />
          <DeliveryOptions
            email={result.email}
            password={result.tempPassword}
            phone={guardian.doNotContact ? null : guardian.phone}
            name={guardian.fullName}
            studentName={`${student.firstName} ${student.lastName}`}
            admNo={student.admissionNumber}
            className={className}
            schoolName={schoolName}
            isParent
            guardianName={guardian.fullName}
          />
        </>
      )}
    </div>
  )
}

// ── Credential Modal ──────────────────────────────────────────────────────────
function CredentialModal({
  student,
  classes,
  streams,
  onClose,
}: {
  student: Student
  classes: { id: string; name: string }[]
  streams: { id: string; name: string }[]
  onClose: () => void
}) {
  const { data: detail } = useStudentById(student.id)
  const { mutateAsync: createLogin, isPending: loginPending } = useCreateStudentLogin()

  const [loginResult, setLoginResult]   = useState<StudentLoginResult | null>(null)
  const [loginError,  setLoginError]    = useState<string | null>(null)
  const [schoolName,  setSchoolName]    = useState('Shule School')

  // Fetch school name for print slip (best-effort; fire once)
  useMemo(() => {
    void (async () => {
      try {
        const { supabase: sb } = await import('../../lib/supabase')
        const { data } = await sb
          .from('school_profile')
          .select('school_name')
          .limit(1)
          .single()
        if (data?.school_name) setSchoolName(data.school_name as string)
      } catch { /* ignore */ }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const className  = classes.find(c => c.id === student.classId)?.name ?? '—'
  const streamName = streams.find(s => s.id === student.streamId)?.name ?? ''
  const fullClass  = streamName ? `${className} ${streamName}` : className

  const guardians = detail?.guardians ?? []

  const handleGenerateLogin = async () => {
    setLoginError(null)
    try {
      const r = await createLogin(student.id)
      setLoginResult(r)
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : 'Failed to create login')
    }
  }

  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', borderRadius: 22, boxShadow: '0 28px 90px rgba(0,0,0,.3)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal header */}
        <div style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', padding: '20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', overflow: 'hidden', flexShrink: 0 }}>
                <Avatar photoPath={student.photoUrl} bucket="student-photos" name={`${student.firstName} ${student.lastName}`} size="md" />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: '#fff' }}>
                  {student.firstName} {student.lastName}
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>
                  {student.admissionNumber} &middot; {fullClass}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer', color: '#fff', padding: 8, borderRadius: 9, display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Section: Student Login ────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(13,148,136,.12)', border: '.5px solid rgba(13,148,136,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>Student Login</div>
            </div>

            {!loginResult ? (
              <div style={{ background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.6, marginBottom: 12 }}>
                  Generate a student portal login using this student's admission number. The student can use these credentials to access their results, timetable, and surveys.
                </div>
                {loginError && (
                  <div style={{ background: 'rgba(244,63,94,.08)', border: '.5px solid var(--danger)', borderRadius: 9, padding: '7px 12px', marginBottom: 10, fontSize: 12, color: 'var(--danger)' }}>
                    {loginError}
                  </div>
                )}
                <button
                  onClick={() => void handleGenerateLogin()}
                  disabled={loginPending}
                  style={{ width: '100%', padding: '10px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: loginPending ? 'wait' : 'pointer', boxShadow: '0 4px 16px rgba(13,148,136,.35)' }}
                >
                  {loginPending ? 'Generating…' : 'Generate Student Login'}
                </button>
              </div>
            ) : (
              <div style={{ background: loginResult.manual ? 'rgba(245,158,11,.06)' : 'rgba(16,185,129,.06)', border: `.5px solid ${loginResult.manual ? '#f59e0b' : '#10b981'}`, borderRadius: 12, padding: '14px 16px' }}>
                {loginResult.manual && (
                  <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 700, marginBottom: 10, padding: '6px 10px', background: 'rgba(245,158,11,.1)', borderRadius: 8 }}>
                    Manual mode &mdash; share these credentials with the student. The IT Admin must create the auth account.
                  </div>
                )}
                {!loginResult.manual && (
                  <div style={{ fontSize: 11.5, color: '#065f46', fontWeight: 700, marginBottom: 10, padding: '6px 10px', background: 'rgba(16,185,129,.1)', borderRadius: 8 }}>
                    Student portal account activated successfully.
                  </div>
                )}
                <CredField label="Student Email" value={loginResult.email} />
                <CredField label="Temporary Password" value={loginResult.tempPassword} />
                <div style={{ marginTop: 12 }}>
                  <DeliveryOptions
                    email={loginResult.email}
                    password={loginResult.tempPassword}
                    phone={null}
                    name={`${student.firstName} ${student.lastName}`}
                    studentName={`${student.firstName} ${student.lastName}`}
                    admNo={student.admissionNumber}
                    className={fullClass}
                    schoolName={schoolName}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Section: Parent Login ─────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(14,165,233,.12)', border: '.5px solid rgba(14,165,233,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>Parent / Guardian Login</div>
            </div>

            {guardians.length === 0 ? (
              <div style={{ background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center' }}>
                {detail ? 'No guardians registered for this student.' : 'Loading guardian info…'}
              </div>
            ) : (
              guardians.map(g => (
                <ParentLoginSection
                  key={g.id}
                  guardian={g}
                  student={student}
                  className={fullClass}
                  schoolName={schoolName}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '.5px solid var(--border)', padding: '14px 24px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 11, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const statusConfig: Record<Student['status'], { bg: string; color: string; dot: string }> = {
  active:    { bg: 'rgba(16,185,129,.12)',  color: '#065f46', dot: '#10b981' },
  suspended: { bg: 'rgba(245,158,11,.12)', color: '#92400e', dot: '#f59e0b' },
  expelled:  { bg: 'rgba(244,63,94,.12)',  color: '#9f1239', dot: '#f43f5e' },
}

const LEVEL_COLORS: Record<number, { bg: string; border: string; text: string; accent: string }> = {
  1: { bg: 'rgba(13,148,136,.10)',  border: 'rgba(13,148,136,.25)',  text: '#0f766e', accent: '#0d9488' },
  2: { bg: 'rgba(14,165,233,.10)', border: 'rgba(14,165,233,.25)', text: '#0369a1', accent: '#0ea5e9' },
  3: { bg: 'rgba(139,92,246,.10)', border: 'rgba(139,92,246,.25)', text: '#6d28d9', accent: '#8b5cf6' },
  4: { bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.25)', text: '#b45309', accent: '#f59e0b' },
  5: { bg: 'rgba(244,63,94,.10)',  border: 'rgba(244,63,94,.25)',  text: '#be123c', accent: '#f43f5e' },
  6: { bg: 'rgba(16,185,129,.10)', border: 'rgba(16,185,129,.25)', text: '#065f46', accent: '#10b981' },
}

// ── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({ student, classes, streams, onView, onCredentials }: {
  student: Student
  classes: { id: string; name: string; level: string | null }[]
  streams: { id: string; name: string }[]
  onView: (s: Student) => void
  onCredentials: (s: Student) => void
}) {
  const [hovered, setHovered] = useState(false)
  const cls          = classes.find(c => c.id === student.classId)
  const className    = cls?.name ?? null
  const streamName   = streams.find(s => s.id === student.streamId)?.name ?? null
  const levelNum     = cls?.level ? parseInt(cls.level, 10) : null
  const lvl          = levelNum ? (LEVEL_COLORS[levelNum] ?? null) : null
  const sc           = statusConfig[student.status]
  const accentColor  = lvl?.accent ?? '#0d9488'
  const accentText   = lvl?.text   ?? '#0f766e'
  const hasLogin     = !!student.authUserId

  return (
    <div
      style={{
        borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)',
        overflow: 'hidden',
        transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,.10)' : '0 1px 6px rgba(0,0,0,.06)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Class-level accent strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentText})` }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `linear-gradient(135deg, ${accentColor}, ${accentText})`, padding: 2.5,
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)' }}>
                <Avatar photoPath={student.photoUrl} bucket="student-photos" name={`${student.firstName} ${student.lastName}`} size="md" />
              </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 13, lineHeight: 1.3 }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 1 }}>
              {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'}
              {student.dob ? ` · ${new Date(student.dob).getFullYear()}` : ''}
            </div>
            </div>
            {/* Login dot */}
            <div style={{
              position: 'absolute', bottom: 1, right: 1,
              width: 12, height: 12, borderRadius: '50%',
              background: hasLogin ? 'var(--success)' : sc.dot,
              border: '2px solid var(--surface)',
            }} />
          </div>

          {/* Name + badges */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, marginBottom: 5 }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {className && (
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4, color: accentColor, background: `${accentColor}18`, padding: '2px 8px', borderRadius: 99 }}>
                  {className}
                </span>
              )}
              <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, background: sc.bg, padding: '2px 7px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: sc.dot }} />
                {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
            <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', letterSpacing: .3 }}>{student.admissionNumber}</span>
          </div>
          {streamName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{streamName}</span>
            </div>
          )}
          {(student.gender || student.dob) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
              <span style={{ fontSize: 11.5, color: 'var(--txt3)', textTransform: 'capitalize' }}>
                {[student.gender, student.dob ? new Date(student.dob).getFullYear().toString() : null].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onView(student)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '.5px solid rgba(14,165,233,.3)', background: 'rgba(14,165,233,.08)', color: '#0369a1', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,165,233,.08)' }}
          >
            View
          </button>
          <button
            onClick={() => onCredentials(student)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '.5px solid rgba(139,92,246,.3)', background: 'rgba(139,92,246,.08)', color: '#6d28d9', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,.08)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Credentials
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <span className="shule-skeleton" style={{ display: 'block', height: 4 }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <span className="shule-skeleton" style={{ display: 'block', width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span className="shule-skeleton" style={{ display: 'block', height: 13, width: '75%', borderRadius: 6, marginBottom: 8 }} />
            <span className="shule-skeleton" style={{ display: 'block', height: 18, width: '50%', borderRadius: 99 }} />
          </div>
        </div>
        <span className="shule-skeleton" style={{ display: 'block', height: 11, width: '60%', borderRadius: 4, marginBottom: 6 }} />
        <span className="shule-skeleton" style={{ display: 'block', height: 11, width: '40%', borderRadius: 4, marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="shule-skeleton" style={{ flex: 1, display: 'block', height: 34, borderRadius: 10 }} />
          <span className="shule-skeleton" style={{ flex: 1, display: 'block', height: 34, borderRadius: 10 }} />
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ isFiltered, onRegister }: { isFiltered: boolean; onRegister: () => void }) {
  return (
    <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface2)', border: '.5px solid var(--border)',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', textAlign: 'center' }}>
          {isFiltered ? 'No students match your filters' : 'No students yet'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', marginTop: 5 }}>
          {isFiltered ? 'Try adjusting your search or clearing filters.' : 'Register the first student to get started.'}
        </div>
      </div>
      {!isFiltered && (
        <button
          onClick={onRegister}
          style={{
            marginTop: 6, padding: '10px 22px', borderRadius: 11, border: 'none',
            background: 'linear-gradient(135deg, #0d9488, #0ea5e9)',
            color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(13,148,136,.35)',
          }}
        >
          Register First Student
        </button>
      )}
    </div>
  )
}

// ── Props & Main Page ─────────────────────────────────────────────────────────
interface Props { onRegister: () => void; onImport: () => void; onView: (student: Student) => void }

export function StudentsPage({ onRegister, onImport, onView }: Props) {
  const [search,      setSearch]      = useState('')
  const [classId,     setClassId]     = useState('')
  const [streamId,    setStreamId]    = useState('')
  const [status,      setStatus]      = useState('')
  const [credStudent, setCredStudent] = useState<Student | null>(null)

  const filters: StudentFilters = useMemo(() => ({
    ...(classId  ? { classId }  : {}),
    ...(streamId ? { streamId } : {}),
    ...(status   ? { status: status as Student['status'] } : {}),
    ...(search   ? { search } : {}),
  }), [classId, streamId, status, search])

  const { data: students = [], isLoading } = useStudents(filters)
  const { data: classes  = [] }            = useClasses()
  const { data: streams  = [] }            = useStreams(classId || undefined)

  const handleClassChange = useCallback((v: string) => { setClassId(v); setStreamId('') }, [])

  const isFiltered = !!(search || classId || streamId || status)

  const totalStudents = students.length
  const activeCount   = students.filter(s => s.status === 'active').length
  const dayCount      = students.filter(s => s.studentType === 'day').length
  const boarderCount  = students.filter(s => s.studentType === 'boarder').length

  const selStyle: React.CSSProperties = {
    padding: '7px 30px 7px 12px', fontSize: 12.5,
    background: 'var(--surface2)', border: '.5px solid var(--border)',
    borderRadius: 10, color: 'var(--txt2)', appearance: 'none', outline: 'none',
    fontFamily: 'var(--font2)', cursor: 'pointer',
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Band ─────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)',
        padding: '28px 28px 24px',
        position: 'relative',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 200, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
          {/* Left: title + stats */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.18)',
                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>
                Students
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
              {isLoading ? 'Loading enrollment data…' : 'Enrolled student roster'}
            </p>

            {/* Stat chips */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total', value: isLoading ? '—' : totalStudents },
                { label: 'Active', value: isLoading ? '—' : activeCount },
                { label: 'Day Scholars', value: isLoading ? '—' : dayCount },
                { label: 'Boarders', value: isLoading ? '—' : boarderCount },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)',
                  border: '.5px solid rgba(255,255,255,.25)', borderRadius: 12,
                  padding: '10px 16px', minWidth: 80,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.7)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            <button
              onClick={onImport}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11,
                border: '1.5px solid rgba(255,255,255,.55)', background: 'rgba(255,255,255,.12)',
                backdropFilter: 'blur(8px)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.12)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import Excel
            </button>
            <button
              onClick={onRegister}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 11,
                border: 'none', background: '#fff', color: '#0f766e',
                fontWeight: 800, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(0,0,0,.18)',
                transition: 'box-shadow 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.22)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,.18)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              Register Student
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface2)', border: '.5px solid var(--border)',
          borderRadius: 10, padding: '0 12px', height: 36, flex: '1 1 200px', minWidth: 180,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or admission no…"
            style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', flex: 1 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* Class / Stream / Status selects */}
        {[
          {
            value: classId, fn: handleClassChange,
            opts: [{ value: '', label: 'All Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))],
          },
          {
            value: streamId, fn: setStreamId,
            opts: [{ value: '', label: 'All Streams' }, ...streams.filter(s => !classId || s.classId === classId).map(s => ({ value: s.id, label: s.name }))],
          },
          {
            value: status, fn: setStatus,
            opts: [
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'expelled', label: 'Expelled' },
            ],
          },
        ].map((f, i) => (
          <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
            <select value={f.value} onChange={e => f.fn(e.target.value)} style={selStyle}>
              {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5"
              style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        ))}

        {isFiltered && (
          <button
            onClick={() => { setSearch(''); setClassId(''); setStreamId(''); setStatus('') }}
            style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', padding: '0 4px', flexShrink: 0 }}
          >
            Clear filters
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--txt3)', flexShrink: 0, fontFamily: 'var(--font2)' }}>
          {isLoading ? '…' : `${students.length} result${students.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Card Grid ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : students.length === 0 ? (
        <EmptyState isFiltered={isFiltered} onRegister={onRegister} />
      ) : (
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {students.map(s => (
            <StudentCard
              key={s.id}
              student={s}
              classes={classes}
              streams={streams}
              onView={onView}
              onCredentials={setCredStudent}
            />
          ))}
        </div>
      )}

      {/* invisible, was table: */}
      {false && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  {[].map(h => <th key={h as string}>{h}</th>)}
                </tr>
              </thead>
            </table>
          </div>
        )}

      {credStudent && (
        <CredentialModal
          student={credStudent}
          classes={classes}
          streams={streams}
          onClose={() => setCredStudent(null)}
        />
      )}
    </div>
  )
}
