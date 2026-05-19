import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useStudents } from '../../hooks/useStudents'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import type { ParentAccount, Student } from '../../types/app'

type AnyRow = Record<string, unknown>

// ── useParentAccounts ─────────────────────────────────────────
function useParentAccounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-accounts', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, school_id, email, phone, full_name, student_ids, auth_user_id, created_by, created_at')
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
      fullName:   string
      email:      string
      phone:      string | null
      studentIds: string[]
    }) => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .insert({
          school_id:   user!.schoolId,
          full_name:   input.fullName,
          email:       input.email,
          phone:       input.phone,
          student_ids: input.studentIds,
          created_by:  user!.id,
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

// ── useLinkStudentToParent ────────────────────────────────────
function useLinkStudentToParent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ parentId, studentId }: { parentId: string; studentId: string }) => {
      // Fetch current student_ids array
      const { data, error: fetchErr } = await supabase
        .from('parent_accounts')
        .select('student_ids')
        .eq('id', parentId)
        .eq('school_id', user!.schoolId)
        .single()

      if (fetchErr) throw fetchErr

      const existing = (data.student_ids as string[]) ?? []
      if (existing.includes(studentId)) return // already linked

      const { error } = await supabase
        .from('parent_accounts')
        .update({ student_ids: [...existing, studentId] })
        .eq('id', parentId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-accounts'] })
    },
  })
}

// ── Create modal form schema ──────────────────────────────────
const createSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email:    z.string().email('Valid email required'),
  phone:    z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

