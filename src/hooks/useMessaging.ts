import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { queueSync } from '../lib/db'
import { uploadFile, getPublicUrl } from '../lib/storage'
import type { Message } from '../types/app'
import type { Contact, Announcement } from '../types/week9'
import { ROLE_SENIORITY as SENIORITY } from '../types/week9'
import type { UserRole } from '../types/app'

// Roles permitted to post announcements
const ANNOUNCEMENT_POSTER_ROLES: UserRole[] = [
  'principal', 'deputy', 'dos', 'secretary', 'bursar', 'it_admin',
]

// ── resolveTeacherClassIds ───────────────────────────────────────────────────
// A teacher's "own class" for messaging purposes combines two sources: any
// class they teach a subject in (staff.classes[]) and any class where they're
// the homeroom class teacher (streams.class_teacher_id). Returns null for
// non-teacher roles (no restriction — bursar etc. see every parent).
async function resolveTeacherClassIds(user: { id: string; schoolId: string; role?: string; staffId?: string | null } | null): Promise<string[] | null> {
  if (!user || (user.role !== 'teacher' && user.role !== 'class_teacher')) return null

  let staffId = user.staffId ?? null
  if (!staffId) {
    const { data: s } = await supabase
      .from('staff').select('id, classes')
      .eq('auth_user_id', user.id).eq('school_id', user.schoolId).maybeSingle()
    staffId = (s as any)?.id ?? null
    if (s) {
      const [streamsRes] = await Promise.all([
        supabase.from('streams').select('class_id').eq('school_id', user.schoolId).eq('class_teacher_id', staffId!),
      ])
      const fromStaff = ((s as any).classes ?? []) as string[]
      const fromStreams = (streamsRes.data ?? []).map((r: any) => r.class_id as string)
      return Array.from(new Set([...fromStaff, ...fromStreams]))
    }
    return []
  }

  const [staffRes, streamsRes] = await Promise.all([
    supabase.from('staff').select('classes').eq('id', staffId).eq('school_id', user.schoolId).maybeSingle(),
    supabase.from('streams').select('class_id').eq('school_id', user.schoolId).eq('class_teacher_id', staffId),
  ])
  const fromStaff   = ((staffRes.data as any)?.classes ?? []) as string[]
  const fromStreams = (streamsRes.data ?? []).map((r: any) => r.class_id as string)
  return Array.from(new Set([...fromStaff, ...fromStreams]))
}

// ── useContacts ────────────────────────────────────────────────────────────
// Returns all staff members the current user can message, ordered by seniority,
// with unread count per contact.
export function useContacts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['contacts', user?.schoolId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Contact[]> => {
      const [staffRes, unreadRes] = await Promise.all([
        supabase
          .from('staff')
          .select('id, auth_user_id, first_name, last_name, role, photo_url')
          .eq('school_id', user!.schoolId)
          .eq('is_active', true)
          .neq('auth_user_id', user!.id),
        supabase
          .from('messages')
          .select('from_user_id')
          .eq('school_id', user!.schoolId)
          .eq('to_user_id', user!.id)
          .is('read_at', null),
      ])

      if (staffRes.error) throw new Error(staffRes.error.message)

      const staff   = staffRes.data ?? []
      const unread  = unreadRes.data ?? []

      // Count unread per sender
      const unreadMap = new Map<string, number>()
      for (const m of unread) {
        const k = m.from_user_id as string
        unreadMap.set(k, (unreadMap.get(k) ?? 0) + 1)
      }

      return staff
        .filter((s: any) => s.auth_user_id != null)
        .map((s: any) => ({
          id:          s.auth_user_id as string,
          staffId:     s.id as string,
          name:        `${s.first_name} ${s.last_name}`,
          role:        s.role as UserRole,
          photoUrl:    s.photo_url as string | null,
          unreadCount: unreadMap.get(s.auth_user_id) ?? 0,
        }))
        .sort((a: Contact, b: Contact) =>
          (SENIORITY[a.role] ?? 99) - (SENIORITY[b.role] ?? 99)
        )
    },
    staleTime: 60_000,
  })
}

