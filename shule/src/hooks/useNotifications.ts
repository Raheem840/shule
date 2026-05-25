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
        .select('id, school_id, user_id, type, body, link, read_at, created_at')
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
        body:      r['body'] as string,
        link:      r['link'] as string | null,
        readAt:    r['read_at'] as string | null,
        createdAt: r['created_at'] as string,
      } satisfies Notification))
    },
    staleTime: 30_000,
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
      void qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
    },
  })
}