// ── Student picker inside create modal ────────────────────────
function StudentPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const { data: students = [], isLoading } = useStudents({
    search: search.length >= 2 ? search : undefined,
  })

  const displayed = search.length < 2 ? [] : students.slice(0, 8)

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
        Link Students
      </div>
      <Input
        placeholder="Search by name or admission number…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {search.length >= 2 && (
        <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
          {isLoading ? (
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}><LoadingSpinner size="sm" /></div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: 12, color: 'var(--txt3)' }}>No students found</div>
          ) : (
            displayed.map(s => {
              const isSelected = selected.includes(s.id)
              return (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', cursor: 'pointer', background: isSelected ? 'var(--brand-light)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                      {s.firstName} {s.lastName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>
                      {s.admissionNumber}
                    </div>
                  </div>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 8 }}>
          {selected.map(id => (
            <Badge key={id} variant="teal">
              Linked · {id.slice(0, 8)}…
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create parent modal ───────────────────────────────────────
function CreateParentModal({
  open,
  onClose,
  students,
}: {
  open:     boolean
  onClose:  () => void
  students: Student[]
}) {
  const [linkedIds,      setLinkedIds]      = useState<string[]>([])
  const [showCredential, setShowCredential] = useState(false)
  const [createdEmail,   setCreatedEmail]   = useState('')

  const { success: ok, error: err } = useToast()
  const createMutation = useCreateParentAccount()

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  function handleClose() {
    reset()
    setLinkedIds([])
    setShowCredential(false)
    setCreatedEmail('')
    onClose()
  }

  async function onSubmit(values: CreateForm) {
    if (linkedIds.length === 0) {
      err('Link at least one student before creating the account')
      return
    }

    createMutation.mutate({
      fullName:   values.fullName,
      email:      values.email,
      phone:      values.phone?.trim() || null,
      studentIds: linkedIds,
    }, {
      onSuccess: () => {
        setCreatedEmail(values.email)
        setShowCredential(true)
        ok(`Parent account created for ${values.fullName}`)
      },
      onError: e => err(e.message),
    })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={showCredential ? 'Account Created' : 'Create Parent Account'}
      size="md"
    >
      {showCredential ? (
        // ── Credential summary screen ─────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)' }}>
              Account ready
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
              Parent account created for <strong>{createdEmail}</strong>
            </div>
          </div>

          <div style={{ width: '100%', padding: '1rem', background: 'var(--info-bg)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 'var(--r-lg)', textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--info)', marginBottom: 8 }}>
              NEXT STEPS
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.8 }}>
              <li>Share the email address with the parent</li>
              <li>Ask IT Admin to activate the login and set a password</li>
              <li>
                {/* TODO: implement Edge Function for auth user creation — Week 8 */}
                Magic link / password reset will be sent automatically once IT Admin activates the account
              </li>
            </ul>
          </div>

          <Button variant="primary" onClick={handleClose} style={{ width: '100%' }}>Done</Button>
        </div>
      ) : (
        // ── Create form ───────────────────────────────────
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input label="Parent / Guardian Full Name *" {...register('fullName')}
            error={errors.fullName?.message} placeholder="e.g. Nakato Sarah" />

          <Input label="Email Address *" type="email" {...register('email')}
            error={errors.email?.message} placeholder="parent@email.com"
            helper="This becomes their login — must be unique" />

          <Input label="Phone" type="tel" {...register('phone')}
            placeholder="+256 700 000 000" />

          <StudentPicker selected={linkedIds} onChange={setLinkedIds} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: 4 }}>
            <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={createMutation.isPending}>
              Create Account
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// ── Parent account row ────────────────────────────────────────
function ParentRow({
  account,
  students,
  onLink,
}: {
  account:  ParentAccount
  students: Student[]
  onLink:   (parentId: string) => void
}) {
  const linkedStudents = students.filter(s => account.studentIds.includes(s.id))
  const hasAuth        = !!account.authUserId

  return (
    <tr className="sui-tr">
      <td style={{ padding: '0.85rem 1rem' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{account.fullName}</div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 2 }}>{account.email}</div>
      </td>
      <td style={{ padding: '0.85rem 1rem' }}>
        {account.phone
          ? <span style={{ fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>{account.phone}</span>
          : <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>}
      </td>
      <td style={{ padding: '0.85rem 1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {linkedStudents.length === 0
            ? <Badge variant="amber">No students linked</Badge>
            : linkedStudents.map(s => (
                <Badge key={s.id} variant="teal">
                  {s.firstName} {s.lastName}
                </Badge>
              ))
          }
        </div>
      </td>
      <td style={{ padding: '0.85rem 1rem' }}>
        <Badge variant={hasAuth ? 'green' : 'muted'} dot>
          {hasAuth ? 'Active' : 'Pending activation'}
        </Badge>
      </td>
      <td style={{ padding: '0.85rem 1rem' }}>
        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
          {new Date(account.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </td>
      <td style={{ padding: '0.85rem 1rem' }}>
        <button
          onClick={() => onLink(account.id)}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--txt2)', cursor: 'pointer', fontFamily: 'var(--font2)', transition: 'border-color 0.15s, color 0.15s' }}
        >
          Link Student
        </button>
      </td>
    </tr>
  )
}

// ── Link student modal ────────────────────────────────────────
function LinkStudentModal({
  parentId,
  onClose,
}: {
  parentId: string | null
  onClose:  () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const { success: ok, error: err } = useToast()
  const linkMutation = useLinkStudentToParent()
  const { data: students = [] } = useStudents({
    search: search.length >= 2 ? search : undefined,
  })

  function handleLink() {
    if (!parentId || !selectedId) return
    linkMutation.mutate({ parentId, studentId: selectedId }, {
      onSuccess: () => { ok('Student linked to parent account'); onClose() },
      onError:   e  => err(e.message),
    })
  }

  return (
    <Modal open={!!parentId} onClose={onClose} title="Link Student to Parent" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          placeholder="Search student by name or admission no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {search.length >= 2 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', maxHeight: 240, overflowY: 'auto' }}>
            {students.slice(0, 8).map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{ padding: '0.65rem 0.85rem', cursor: 'pointer', background: selectedId === s.id ? 'var(--brand-light)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                  {s.firstName} {s.lastName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>
                  {s.admissionNumber}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!selectedId} loading={linkMutation.isPending} onClick={handleLink}>
            Link Student
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function ParentCredentialsPage() {
  const [createOpen,      setCreateOpen]      = useState(false)
  const [linkingParentId, setLinkingParentId] = useState<string | null>(null)
  const [search,          setSearch]          = useState('')

  const { data: accounts = [], isLoading } = useParentAccounts()
  const { data: students = [] }            = useStudents({})

  const filtered = search.trim()
    ? accounts.filter(a =>
        a.fullName.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
      )
    : accounts

  return (
    <div>
      <PageHeader
        title="Parent Portal Access"
        subtitle={`${accounts.length} parent account${accounts.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}
            leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>}>
            Create Account
          </Button>
        }
      />

      <div style={{ marginBottom: '1rem' }}>
        <Input
          placeholder="Search by parent name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
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
            {search ? 'No accounts match your search' : 'No parent accounts yet'}
          </div>
          {!search && (
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: '1.25rem' }}>
              Create an account to give parents access to their child's results, fees, and reports.
            </div>
          )}
          {!search && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create First Account
            </Button>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Parent / Guardian', 'Phone', 'Linked Students', 'Portal Status', 'Created', 'Actions'].map(col => (
                  <th key={col} style={{ textAlign: 'left', fontSize: 10, fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--txt3)', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', fontFamily: 'var(--font2)', whiteSpace: 'nowrap' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(account => (
                <ParentRow
                  key={account.id}
                  account={account}
                  students={students}
                  onLink={id => setLinkingParentId(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateParentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        students={students}
      />

      <LinkStudentModal
        parentId={linkingParentId}
        onClose={() => setLinkingParentId(null)}
      />
    </div>
  )
}