// ── useMessages ────────────────────────────────────────────────────────────
// Loads the 1:1 thread between the current user and a contact.
// Also sets up a Supabase realtime subscription for instant delivery.
export function useMessages(contactId: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['messages', user?.schoolId, user?.id, contactId],
    enabled: !!user && !!contactId,
    queryFn: async (): Promise<Message[]> => {
      const uid = user!.id
      const cid = contactId!

      const { data, error } = await supabase
        .from('messages')
        .select('id, school_id, from_user_id, to_user_id, is_announcement, body, attachment_url, attachment_name, attachment_type, sent_at, read_at')
        .eq('school_id', user!.schoolId)
        .or(
          `and(from_user_id.eq.${uid},to_user_id.eq.${cid}),` +
          `and(from_user_id.eq.${cid},to_user_id.eq.${uid})`
        )
        .order('sent_at', { ascending: true })
        .limit(200)

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any) => ({
        id:             r.id,
        schoolId:       r.school_id,
        fromUserId:     r.from_user_id ?? null,
        toUserId:       r.to_user_id ?? null,
        isAnnouncement: r.is_announcement ?? false,
        body:           r.body ?? null,
        attachmentUrl:  r.attachment_url ?? null,
        attachmentName: r.attachment_name ?? null,
        attachmentType: r.attachment_type ?? null,
        sentAt:         r.sent_at,
        readAt:         r.read_at ?? null,
      } satisfies Message))
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    if (!user || !contactId) return

    const channel = supabase
      .channel(`messages:${user.schoolId}:${contactId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `school_id=eq.${user.schoolId}`,
        },
        (payload) => {
          const msg = payload.new as Record<string, unknown>
          const isForThisThread =
            (msg['to_user_id'] === user.id   && msg['from_user_id'] === contactId) ||
            (msg['from_user_id'] === user.id && msg['to_user_id']   === contactId)

          if (!isForThisThread) return

          const newMsg: Message = {
            id:             msg['id'] as string,
            schoolId:       msg['school_id'] as string,
            fromUserId:     (msg['from_user_id'] as string) ?? null,
            toUserId:       (msg['to_user_id'] as string) ?? null,
            isAnnouncement: (msg['is_announcement'] as boolean) ?? false,
            body:           (msg['body'] as string) ?? null,
            attachmentUrl:  (msg['attachment_url'] as string) ?? null,
            attachmentName: (msg['attachment_name'] as string) ?? null,
            attachmentType: (msg['attachment_type'] as string) ?? null,
            sentAt:         msg['sent_at'] as string,
            readAt:         (msg['read_at'] as string) ?? null,
          }

          qc.setQueryData(
            ['messages', user.schoolId, user.id, contactId],
            (old: Message[] = []) => {
              if (old.some(m => m.id === newMsg.id)) return old
              return [...old, newMsg]
            }
          )

          // Refresh unread badge + contact list
          void qc.invalidateQueries({ queryKey: ['unread-count', user.schoolId, user.id] })
          void qc.invalidateQueries({ queryKey: ['contacts', user.schoolId, user.id] })
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [user?.schoolId, user?.id, contactId, qc])

  return query
}

// ── useSendMessage ─────────────────────────────────────────────────────────
export function useSendMessage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      toUserId: string
      body: string
      attachmentUrl?: string | null
      attachmentName?: string | null
      attachmentType?: string | null
    }) => {
      if (!user) throw new Error('Not authenticated')

      const row = {
        school_id:       user.schoolId,
        from_user_id:    user.id,
        to_user_id:      input.toUserId,
        is_announcement: false,
        body:            input.body,
        attachment_url:  input.attachmentUrl  ?? null,
        attachment_name: input.attachmentName ?? null,
        attachment_type: input.attachmentType ?? null,
        sent_at:         new Date().toISOString(),
      }

      if (!navigator.onLine) {
        await queueSync('messages', 'insert', row)
        return
      }

      const { error } = await supabase.from('messages').insert(row)
      if (error) throw new Error(error.message)

      // In-app notification
      const msgPreview = input.body.length > 80 ? input.body.slice(0, 80) + '…' : input.body
      void supabase.from('notifications').insert({
        school_id: user.schoolId,
        user_id:   input.toUserId,
        type:      'message',
        title:     user.name,
        body:      msgPreview,
        from_user: user.id,
        read:      false,
        read_at:   null,
      })
      // Background push — fires even when recipient's tab is closed
      void supabase.functions.invoke('send-push', {
        body: { userId: input.toUserId, schoolId: user.schoolId, title: user.name, body: msgPreview, url: '/messages' },
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['messages', user?.schoolId, user?.id, vars.toUserId] })
      void qc.invalidateQueries({ queryKey: ['contacts', user?.schoolId, user?.id] })
    },
  })
}

// ── useMarkRead ────────────────────────────────────────────────────────────
// Marks all unread messages from a given sender as read.
// Called when the user opens a thread.
export function useMarkRead() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (fromUserId: string) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('school_id', user.schoolId)
        .eq('to_user_id', user.id)
        .eq('from_user_id', fromUserId)
        .is('read_at', null)

      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, fromUserId) => {
      void qc.invalidateQueries({ queryKey: ['messages', user?.schoolId, user?.id, fromUserId] })
      void qc.invalidateQueries({ queryKey: ['contacts', user?.schoolId, user?.id] })
    },
  })
}

// ── useAnnouncements ───────────────────────────────────────────────────────
// Announcements are stored in the messages table with is_announcement = true.
// There is no separate 'announcements' table.
export function useAnnouncements() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['announcements', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<Announcement[]> => {
      const [msgRes, staffRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id, school_id, from_user_id, body, attachment_url, sent_at')
          .eq('school_id', user!.schoolId)
          .eq('is_announcement', true)
          .order('sent_at', { ascending: false })
          .limit(50),
        supabase
          .from('staff')
          .select('auth_user_id, first_name, last_name')
          .eq('school_id', user!.schoolId)
          .not('auth_user_id', 'is', null),
      ])

      if (msgRes.error) throw new Error(msgRes.error.message)

      const nameMap = new Map<string, string>()
      for (const s of staffRes.data ?? []) {
        if (s.auth_user_id) nameMap.set(s.auth_user_id, `${s.first_name} ${s.last_name}`)
      }

      return (msgRes.data ?? []).map((r: any) => ({
        id:            r.id,
        schoolId:      r.school_id,
        fromUserId:    r.from_user_id,
        fromName:      nameMap.get(r.from_user_id) ?? 'Staff',
        body:          r.body,
        attachmentUrl: r.attachment_url,
        postedAt:      r.sent_at,
      } satisfies Announcement))
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

// ── usePostAnnouncement ────────────────────────────────────────────────────
// Only Principal, Deputy, DoS, Secretary, Bursar, IT Admin can post.
// Throws for any other role — enforced here AND in Supabase RLS.
export function usePostAnnouncement() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      body: string
      attachmentUrl?: string | null
      attachmentName?: string | null
      attachmentType?: string | null
    }) => {
      if (!user) throw new Error('Not authenticated')
      if (!ANNOUNCEMENT_POSTER_ROLES.includes(user.role)) {
        throw new Error('You do not have permission to post announcements')
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          school_id:       user.schoolId,
          from_user_id:    user.id,
          to_user_id:      null,
          is_announcement: true,
          body:            input.body,
          attachment_url:  input.attachmentUrl  ?? null,
          attachment_name: input.attachmentName ?? null,
          attachment_type: input.attachmentType ?? null,
          sent_at:         new Date().toISOString(),
        })

      if (error) throw new Error(error.message)

      // Send notification to all staff in the school for announcements
      const { data: staffMembers } = await supabase
        .from('staff')
        .select('auth_user_id')
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .not('auth_user_id', 'is', null)

      const recipientIds = ((staffMembers ?? []) as any[])
        .map(s => s.auth_user_id as string)
        .filter(id => id && id !== user.id)

      if (recipientIds.length > 0) {
        const preview = input.body.length > 80 ? input.body.slice(0, 80) + '…' : input.body
        const announceTitle = `${user.name} (Announcement)`
        void supabase.from('notifications').insert(
          recipientIds.map(uid => ({
            school_id: user.schoolId,
            user_id:   uid,
            type:      'announcement',
            title:     announceTitle,
            body:      preview,
            from_user: user.id,
            read:      false,
            read_at:   null,
          }))
        )
        // Background push to all recipients
        for (const uid of recipientIds) {
          void supabase.functions.invoke('send-push', {
            body: { userId: uid, schoolId: user.schoolId, title: announceTitle, body: preview, url: '/messages' },
          })
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['announcements', user?.schoolId] })
    },
  })
}

// ── useUnreadCount ─────────────────────────────────────────────────────────
// Quick count of unread 1:1 messages — used for TopBar badge.
export function useUnreadCount() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['unread-count', user?.schoolId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user!.schoolId)
        .eq('to_user_id', user!.id)
        .is('read_at', null)

      if (error) throw new Error(error.message)
      return count ?? 0
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

// ── useParentConversations ─────────────────────────────────────────────────
// For bursar / teacher: returns all unique parents who have sent at least one
// message to this staff member, with latest message preview + unread count.
export type ParentConversation = {
  parentAuthUserId: string
  parentName:       string
  studentNames:     string[]
  latestBody:       string
  latestSentAt:     string
  unreadCount:      number
}

export function useParentConversations() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['parent-conversations', user?.schoolId, user?.id],
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ParentConversation[]> => {
      if (!user) return []

      // 1. All messages where this staff member is the recipient
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('id, from_user_id, body, sent_at, read_at')
        .eq('school_id', user.schoolId)
        .eq('to_user_id', user.id)
        .eq('is_announcement', false)
        .order('sent_at', { ascending: false })
        .limit(500)

      if (msgErr) throw new Error(msgErr.message)

      const allMsgs = (msgs ?? []) as Array<{
        id: string; from_user_id: string; body: string; sent_at: string; read_at: string | null
      }>

      // Group by from_user_id — collect unique senders with their latest message
      const senderMap = new Map<string, { latestBody: string; latestSentAt: string; unreadCount: number }>()
      for (const m of allMsgs) {
        const k = m.from_user_id
        if (!senderMap.has(k)) {
          // first entry is the latest (desc order)
          senderMap.set(k, { latestBody: m.body, latestSentAt: m.sent_at, unreadCount: 0 })
        }
        if (!m.read_at) {
          senderMap.get(k)!.unreadCount++
        }
      }

      if (senderMap.size === 0) return []

      const senderIds = Array.from(senderMap.keys())

      // 2. Get parent_accounts for those sender IDs
      const { data: parents, error: parentErr } = await supabase
        .from('parent_accounts')
        .select('auth_user_id, full_name, student_ids')
        .eq('school_id', user.schoolId)
        .in('auth_user_id', senderIds)

      if (parentErr) throw new Error(parentErr.message)

      // Teachers only receive from parents of students in their own class(es)
      // — a parent who messages a teacher whose child isn't (or is no longer)
      // in that teacher's class shouldn't show up in the teacher's inbox.
      const myClassIds = await resolveTeacherClassIds(user)

      const parentList = (parents ?? []) as Array<{
        auth_user_id: string; full_name: string; student_ids: string[] | null
      }>

      if (parentList.length === 0) return []

      // 3. Resolve student names
      const allStudentIds = Array.from(
        new Set(parentList.flatMap(p => p.student_ids ?? []))
      )

      const studentNameMap  = new Map<string, string>()
      const studentClassMap = new Map<string, string | null>()
      if (allStudentIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('id, first_name, last_name, class_id')
          .eq('school_id', user!.schoolId)
          .in('id', allStudentIds)
        for (const s of (students ?? []) as Array<{ id: string; first_name: string; last_name: string; class_id: string | null }>) {
          studentNameMap.set(s.id, `${s.first_name} ${s.last_name}`)
          studentClassMap.set(s.id, s.class_id)
        }
      }

      return parentList
        .filter(p => senderMap.has(p.auth_user_id))
        // A teacher only sees parents with at least one child in their own
        // class(es); other roles (bursar etc.) are unrestricted (myClassIds === null).
        .filter(p => myClassIds === null || (p.student_ids ?? []).some(sid => myClassIds.includes(studentClassMap.get(sid) ?? '')))
        .map(p => ({
          parentAuthUserId: p.auth_user_id,
          parentName:       p.full_name ?? 'Parent',
          studentNames:     (p.student_ids ?? []).map(sid => studentNameMap.get(sid) ?? 'Student'),
          ...senderMap.get(p.auth_user_id)!,
        }))
        .sort((a, b) => new Date(b.latestSentAt).getTime() - new Date(a.latestSentAt).getTime())
    },
  })
}

// ── useConversationWithParent ──────────────────────────────────────────────
// Fetches full thread between this staff and a specific parent.
export function useConversationWithParent(parentAuthUserId: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['parent-thread', user?.schoolId, user?.id, parentAuthUserId],
    enabled: !!user && !!parentAuthUserId,
    staleTime: 10_000,
    refetchInterval: 15_000,
    queryFn: async (): Promise<Message[]> => {
      const me = user!.id
      const them = parentAuthUserId!

      const { data, error } = await supabase
        .from('messages')
        .select('id, school_id, from_user_id, to_user_id, body, attachment_url, attachment_name, attachment_type, sent_at, read_at')
        .eq('school_id', user!.schoolId)
        .eq('is_announcement', false)
        .or(
          `and(from_user_id.eq.${me},to_user_id.eq.${them}),` +
          `and(from_user_id.eq.${them},to_user_id.eq.${me})`
        )
        .order('sent_at', { ascending: true })
        .limit(200)

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any) => ({
        id:             r.id,
        schoolId:       r.school_id,
        fromUserId:     r.from_user_id ?? null,
        toUserId:       r.to_user_id ?? null,
        isAnnouncement: false,
        body:           r.body ?? null,
        attachmentUrl:  r.attachment_url ?? null,
        attachmentName: r.attachment_name ?? null,
        attachmentType: r.attachment_type ?? null,
        sentAt:         r.sent_at,
        readAt:         r.read_at ?? null,
      } satisfies Message))
    },
  })

  // Realtime: new messages in this thread
  useEffect(() => {
    if (!user || !parentAuthUserId) return

    const channel = supabase
      .channel(`parent-thread:${user.id}:${parentAuthUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `school_id=eq.${user.schoolId}` },
        (payload) => {
          const msg = payload.new as Record<string, unknown>
          const isForThisThread =
            (msg['to_user_id'] === user.id && msg['from_user_id'] === parentAuthUserId) ||
            (msg['from_user_id'] === user.id && msg['to_user_id'] === parentAuthUserId)
          if (!isForThisThread) return

          const newMsg: Message = {
            id:             msg['id'] as string,
            schoolId:       msg['school_id'] as string,
            fromUserId:     (msg['from_user_id'] as string) ?? null,
            toUserId:       (msg['to_user_id'] as string) ?? null,
            isAnnouncement: false,
            body:           (msg['body'] as string) ?? null,
            attachmentUrl:  (msg['attachment_url'] as string) ?? null,
            attachmentName: (msg['attachment_name'] as string) ?? null,
            attachmentType: (msg['attachment_type'] as string) ?? null,
            sentAt:         msg['sent_at'] as string,
            readAt:         null,
          }

          qc.setQueryData(
            ['parent-thread', user.schoolId, user.id, parentAuthUserId],
            (old: Message[] = []) => {
              if (old.some(m => m.id === newMsg.id)) return old
              return [...old, newMsg]
            }
          )
          void qc.invalidateQueries({ queryKey: ['parent-conversations', user.schoolId, user.id] })
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [user?.schoolId, user?.id, parentAuthUserId, qc])

  return query
}

