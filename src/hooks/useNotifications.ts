import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { Notification } from '../types/week9'

// ── useNotifications ───────────────────────────────────────────────────────
// Returns the 10 most-recent unread notifications for the current user.
export function useNotifications() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, school_id, user_id, type, title, body, link, read_at, created_at, from_user')
        .eq('school_id', user!.schoolId)
        .eq('user_id', user!.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: Record<string, unknown>) => ({
        id:        r['id'] as string,
        schoolId:  r['school_id'] as string,
        userId:    r['user_id'] as string,
        type:      r['type'] as Notification['type'],
        title:     (r['title'] as string | null) ?? null,
        body:      r['body'] as string,
        link:      r['link'] as string | null,
        readAt:    r['read_at'] as string | null,
        createdAt: r['created_at'] as string,
        fromUser:  (r['from_user'] as string | null) ?? null,
      } satisfies Notification))
    },
    staleTime: 30_000,
  })
}

// ── usePortalNotifications ─────────────────────────────────────────────────
// All notifications for the portal view — includes read ones, up to 50.
// Falls back to empty array if the notifications table doesn't exist yet.
export function usePortalNotifications() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['portal-notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, school_id, user_id, type, title, body, link, read_at, created_at, from_user')
        .eq('school_id', user!.schoolId)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error?.code === '42P01') return []
      if (error) throw new Error(error.message)

      return (data ?? []).map((r: Record<string, unknown>) => ({
        id:        r['id'] as string,
        schoolId:  r['school_id'] as string,
        userId:    r['user_id'] as string,
        type:      r['type'] as Notification['type'],
        title:     (r['title'] as string | null) ?? null,
        body:      r['body'] as string,
        link:      r['link'] as string | null,
        readAt:    r['read_at'] as string | null,
        createdAt: r['created_at'] as string,
        fromUser:  (r['from_user'] as string | null) ?? null,
      } satisfies Notification))
    },
    staleTime: 30_000,
  })
}

// ── useMarkSingleNotificationRead ──────────────────────────────────────────
// Stamps read_at = now() on a single notification by ID.
export function useMarkSingleNotificationRead() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (notifId: string) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notifId)
        .eq('user_id', user.id)
        .eq('school_id', user.schoolId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-notifications', user?.id] })
      void qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
    },
  })
}

// ── useMarkNotificationsRead ───────────────────────────────────────────────
// Stamps read_at = now() on all unread notifications for the current user.
export function useMarkNotificationsRead() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('school_id', user.schoolId)
        .eq('user_id', user.id)
        .is('read_at', null)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications',        user?.id] })
      void qc.invalidateQueries({ queryKey: ['portal-notifications', user?.id] })
    },
  })
}
