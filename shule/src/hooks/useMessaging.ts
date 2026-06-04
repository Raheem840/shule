import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import { queueSync } from '../lib/db'
import type { Message } from '../types/app'
import type { Contact, Announcement } from '../types/week9'
import { ROLE_SENIORITY as SENIORITY } from '../types/week9'
import type { UserRole } from '../types/app'

// Roles permitted to post announcements
const ANNOUNCEMENT_POSTER_ROLES: UserRole[] = [
  'principal', 'deputy', 'dos', 'secretary', 'bursar', 'it_admin',
]

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
    queryKey: ['messages', user?.id, contactId],
    enabled: !!user && !!contactId,
    queryFn: async (): Promise<Message[]> => {
      const uid = user!.id
      const cid = contactId!

      const { data, error } = await supabase
        .from('messages')
        .select('id, school_id, from_user_id, to_user_id, body, attachment_url, sent_at, read_at')
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
            ['messages', user.id, contactId],
            (old: Message[] = []) => {
              if (old.some(m => m.id === newMsg.id)) return old
              return [...old, newMsg]
            }
          )

          // Refresh unread badge + contact list
          void qc.invalidateQueries({ queryKey: ['unread-count', user.id] })
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
    }) => {
      if (!user) throw new Error('Not authenticated')

      const row = {
        school_id:      user.schoolId,
        from_user_id:   user.id,
        to_user_id:     input.toUserId,
        body:           input.body,
        attachment_url: input.attachmentUrl ?? null,
        sent_at:        new Date().toISOString(),
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
      })
      // Background push — fires even when recipient's tab is closed
      void supabase.functions.invoke('send-push', {
        body: { userId: input.toUserId, schoolId: user.schoolId, title: user.name, body: msgPreview, url: '/messages' },
      })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['messages', user?.id, vars.toUserId] })
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
      void qc.invalidateQueries({ queryKey: ['messages', user?.id, fromUserId] })
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
          attachment_url:  input.attachmentUrl ?? null,
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
    queryKey: ['unread-count', user?.id],
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

      const { error } = await supabase.storage
        .from('staff-attachments')
        .upload(path, file, { upsert: false })

      if (error) throw new Error(error.message)

      const { data } = supabase.storage
        .from('staff-attachments')
        .getPublicUrl(path)

      return data.publicUrl
    },
  })
}