// ── useSendMessageToParent ─────────────────────────────────────────────────
export function useSendMessageToParent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      toUserId: string
      body: string
      attachmentUrl?: string | null
      attachmentName?: string | null
      attachmentType?: string | null
    }) => {
      if (!user) throw new Error('Not authenticated')

      const row = {
        school_id:       user.schoolId,
        from_user_id:    user.id,
        to_user_id:      input.toUserId,
        body:            input.body,
        attachment_url:  input.attachmentUrl  ?? null,
        attachment_name: input.attachmentName ?? null,
        attachment_type: input.attachmentType ?? null,
        is_announcement: false,
        sent_at:         new Date().toISOString(),
      }

      if (!navigator.onLine) {
        await queueSync('messages', 'insert', row)
        return
      }

      const { error } = await supabase.from('messages').insert(row)
      if (error) throw new Error(error.message)

      // In-app notification to parent
      const preview = input.body.length > 80 ? input.body.slice(0, 80) + '…' : input.body
      void supabase.from('notifications').insert({
        school_id: user.schoolId,
        user_id:   input.toUserId,
        type:      'message',
        title:     user.name,
        body:      preview,
        from_user: user.id,
        read:      false,
        read_at:   null,
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['parent-thread', user?.schoolId, user?.id, vars.toUserId] })
      void qc.invalidateQueries({ queryKey: ['parent-conversations', user?.schoolId, user?.id] })
    },
  })
}

