import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useStudents, useCreateStudentLogin, useResetStudentPassword } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/shared/Avatar'
import { useToast } from '../../components/ui/Toast'
import { generateTempPassword } from '../../lib/passwords'
import type { ParentAccount, Student } from '../../types/app'

// suppress unused ref warning — useRef used for timer cleanup
void useRef

// ── useParentAccounts ─────────────────────────────────────────
function useParentAccounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-accounts', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, school_id, email, full_name, phone, auth_user_id, temp_password, student_ids, created_by, created_at')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map(r => ({
        id:           r.id as string,
        schoolId:     r.school_id as string,
        email:        r.email as string,
        studentIds:   (r.student_ids as string[]) ?? [],
        createdBy:    r.created_by as string,
        createdAt:    r.created_at as string,
        fullName:     (r.full_name as string) ?? null,
        phone:        (r.phone as string) ?? null,
        authUserId:   (r.auth_user_id as string) ?? null,
        tempPassword: (r.temp_password as string) ?? null,
      } satisfies ParentAccount))
    },
  })
}

// ── useCreateParentAccount ────────────────────────────────────
function useCreateParentAccount() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      fullName:     string
      email:        string
      phone:        string | null
      studentIds:   string[]
      tempPassword: string
    }) => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .insert({
          school_id:     user!.schoolId,
          email:         input.email,
          full_name:     input.fullName,
          phone:         input.phone,
          temp_password: input.tempPassword,
          student_ids:   input.studentIds,
          created_by:    user!.staffId ?? user!.id,
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-accounts'] })
    },
  })
}

// ── CopyButton ────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: copied ? 'rgba(16,185,129,0.1)' : 'transparent',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
        borderRadius: 7, padding: '5px 12px',
        fontSize: 11, fontWeight: 700,
        color: copied ? 'var(--success)' : 'var(--txt2)',
        cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
        fontFamily: 'var(--font2)',
      }}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── CredFieldRow ──────────────────────────────────────────────
function CredFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 800, color: 'var(--txt3)',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        fontFamily: 'var(--font2)', marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '9px 12px',
      }}>
        <span style={{
          flex: 1, fontFamily: 'var(--font3)', fontSize: 12.5,
          color: 'var(--txt)', wordBreak: 'break-all',
        }}>
          {value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ── Guardian type ─────────────────────────────────────────────
type Guardian = {
  id:           string
  full_name:    string | null
  relationship: string | null
  email:        string | null
  phone:        string | null
  is_primary:   boolean
}

type GeneratedResult = {
  guardianName: string
  email:        string
  tempPassword: string
}

// ── GenerateAccessModal ───────────────────────────────────────
function GenerateAccessModal({
  student,
  onClose,
}: {
  student: Student
  onClose: () => void
}) {
  const { error: showErr } = useToast()
  const { user } = useAuth()
  const createMutation = useCreateParentAccount()
  const portalUrl = `${window.location.origin}/parent/portal`
  const qc = useQueryClient()

  // emails typed by secretary for guardians missing one
  const [emailInputs, setEmailInputs] = useState<Record<string, string>>({})
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [results,     setResults]     = useState<GeneratedResult[]>([])
  const [busy,        setBusy]        = useState(false)

  // Load guardians from student_guardians
  const { data: guardians = [], isLoading: loadingGuardians } = useQuery({
    queryKey: ['student-guardians-modal', student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_guardians')
        .select('id, full_name, relationship, email, phone, is_primary, do_not_contact')
        .eq('student_id', student.id)
        .eq('school_id', user!.schoolId)
        .eq('do_not_contact', false)
        .order('is_primary', { ascending: false })
      if (error) throw error
      return (data ?? []) as Guardian[]
    },
  })

  // Pre-select all guardians once loaded
  useEffect(() => {
    if (guardians.length > 0) {
      setSelected(new Set(guardians.map(g => g.id)))
    }
  }, [guardians])

  function toggleGuardian(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleGenerate() {
    const targets = guardians.filter(g => selected.has(g.id))
    if (targets.length === 0) return

    // Validate: all selected must have an email
    for (const g of targets) {
      const email = g.email?.trim() || emailInputs[g.id]?.trim()
      if (!email || !email.includes('@')) {
        showErr(`Enter a valid email for ${g.full_name ?? 'guardian'}`)
        return
      }
    }

    setBusy(true)
    const generated: GeneratedResult[] = []

    try {
      for (const g of targets) {
        const email  = (g.email?.trim() || emailInputs[g.id]?.trim() || '').toLowerCase()
        const pw     = generateTempPassword()
        const name   = g.full_name ?? 'Guardian'

        // Check if a parent_account already exists for this email
        const { data: existing } = await supabase
          .from('parent_accounts')
          .select('id, student_ids')
          .eq('school_id', user!.schoolId)
          .eq('email', email)
          .maybeSingle()

        let parentAccountId: string

        if (existing) {
          // Add this student to the existing account if not already linked
          const ids = (existing.student_ids as string[]) ?? []
          if (!ids.includes(student.id)) {
            const { error: linkErr } = await supabase.from('parent_accounts')
              .update({ student_ids: [...ids, student.id] })
              .eq('id', existing.id)
              .eq('school_id', user!.schoolId)
            if (linkErr) throw new Error(`Failed to link student to parent: ${linkErr.message}`)
          }
          parentAccountId = existing.id
        } else {
          parentAccountId = await createMutation.mutateAsync({
            fullName:     name,
            email,
            phone:        g.phone ?? null,
            studentIds:   [student.id],
            tempPassword: pw,
          })
        }

        // Create / link auth user
        const { data: fnData, error: fnError } = await supabase.functions.invoke('create-parent-auth-user', {
          body: { parentAccountId, email, schoolId: user!.schoolId, password: pw },
        })

        if (fnError) {
          const detail = (fnData as { error?: string } | null)?.error ?? fnError.message
          throw new Error(`Failed to activate login for ${name}: ${detail}`)
        }

        generated.push({ guardianName: name, email, tempPassword: pw })
      }

      qc.invalidateQueries({ queryKey: ['parent-accounts'] })
      setResults(generated)
    } catch (err) {
      showErr(err instanceof Error ? err.message : 'Failed to create parent access')
    } finally {
      setBusy(false)
    }
  }

  const done = results.length > 0

  return (
    <Modal open onClose={onClose} title={done ? 'Access Generated' : 'Generate Parent Access'} size="md">
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Success header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'linear-gradient(135deg,rgba(16,185,129,.1),rgba(13,148,136,.06))', border: '1px solid rgba(16,185,129,.25)', borderRadius: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--success)' }}>
                {results.length === 1 ? '1 account created' : `${results.length} accounts created`} for {student.firstName} {student.lastName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>Active immediately — share credentials below</div>
            </div>
          </div>

          {/* One credential card per guardian */}
          {results.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--txt2)' }}>
                {r.guardianName}
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CredFieldRow label="Login Email"        value={r.email} />
                <CredFieldRow label="Temporary Password" value={r.tempPassword} />
              </div>
            </div>
          ))}

          <CredFieldRow label="Portal URL" value={portalUrl} />
          <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>Done</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Student chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),var(--brand-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, color: '#fff', flexShrink: 0 }}>
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{student.firstName} {student.lastName}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{student.admissionNumber}</div>
            </div>
          </div>

          {/* Guardians list */}
          {loadingGuardians ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Loading guardians…</div>
          ) : guardians.length === 0 ? (
            <div style={{ padding: '14px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.6 }}>
              No guardians on file for this student. Add them first via the student registration/edit page, then generate access here.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>
                Select guardians to generate access for
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {guardians.map(g => {
                  const isSel  = selected.has(g.id)
                  const needsEmail = !g.email?.trim()
                  return (
                    <div
                      key={g.id}
                      style={{ border: `1px solid ${isSel ? 'rgba(13,148,136,.35)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden', background: isSel ? 'rgba(13,148,136,.03)' : 'var(--surface)', transition: 'all .15s' }}
                    >
                      {/* Guardian header row */}
                      <div
                        onClick={() => toggleGuardian(g.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer' }}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSel ? 'var(--brand)' : 'var(--border)'}`, background: isSel ? 'var(--brand)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                          {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--violet),var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#fff', flexShrink: 0 }}>
                          {(g.full_name ?? 'G').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                            {g.full_name ?? 'Unknown'}
                            {g.is_primary && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: 'rgba(13,148,136,.12)', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: .4 }}>Primary</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                            {g.relationship ?? 'Guardian'}{g.phone ? ` · ${g.phone}` : ''}
                          </div>
                          {g.email && <div style={{ fontSize: 11, color: 'var(--brand)', fontFamily: 'var(--font3)', marginTop: 1 }}>{g.email}</div>}
                        </div>
                      </div>

                      {/* Email input if guardian has no email */}
                      {isSel && needsEmail && (
                        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>Email address required *</label>
                          <input
                            className="sui-input"
                            type="email"
                            placeholder="guardian@email.com"
                            value={emailInputs[g.id] ?? ''}
                            onChange={e => setEmailInputs(prev => ({ ...prev, [g.id]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '100%' }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div style={{ padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 11.5, color: 'var(--txt3)' }}>
            A temporary password is generated for each guardian automatically.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={selected.size === 0 || guardians.length === 0}
              onClick={() => { void handleGenerate() }}
            >
              Generate Access {selected.size > 1 ? `(${selected.size})` : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── ViewCredentialsModal ──────────────────────────────────────
const UNLOCK_DURATION_MS = 5 * 60 * 1000

function ViewCredentialsModal({
  account,
  onClose,
}: {
  account: ParentAccount
  onClose: () => void
}) {
  const [step,     setStep]     = useState<'auth' | 'show'>('auth')
  const [password, setPassword] = useState('')
  const [authErr,  setAuthErr]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(UNLOCK_DURATION_MS)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { user } = useAuth()
  const portalUrl = `${window.location.origin}/parent/portal`

  useEffect(() => {
    if (step !== 'show') return
    setTimeLeft(UNLOCK_DURATION_MS)

    lockTimerRef.current = setTimeout(() => {
      setStep('auth'); setRevealed(new Set()); setPassword('')
    }, UNLOCK_DURATION_MS)

    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1000))
    }, 1000)

    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [step])

  async function handleReAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!password) { setAuthErr('Enter your password'); return }
    setLoading(true); setAuthErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: user!.email, password })
    setLoading(false)
    if (error) setAuthErr('Incorrect password. Try again.')
    else setStep('show')
  }

  function toggleReveal(label: string) {
    setRevealed(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label); else next.add(label)
      return next
    })
  }

  const minutesLeft = Math.floor(timeLeft / 60000)
  const secondsLeft = Math.floor((timeLeft % 60000) / 1000)

  const credentials = [
    { label: 'Login Email',        value: account.email },
    { label: 'Temporary Password', value: account.tempPassword ?? '(not stored)' },
    { label: 'Portal URL',         value: portalUrl },
  ]

  return (
    <Modal open onClose={onClose} title="View Parent Credentials" size="sm">
      {step === 'auth' ? (
        <form onSubmit={handleReAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '12px 14px',
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
              Re-enter your password to unlock this parent's credentials. They will auto-hide after 5 minutes.
            </p>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 5 }}>Your Password</label>
            <input
              className="sui-input"
              type="password"
              placeholder="Enter your login password"
              value={password}
              onChange={e => { setPassword(e.target.value); setAuthErr('') }}
              autoFocus
              style={{ width: '100%', borderColor: authErr ? 'var(--danger)' : undefined }}
            />
            {authErr && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{authErr}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Confirm</Button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
              {account.fullName ?? account.email}
            </div>
            <div style={{
              fontSize: 11, fontFamily: 'var(--font3)',
              color: timeLeft < 60000 ? 'var(--danger)' : 'var(--txt3)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Locks in {minutesLeft}:{String(secondsLeft).padStart(2, '0')}
            </div>
          </div>

          {credentials.map(({ label, value }) => {
            const isRevealed  = revealed.has(label)
            const isSensitive = label !== 'Portal URL'
            return (
              <div key={label}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--font2)', marginBottom: 5 }}>
                  {label}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px',
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
                }}>
                  <span
                    style={{
                      flex: 1, fontFamily: 'var(--font3)', fontSize: 12.5, color: 'var(--txt)',
                      wordBreak: 'break-all',
                      filter: isSensitive && !isRevealed ? 'blur(5px)' : 'none',
                      userSelect: isSensitive && !isRevealed ? 'none' : 'auto',
                      transition: 'filter 0.2s',
                      cursor: isSensitive ? 'pointer' : 'default',
                    }}
                    onClick={() => isSensitive && toggleReveal(label)}
                  >
                    {value}
                  </span>
                  {isSensitive && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(label)}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', cursor: 'pointer' }}
                    >
                      {isRevealed
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  )}
                  {(isRevealed || !isSensitive) && <CopyButton text={value} />}
                </div>
                {isSensitive && !isRevealed && (
                  <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 3 }}>Click to reveal</div>
                )}
              </div>
            )
          })}

          <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>Close</Button>
        </div>
      )}
    </Modal>
  )
}

