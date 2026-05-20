import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useStudents } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import type { ParentAccount, Student } from '../../types/app'

type AnyRow = Record<string, unknown>

// ── Temp password generator ───────────────────────────────────
// Uses unambiguous characters only (no I, l, O, 0, 1)
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  const arr = new Uint8Array(10)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 10; i++) pw += chars[arr[i] % chars.length]
  return pw
}

// ── useParentAccounts ─────────────────────────────────────────
// Fetches all parent accounts including temp_password.
// temp_password is only shown to Secretary after password re-auth.
function useParentAccounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-accounts', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, school_id, email, phone, full_name, student_ids, auth_user_id, temp_password, created_by, created_at')
        .eq('school_id', user!.schoolId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map(r => ({
        id:          r.id as string,
        schoolId:    r.school_id as string,
        email:       r.email as string,
        phone:       (r.phone as string) ?? null,
        fullName:    r.full_name as string,
        studentIds:  (r.student_ids as string[]) ?? [],
        authUserId:  (r.auth_user_id as string) ?? null,
        tempPassword:(r.temp_password as string) ?? null,
        createdBy:   r.created_by as string,
        createdAt:   r.created_at as string,
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
      fullName:    string
      email:       string
      phone:       string | null
      studentIds:  string[]
      tempPassword: string
    }) => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .insert({
          school_id:    user!.schoolId,
          full_name:    input.fullName,
          email:        input.email,
          phone:        input.phone,
          student_ids:  input.studentIds,
          // Stored as plain text — acceptable for a local LAN system where
          // the Secretary workflow is the only way this value is created.
          // TODO Week 8: after Edge Function creates the real Supabase Auth user,
          // clear temp_password from this row — it should not persist after first login.
          // UPDATE parent_accounts SET temp_password = NULL WHERE id = parentAccountId
          temp_password: input.tempPassword,
          created_by:   user!.id,
          // TODO Week 8: create Supabase Auth user via Edge Function (do NOT use Admin API from frontend)
          // supabase.functions.invoke('create-parent-auth-user', {
          //   body: { parentAccountId, email, tempPassword }
          // })
          // Edge Function sets auth_user_id on this row, then clears temp_password.
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

// ── Copy button ───────────────────────────────────────────────
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
      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: copied ? 'var(--success)' : 'var(--txt2)', cursor: 'pointer', fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', flexShrink: 0 }}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── Generate Access Modal ─────────────────────────────────────
function GenerateAccessModal({
  student,
  onClose,
}: {
  student: Student
  onClose: () => void
}) {
  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [done,      setDone]      = useState(false)
  const [tempPw,    setTempPw]    = useState('')
  const [emailErr,  setEmailErr]  = useState('')

  const { error: err } = useToast()
  const createMutation = useCreateParentAccount()

  const portalUrl = `${window.location.origin}/parent/portal`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) { setEmailErr('Enter a valid email address'); return }
    setEmailErr('')

    const pw = generateTempPassword()
    createMutation.mutate({
      fullName:     fullName.trim(),
      email:        email.trim().toLowerCase(),
      phone:        phone.trim() || null,
      studentIds:   [student.id],
      tempPassword: pw,
    }, {
      onSuccess: () => { setTempPw(pw); setDone(true) },
      onError:   e  => err(e.message),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={done ? 'Access Generated' : 'Generate Parent Access'}
      size="md"
    >
      {done ? (
        // ── Success screen ────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.85rem 1rem', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--r-lg)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>
                Account created for {student.firstName} {student.lastName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                Share these credentials with the parent/guardian
              </div>
            </div>
          </div>

          {[
            { label: 'Login Email',       value: email.trim().toLowerCase() },
            { label: 'Temporary Password', value: tempPw },
            { label: 'Portal URL',         value: portalUrl },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: 'var(--font2)', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.85rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)', wordBreak: 'break-all' }}>
                <span style={{ flex: 1 }}>{value}</span>
                <CopyButton text={value} />
              </div>
            </div>
          ))}

          <div style={{ padding: '0.75rem 1rem', background: 'var(--info-bg)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--txt2)' }}>
            The parent cannot log in yet. IT Admin must activate the account in Week 8.
          </div>

          <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>Done</Button>
        </div>
      ) : (
        // ── Create form ───────────────────────────────────────
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Student info header */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-light)', border: '1.5px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 12, color: 'var(--brand)', flexShrink: 0 }}>
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>
                {student.firstName} {student.lastName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                {student.admissionNumber}
              </div>
            </div>
          </div>

          <Input
            label="Parent / Guardian Full Name *"
            placeholder="e.g. Nakato Sarah"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
          />

          <Input
            label="Email Address *"
            type="email"
            placeholder="parent@email.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setEmailErr('') }}
            error={emailErr}
            helper="This becomes their login — must be unique"
            required
          />

          <Input
            label="Phone (optional)"
            type="tel"
            placeholder="+256 700 000 000"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />

          <div style={{ padding: '0.6rem 0.85rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--txt3)' }}>
            A temporary password will be generated automatically. The parent logs in with it after IT Admin activates the account.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: 4 }}>
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              loading={createMutation.isPending}
              disabled={!fullName.trim() || !email.trim()}
            >
              Generate Access
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// ── View Credentials Modal ────────────────────────────────────
// Step 1: Secretary re-enters password.
// Step 2: Credentials shown after successful re-auth.
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

  const { user } = useAuth()
  const portalUrl = `${window.location.origin}/parent/portal`

  async function handleReAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!password) { setAuthErr('Enter your password'); return }
    setLoading(true)
    setAuthErr('')

    const { error } = await supabase.auth.signInWithPassword({
      email:    user!.email,
      password,
    })

    setLoading(false)
    if (error) {
      setAuthErr('Incorrect password. Try again.')
    } else {
      setStep('show')
    }
  }

  return (
    <Modal open onClose={onClose} title="View Parent Credentials" size="sm">
      {step === 'auth' ? (
        // ── Password confirmation ─────────────────────────────
        <form onSubmit={handleReAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--r)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
              Re-enter your password to reveal this parent's credentials.
            </p>
          </div>

          <Input
            label="Your Password"
            type="password"
            placeholder="Enter your login password"
            value={password}
            onChange={e => { setPassword(e.target.value); setAuthErr('') }}
            error={authErr}
            autoFocus
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>
              Confirm
            </Button>
          </div>
        </form>
      ) : (
        // ── Credentials display ───────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 2 }}>
            {account.fullName}
          </div>

          {[
            { label: 'Login Email',        value: account.email },
            { label: 'Temporary Password', value: account.tempPassword ?? '(not set — contact IT Admin)' },
            { label: 'Portal URL',          value: portalUrl },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: 'var(--font2)', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.85rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
                <span style={{ flex: 1, fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)', wordBreak: 'break-all' }}>{value}</span>
                {account.tempPassword || label !== 'Temporary Password' ? (
                  <CopyButton text={value} />
                ) : null}
              </div>
            </div>
          ))}

          <div style={{ padding: '0.6rem 0.85rem', background: 'var(--info-bg)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--txt2)' }}>
            The parent can only log in after IT Admin activates the account.
          </div>

          <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>Close</Button>
        </div>
      )}
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function ParentCredentialsPage() {
  const [search,             setSearch]             = useState('')
  const [generateStudentId,  setGenerateStudentId]  = useState<string | null>(null)
  const [viewCredentials,    setViewCredentials]    = useState<ParentAccount | null>(null)

  const { data: students  = [], isLoading: studentsLoading  } = useStudents({})
  const { data: classes   = [] }                              = useClasses()
  const { data: accounts  = [], isLoading: accountsLoading  } = useParentAccounts()

  // Build lookup maps
  const classMap = new Map(classes.map(c => [c.id, c.name]))

  // Map studentId → parent account (a student can be in multiple accounts' student_ids)
  const parentByStudentId = new Map<string, ParentAccount>()
  for (const account of accounts) {
    for (const sid of account.studentIds) {
      if (!parentByStudentId.has(sid)) parentByStudentId.set(sid, account)
    }
  }

  // Filter students
  const term = search.trim().toLowerCase()
  const filtered = term
    ? students.filter(s =>
        s.firstName.toLowerCase().includes(term) ||
        s.lastName.toLowerCase().includes(term)  ||
        s.admissionNumber.toLowerCase().includes(term)
      )
    : students

  const accountCount = accounts.length
  const isLoading    = studentsLoading || accountsLoading

  // Virtualizer
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count:           filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => 57,
    overscan:        10,
  })

  // Stable student lookup for the generate modal
  const generateStudent = generateStudentId
    ? students.find(s => s.id === generateStudentId) ?? null
    : null

  const handleGenerate      = useCallback((id: string) => setGenerateStudentId(id), [])
  const handleViewCred      = useCallback((acc: ParentAccount) => setViewCredentials(acc), [])

  return (
    <div>
      <PageHeader
        title="Parent Portal Access"
        subtitle={`${students.length} student${students.length !== 1 ? 's' : ''} · ${accountCount} account${accountCount !== 1 ? 's' : ''} created`}
      />

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <Input
          placeholder="Search by student name or admission number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          }
        />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <LoadingSpinner />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>
            {search ? 'No students match your search' : 'No students registered yet'}
          </div>
          {!search && (
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
              Register students first, then generate parent portal access from here.
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {/* Table header */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Student', 'Class', 'Portal Status', 'Actions'].map(col => (
                  <th key={col} style={{ textAlign: 'left', fontSize: 10, fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--txt3)', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', fontFamily: 'var(--font2)', whiteSpace: 'nowrap' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
          </table>

          {/* Virtualized body */}
          <div
            ref={parentRef}
            style={{ height: Math.min(filtered.length * 57, 560), overflowY: 'auto' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', position: 'relative' }}>
              <tbody style={{ display: 'block', height: virtualizer.getTotalSize() + 'px', position: 'relative' }}>
                {virtualizer.getVirtualItems().map(vrow => {
                  const student = filtered[vrow.index]!
                  return (
                    <tr
                      key={student.id}
                      className="sui-tr"
                      style={{ position: 'absolute', top: vrow.start + 'px', left: 0, right: 0, height: vrow.size + 'px', display: 'table', width: '100%', tableLayout: 'fixed' }}
                    >
                      {/* Name + adm number */}
                      <td style={{ padding: '0.7rem 1rem', width: '35%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-light)', border: '1.5px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 11, color: 'var(--brand)', flexShrink: 0 }}>
                              {`${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                              {student.firstName} {student.lastName}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>
                              {student.admissionNumber}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td style={{ padding: '0.7rem 1rem', width: '20%' }}>
                        <span style={{ fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font2)', fontWeight: 600 }}>
                          {student.classId ? (classMap.get(student.classId) ?? '—') : '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.7rem 1rem', width: '22%' }}>
                        {parentByStudentId.has(student.id) ? (
                          <Badge variant="green" dot>Account created</Badge>
                        ) : (
                          <Badge variant="muted" dot>No access</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.7rem 1rem', width: '23%' }}>
                        {parentByStudentId.has(student.id) ? (
                          <button
                            onClick={() => handleViewCred(parentByStudentId.get(student.id)!)}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--txt2)', cursor: 'pointer', fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            View Credentials
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGenerate(student.id)}
                            style={{ background: 'var(--brand)', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            Generate Access
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>
            Showing {filtered.length} of {students.length} students
          </div>
        </div>
      )}

      {/* Generate Access Modal */}
      {generateStudent && (
        <GenerateAccessModal
          student={generateStudent}
          onClose={() => setGenerateStudentId(null)}
        />
      )}

      {/* View Credentials Modal */}
      {viewCredentials && (
        <ViewCredentialsModal
          account={viewCredentials}
          onClose={() => setViewCredentials(null)}
        />
      )}
    </div>
  )
}