// ── useMarkParentThreadRead ────────────────────────────────────────────────
export function useMarkParentThreadRead() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (fromUserId: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('school_id', user.schoolId)
        .eq('to_user_id', user.id)
        .eq('from_user_id', fromUserId)
        .is('read_at', null)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, fromUserId) => {
      void qc.invalidateQueries({ queryKey: ['parent-thread', user?.schoolId, user?.id, fromUserId] })
      void qc.invalidateQueries({ queryKey: ['parent-conversations', user?.schoolId, user?.id] })
    },
  })
}

// ── useUploadAttachment ────────────────────────────────────────────────────
// Uploads a file to Supabase Storage (staff-attachments bucket).
// Max 5MB enforced client-side before upload.
export function useUploadAttachment() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (!user) throw new Error('Not authenticated')
      if (file.size > 5 * 1024 * 1024) throw new Error('File exceeds 5MB limit')

      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `${user.schoolId}/${user.id}/${Date.now()}.${ext}`

      await uploadFile('staff-attachments', path, file, { upsert: false })
      return getPublicUrl('staff-attachments', path) ?? ''
    },
  })
}

// ── useSearchStudentsForMessaging ──────────────────────────────
// Search students by name, return their linked activated parent accounts.
// Used by the "New Conversation" compose flow on bursar/teacher message pages.
export type StudentParentResult = {
  parentAuthUserId: string
  parentName:       string
  parentEmail:      string
  studentNames:     string[]
  admissionNumbers: string[]
}

