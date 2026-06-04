import { supabase } from './supabase'
import type { NotificationType } from '../types/week9'

export interface NotifPayload {
  schoolId:  string
  userIds:   string[]          // auth user IDs of recipients
  type:      NotificationType
  title?:    string | null     // shown as sender name or heading in push toast
  body:      string
  link?:     string | null
  fromUser?: string | null     // auth user ID of sender (wired to from_user column)
}

/**
 * Insert notification rows for one or more recipients.
 * Fire-and-forget — caller should not await when it isn't critical.
 */
export async function sendNotifications(payload: NotifPayload): Promise<void> {
  if (!payload.userIds.length) return

  const rows = payload.userIds.map(uid => ({
    school_id: payload.schoolId,
    user_id:   uid,
    type:      payload.type,
    title:     payload.title ?? null,
    body:      payload.body,
    link:      payload.link ?? null,
    from_user: payload.fromUser ?? null,
  }))

  await supabase.from('notifications').insert(rows)
}
