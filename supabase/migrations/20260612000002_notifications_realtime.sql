-- Enable Supabase Realtime for notifications table.
-- NotificationPushListener subscribes to postgres_changes INSERT events
-- filtered by user_id — requires REPLICA IDENTITY FULL so the filter
-- on a non-PK column is reliably evaluated server-side.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add to the supabase_realtime publication so INSERT events are broadcast.
-- Safe to run multiple times: DO block guards against duplicate membership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;