// ── StatChip ──────────────────────────────────────────────────
function StatChip({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.15)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: 12, padding: '10px 16px',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1, fontFamily: 'var(--font2)' }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// ── EmptySelect ───────────────────────────────────────────────
function EmptySelect() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '4rem 2rem', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'linear-gradient(135deg, rgba(13,148,136,0.1), rgba(14,165,233,0.07))',
        border: '1px solid rgba(13,148,136,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>
          Select a student
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
          Pick a student from the list to generate or view their parent portal access.
        </div>
      </div>
    </div>
  )
}

// ── StudentLoginSection ───────────────────────────────────────
// ── Credential row ────────────────────────────────────────────
function CredRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(value)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px' }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12.5, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{value}</div>
      </div>
      <button onClick={copy}
        style={{ background: copied ? 'rgba(16,185,129,0.1)' : 'var(--surface)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: copied ? 'var(--success)' : 'var(--txt2)', cursor: 'pointer', transition: 'all 0.15s' }}>
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  )
}

function StudentLoginSection({ student }: { student: Student }) {
  const [newCreds, setNewCreds] = useState<{ email: string; tempPassword: string; isReset: boolean } | null>(null)
  const [showReset, setShowReset] = useState(false)
  const { error: showErr, success: showOk } = useToast()
  const { user } = useAuth()
  const createLogin = useCreateStudentLogin()
  const resetPassword = useResetStudentPassword()

  // Fetch school short_name to reconstruct the student email
  const { data: school } = useQuery({
    queryKey: ['school-short-name', user?.schoolId],
    enabled: !!user?.schoolId,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('school_profile').select('short_name').eq('id', user!.schoolId).single()
      return (data?.short_name as string | null) ?? 'school'
    },
  })

  function computeEmail() {
    const shortName  = (school ?? 'school').toLowerCase().replace(/[^a-z0-9]/g, '')
    const firstInit  = (student.firstName[0] ?? '').toLowerCase()
    const lastInit   = (student.lastName[0] ?? '').toLowerCase()
    const admSeq     = student.admissionNumber.replace(/\D/g, '').slice(-4).replace(/^0+(?=\d)/, '') || '1'
    return `${firstInit}${lastInit}${admSeq}@${shortName}.ug`
  }

  async function handleCreate() {
    try {
      const r = await createLogin.mutateAsync(student.id)
      setNewCreds({ email: r.email, tempPassword: r.tempPassword, isReset: false })
      showOk('Student login created')
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Failed to create login')
    }
  }

  async function handleReset() {
    if (!student.authUserId) return
    const email = student.authEmail ?? computeEmail()
    try {
      const r = await resetPassword.mutateAsync({
        studentId:       student.id,
        authUserId:      student.authUserId,
        email,
        name:            `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
      })
      setNewCreds({ email: r.email, tempPassword: r.tempPassword, isReset: true })
      setShowReset(false)
      showOk('Password reset — give the new credentials to the student')
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Failed to reset password')
    }
  }

  // Active account view
  if (student.authUserId && !newCreds) {
    const email = student.authEmail ?? computeEmail()
    return (
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'var(--font2)' }}>
          Student Portal Login
        </div>
        {/* Active badge + email */}
        <div style={{ borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font2)' }}>Login active</span>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <CredRow label="Login Email" value={email} />
          </div>
        </div>

        {/* Reset section */}
        {!showReset ? (
          <button onClick={() => setShowReset(true)}
            style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Student Forgot Password / Reset
          </button>
        ) : (
          <div style={{ borderRadius: 12, border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.04)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>
              This will generate a new temporary password. The old password will stop working immediately.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowReset(false)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { void handleReset() }} disabled={resetPassword.isPending}
                style={{ flex: 2, padding: '8px 0', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: resetPassword.isPending ? 0.7 : 1 }}>
                {resetPassword.isPending ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Show newly created/reset credentials
  if (newCreds) {
    const accent = newCreds.isReset ? '#f59e0b' : '#8b5cf6'
    return (
      <div style={{ marginTop: 4, borderRadius: 12, border: `1px solid ${accent}30`, background: `${accent}06`, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${accent}18`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: accent, fontFamily: 'var(--font2)' }}>
            {newCreds.isReset ? 'Password Reset' : 'Login Created'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--warning)', fontWeight: 700 }}>Save these now</span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CredRow label="Login Email"        value={newCreds.email} />
          <CredRow label="Temporary Password" value={newCreds.tempPassword} />
          <div style={{ fontSize: 10.5, color: 'var(--txt3)', textAlign: 'center', lineHeight: 1.5 }}>
            Password is shown once. Student must change it after first login.
          </div>
          <button onClick={() => setNewCreds(null)}
            style={{ width: '100%', padding: '8px 0', borderRadius: 9, border: 'none', background: `${accent}18`, color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    )
  }

  // No login yet
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, fontFamily: 'var(--font2)' }}>
        Student Portal Login
      </div>
      <button onClick={() => { void handleCreate() }} disabled={createLogin.isPending}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(139,92,246,0.35)', background: 'rgba(139,92,246,0.07)', color: 'var(--violet)', fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font2)', cursor: createLogin.isPending ? 'wait' : 'pointer', opacity: createLogin.isPending ? 0.7 : 1, transition: 'all 0.15s' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        {createLogin.isPending ? 'Creating…' : 'Create Student Login'}
      </button>
      <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 5, textAlign: 'center' }}>
        Auto-generates email · shown once after creation
      </div>
    </div>
  )
}

