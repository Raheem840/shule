-- The bursar SMS Reminders page previously always fired an in-app notification
-- alongside every SMS/WhatsApp reminder with no way to turn it off, and had no
-- way to send an in-app-only reminder. Making "in_app" a selectable channel
-- (like sms/whatsapp) requires the delivery log's channel column to accept it.
ALTER TABLE public.sms_reminders DROP CONSTRAINT sms_reminders_channel_check;
ALTER TABLE public.sms_reminders
  ADD CONSTRAINT sms_reminders_channel_check
  CHECK (channel = ANY (ARRAY['sms'::text, 'whatsapp'::text, 'in_app'::text]));
