import { supabase } from './supabase'
import { sendNotifications } from './notifications'

// Records a reason-carrying audit_log entry for a student/parent portal
// password reset and alerts every active IT Admin at the school — the
// Secretary/Principal role that triggers these resets has no visibility
// into it otherwise, and a reset (unlike normal login activity) is worth
// IT Admin follow-up if it wasn't expected.
export async function logPasswordResetWithReason(params: {
  schoolId:     string
  actorUserId:  string
  actorRole:    string
  targetTable:  'students' | 'parent_accounts'
  targetId:     string
  targetName:   string
  reason:       string
}): Promise<void> {
  const { schoolId, actorUserId, actorRole, targetTable, targetId, targetName, reason } = params

  await supabase.from('audit_log').insert({
    school_id:   schoolId,
    user_id:     actorUserId,
    role:        actorRole,
    action:      'PASSWORD_RESET',
    table_name:  targetTable,
    record_id:   targetId,
    entity_name: targetName,
    new_value:   { reason, timestamp: new Date().toISOString() },
  })

  const { data: itAdmins } = await supabase
    .from('staff')
    .select('auth_user_id')
    .eq('school_id', schoolId)
    .eq('role', 'it_admin')
    .eq('is_active', true)
    .not('auth_user_id', 'is', null)

  const userIds = (itAdmins ?? [])
    .map(r => r.auth_user_id as string | null)
    .filter((id): id is string => !!id)

  if (userIds.length > 0) {
    await sendNotifications({
      schoolId,
      userIds,
      type:  'security',
      title: 'Portal password reset',
      body:  `${targetName}'s portal password was reset. Reason: ${reason}`,
      link:  '/admin/credentials',
    })
  }
}