// ── RightPanel ────────────────────────────────────────────────
function RightPanel({
  student,
  account,
  classLabel,
  onGenerate,
  onViewCreds,
}: {
  student:     Student | null
  account:     ParentAccount | null
  classLabel:  string
  onGenerate:  () => void
  onViewCreds: () => void
}) {
  if (!student) return <EmptySelect />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Student info header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '18px 20px',
        background: 'linear-gradient(135deg, rgba(13,148,136,0.06), rgba(14,165,233,0.04))',
        border: '1px solid rgba(13,148,136,0.15)',
        borderRadius: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: '#fff',
          boxShadow: '0 4px 14px rgba(13,148,136,0.35)',
        }}>
          {student.firstName[0]}{student.lastName[0]}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)' }}>
            {student.firstName} {student.lastName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font3)', color: 'var(--txt3)',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '2px 8px',
            }}>
              {student.admissionNumber}
            </span>
            {classLabel && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--brand)',
                background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
                borderRadius: 6, padding: '2px 8px',
              }}>
                {classLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {account ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 12,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font2)' }}>
                Parent account exists
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                {account.fullName ?? account.email} · Created {new Date(account.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {[
              { label: 'Login Email',  value: account.email },
              { label: 'Auth Status',  value: account.authUserId ? 'Activated' : 'Pending IT Admin activation' },
            ].map(({ label, value }, i) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px',
                borderBottom: i === 0 ? '1px solid var(--border)' : undefined,
              }}>
                <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--txt)', fontFamily: 'var(--font3)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onViewCreds}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, fontFamily: 'var(--font2)', fontWeight: 700,
                fontSize: 13, color: 'var(--txt2)', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              View Credentials
            </button>
            <button
              onClick={onGenerate}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0',
                background: 'var(--surface)', border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: 10, fontFamily: 'var(--font2)', fontWeight: 700,
                fontSize: 13, color: 'var(--warning)', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Regenerate
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '1.5rem 0' }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'rgba(13,148,136,0.08)', border: '1px dashed rgba(13,148,136,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', marginBottom: 6 }}>
              No parent access yet
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--txt3)', lineHeight: 1.6 }}>
              Generate portal credentials for {student.firstName}'s parent or guardian.
            </div>
          </div>
          <button
            onClick={onGenerate}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 28px',
              background: 'linear-gradient(135deg, var(--brand), #0ea5e9)',
              border: 'none', borderRadius: 12,
              fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: '#fff',
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(13,148,136,0.4)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Generate Parent Access
          </button>
        </div>
      )}

      <StudentLoginSection student={student} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export function ParentCredentialsPage() {
  const [search,       setSearch]       = useState('')
  const [classFilter,  setClassFilter]  = useState<string>('all')
  const [accessFilter, setAccessFilter] = useState<'all' | 'with' | 'without'>('all')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [viewCreds,    setViewCreds]    = useState<ParentAccount | null>(null)

  const { data: students = [], isLoading: studentsLoading } = useStudents({})
  const { data: classes  = [] }                             = useClasses()
  const { data: accounts = [], isLoading: accountsLoading } = useParentAccounts()

  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])

  const parentByStudentId = useMemo(() => {
    const map = new Map<string, ParentAccount>()
    for (const acc of accounts) {
      for (const sid of acc.studentIds) {
        if (!map.has(sid)) map.set(sid, acc)
      }
    }
    return map
  }, [accounts])

  const searchTerm = search.trim().toLowerCase()
  const filtered   = useMemo(() => {
    let out = students
    if (searchTerm) {
      out = out.filter(s =>
        s.firstName.toLowerCase().includes(searchTerm) ||
        s.lastName.toLowerCase().includes(searchTerm)  ||
        s.admissionNumber.toLowerCase().includes(searchTerm)
      )
    }
    if (classFilter !== 'all') out = out.filter(s => s.classId === classFilter)
    if (accessFilter === 'with')    out = out.filter(s => parentByStudentId.has(s.id))
    if (accessFilter === 'without') out = out.filter(s => !parentByStudentId.has(s.id))
    return out
  }, [students, searchTerm, classFilter, accessFilter, parentByStudentId])

  const selectedStudent = selectedId ? students.find(s => s.id === selectedId) ?? null : null
  const selectedAccount = selectedId ? (parentByStudentId.get(selectedId) ?? null) : null
  const classLabel      = selectedStudent?.classId ? (classMap.get(selectedStudent.classId) ?? '') : ''

  const isLoading   = studentsLoading || accountsLoading
  const cutoff      = Date.now() - 120 * 24 * 60 * 60 * 1000
  const newThisTerm = accounts.filter(a => new Date(a.createdAt).getTime() > cutoff).length

  const handleGenerate  = useCallback(() => setShowGenerate(true), [])
  const handleViewCreds = useCallback(() => {
    if (selectedAccount) setViewCreds(selectedAccount)
  }, [selectedAccount])

  return (
    <div className="sui-page-enter">
      {/* ── Hero Band ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        boxShadow: '0 8px 32px rgba(13,148,136,0.3)',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: '40%', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
                Parent Portal Access
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>
                Generate and manage parent login credentials
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatChip
              label="Total Accounts"
              value={accounts.length}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
            />
            <StatChip
              label="Students Linked"
              value={students.filter(s => parentByStudentId.has(s.id)).length}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
            />
            <StatChip
              label="New This Term"
              value={newThisTerm}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}
            />
          </div>
        </div>
      </div>

      {/* ── Two-Panel Layout ── */}
      <div className="mob-stack" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 360px) 1fr',
        gap: 16,
        alignItems: 'start',
      }}>
        {/* ── Left: Student List ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="sui-input" placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, width: '100%' }} />
            </div>
            {/* Access filter pills */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {([
                { key: 'all',     label: 'All' },
                { key: 'with',    label: '✓ Has Access' },
                { key: 'without', label: '○ No Access' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setAccessFilter(f.key)}
                  style={{
                    padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all .15s',
                    background: accessFilter === f.key ? 'var(--brand)' : 'var(--surface2)',
                    color:      accessFilter === f.key ? '#fff' : 'var(--txt3)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Class filter pills */}
            {classes.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setClassFilter('all')}
                  style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all .15s', background: classFilter === 'all' ? 'var(--info)' : 'var(--surface2)', color: classFilter === 'all' ? '#fff' : 'var(--txt3)' }}
                >
                  All Classes
                </button>
                {classes.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setClassFilter(c.id)}
                    style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all .15s', background: classFilter === c.id ? 'var(--info)' : 'var(--surface2)', color: classFilter === c.id ? '#fff' : 'var(--txt3)' }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div style={{ padding: '1.5rem 1rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="shule-skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 6 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
              {(search || classFilter !== 'all' || accessFilter !== 'all') ? 'No students match your filters' : 'No students registered yet'}
            </div>
          ) : (
            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {filtered.map(student => {
                const isSelected = student.id === selectedId
                const hasAccount = parentByStudentId.has(student.id)
                const cn = classMap.get(student.classId ?? '') ?? null

                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedId(student.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      background: isSelected ? 'rgba(13,148,136,0.06)' : 'transparent',
                      borderLeft: `3px solid ${isSelected ? 'var(--brand)' : 'transparent'}`,
                      borderRight: 'none', borderTop: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <Avatar
                      photoPath={student.photoUrl}
                      bucket="student-photos"
                      name={`${student.firstName} ${student.lastName}`}
                      size="sm"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: isSelected ? 'var(--brand)' : 'var(--txt)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {student.firstName} {student.lastName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                        {cn ?? '—'} · {student.admissionNumber}
                      </div>
                    </div>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: hasAccount ? 'var(--success)' : 'var(--border)',
                    }} />
                  </button>
                )
              })}
            </div>
          )}

          <div style={{
            padding: '8px 16px', borderTop: '1px solid var(--border)',
            background: 'var(--surface2)', fontSize: 11, color: 'var(--txt3)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{filtered.length} of {students.length} students</span>
            <span>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{accounts.length}</span> with access
            </span>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '24px',
          minHeight: 320,
        }}>
          <RightPanel
            student={selectedStudent}
            account={selectedAccount}
            classLabel={classLabel}
            onGenerate={handleGenerate}
            onViewCreds={handleViewCreds}
          />
        </div>
      </div>

      {showGenerate && selectedStudent && (
        <GenerateAccessModal
          student={selectedStudent}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {viewCreds && (
        <ViewCredentialsModal
          account={viewCreds}
          onClose={() => setViewCreds(null)}
        />
      )}
    </div>
  )
}
