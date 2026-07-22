-- The supabase_realtime publication existed but had ZERO tables added to it.
-- Every postgres_changes subscription in the app (in-app push toasts, live
-- attendance/exam-results/fee-payments/report-cards/students/teacher-remarks/
-- timetable updates, and 1:1 messaging threads) has therefore never received
-- a single realtime event since these features were built — confirmed via
-- `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'`
-- returning 0 rows against the live project. This is the actual root cause
-- of "push notifications not sliding in" (task #78) and likely explains any
-- other "why isn't this updating live" reports across the app.
ALTER PUBLICATION supabase_realtime ADD TABLE
  notifications,
  messages,
  attendance,
  exam_results,
  fee_payments,
  report_cards,
  students,
  teacher_remarks,
  timetable_slots;
