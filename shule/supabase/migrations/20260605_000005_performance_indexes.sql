-- Performance indexes for common Shule query patterns

-- Students: active by class+stream (most common query)
CREATE INDEX IF NOT EXISTS idx_students_school_class_active
  ON public.students(school_id, class_id, stream_id)
  WHERE status = 'active';

-- Students: admission number lookup
CREATE INDEX IF NOT EXISTS idx_students_admission_number
  ON public.students(school_id, admission_number);

-- Exam results: teacher view by term
CREATE INDEX IF NOT EXISTS idx_exam_results_teacher_term
  ON public.exam_results(school_id, teacher_id, term, year);

-- Exam results: student portal
CREATE INDEX IF NOT EXISTS idx_exam_results_student
  ON public.exam_results(school_id, student_id, term, year);

-- Attendance: daily class view
CREATE INDEX IF NOT EXISTS idx_attendance_class_date
  ON public.attendance(school_id, class_id, date);

-- Fee payments: bursar filter (term only — no year column on this table)
CREATE INDEX IF NOT EXISTS idx_fee_payments_term
  ON public.fee_payments(school_id, term);

-- Messages: inbox + sent
CREATE INDEX IF NOT EXISTS idx_messages_inbox
  ON public.messages(school_id, to_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sent
  ON public.messages(school_id, from_user_id, sent_at DESC);

-- Notifications: unread
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(school_id, user_id, read, created_at DESC);

-- Sync queue: pending items
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending
  ON public.sync_queue(school_id, status, created_at)
  WHERE status = 'pending';

-- School events: created_by lookup (teacher view)
CREATE INDEX IF NOT EXISTS idx_school_events_created_by
  ON public.school_events(school_id, created_by);

-- School events: parent portal visibility filter
CREATE INDEX IF NOT EXISTS idx_school_events_visible_parents
  ON public.school_events(school_id, visible_to_parents, event_date)
  WHERE visible_to_parents = true;
