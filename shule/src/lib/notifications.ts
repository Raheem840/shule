import { supabase } from './supabase'
import type { NotificationType } from '../types/week9'

export interface NotifPayload {
  schoolId: string
  userIds:  string[]          // auth user IDs of recipients
  type:     NotificationType
  title?:   string
  body:     string
  link?:    string | null
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
    body:      payload.body,
    link:      payload.link ?? null,
  }))

  await supabase.from('notifications').insert(rows)
}