export function useSearchStudentsForMessaging(query: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-parent-search', user?.schoolId, query],
    enabled:  !!user?.schoolId && query.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<StudentParentResult[]> => {
      const q = query.trim()
      // Split on whitespace so a full-name search ("Grace Apio") matches —
      // a single ilike on first_name OR last_name never matches "Grace Apio"
      // as a whole, since neither column contains that literal substring.
      const words = q.split(/\s+/).filter(Boolean)
      const orFilter = words
        .map(w => `first_name.ilike.%${w}%,last_name.ilike.%${w}%`)
        .join(',') + `,admission_number.ilike.%${q}%`

      // 1. Find matching active students — broad candidate set (any word/field
      // matches), then require every word to appear somewhere in the full name
      // client-side (ilike alone can't express "AND across OR" in one call).
      const { data: candidates, error: stuErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, class_id')
        .eq('school_id', user!.schoolId)
        .eq('status', 'active')
        .or(orFilter)
        .limit(50)
      if (stuErr) throw stuErr
      if (!candidates?.length) return []

      const myClassIds = await resolveTeacherClassIds(user)

      const students = candidates.filter((s: any) => {
        // Teachers only find students in their own class(es).
        if (myClassIds !== null && !myClassIds.includes(s.class_id)) return false
        if (words.length <= 1) return true
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
        return words.every(w => fullName.includes(w.toLowerCase()) || (s.admission_number as string).toLowerCase().includes(w.toLowerCase()))
      }).slice(0, 15)
      if (students.length === 0) return []

      const studentIds = students.map(s => s.id as string)

      // 2. Find activated parent accounts linked to these students
      const { data: parents } = await supabase
        .from('parent_accounts')
        .select('auth_user_id, full_name, email, student_ids')
        .eq('school_id', user!.schoolId)
        .not('auth_user_id', 'is', null)
        .overlaps('student_ids', studentIds)

      if (!parents?.length) return []

      // Dedupe parents and map to result shape
      const seen = new Set<string>()
      const results: StudentParentResult[] = []
      for (const p of parents) {
        const authId = p.auth_user_id as string
        if (seen.has(authId)) continue
        const linked = students.filter(s =>
          (p.student_ids as string[]).includes(s.id as string)
        )
        // Defense in depth alongside the server-side .overlaps() filter above —
        // a parent with zero students in the (possibly teacher-scoped) `students`
        // set shouldn't appear, e.g. if their only matching child was just
        // filtered out because they're not in the searching teacher's class.
        if (linked.length === 0) continue
        seen.add(authId)
        results.push({
          parentAuthUserId: authId,
          parentName:       (p.full_name as string) || (p.email as string),
          parentEmail:      p.email as string,
          studentNames:     linked.map(s => `${s.first_name} ${s.last_name}`),
          admissionNumbers: linked.map(s => s.admission_number as string),
        })
      }
      return results
    },
  })
}
