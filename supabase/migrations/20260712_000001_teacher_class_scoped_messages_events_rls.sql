-- Closes the "teacher message/event class-scoping is UI-only" gap logged in
-- memory: useMessaging.ts/useTeacherEvents.ts already restrict a teacher's
-- contact list and event class picker to their own assigned classes
-- (staff.classes[] union streams.class_teacher_id — see resolveTeacherClassIds),
-- but nothing at the DB level stopped a teacher from messaging an arbitrary
-- parent/student or creating/editing an event for a class they don't teach
-- via a direct API call, bypassing the UI entirely.

-- ── Helper: does this staff member teach/own-homeroom this class? ──────────
create or replace function staff_has_class(p_staff_id uuid, p_class_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from staff s where s.id = p_staff_id and p_class_id = any(s.classes)
  ) or exists (
    select 1 from streams st where st.class_teacher_id = p_staff_id and st.class_id = p_class_id
  );
$$;

-- ── Helper: can this teacher (by auth uid) message this recipient? ─────────
-- Staff-to-staff messaging stays unrestricted (recipient is a staff member).
-- A parent/student recipient is only allowed if the teacher actually teaches
-- (or is homeroom teacher for) at least one of the recipient's linked
-- student(s)' class.
create or replace function teacher_can_message(p_teacher_auth_id uuid, p_to_user_id uuid)
returns boolean
language sql stable
as $$
  select
    exists (select 1 from staff s where s.auth_user_id = p_to_user_id)
    or exists (
      select 1
      from parent_accounts pa
      join staff me on me.auth_user_id = p_teacher_auth_id
      join students stu on stu.id = any(pa.student_ids)
      where pa.auth_user_id = p_to_user_id
        and staff_has_class(me.id, stu.class_id)
    )
    or exists (
      select 1
      from students stu
      join staff me on me.auth_user_id = p_teacher_auth_id
      where stu.auth_user_id = p_to_user_id
        and staff_has_class(me.id, stu.class_id)
    );
$$;

-- ── messages: consolidate the 2 overlapping permissive INSERT policies ─────
-- (both currently allow the full staff role list unconditionally as
-- permissive OR'd policies — narrowing just one would have been a no-op)
-- into a single policy, then add the teacher/class_teacher restriction.
drop policy if exists messages_insert on messages;
drop policy if exists staff_can_send_messages on messages;

create policy staff_can_send_messages on messages
for insert
with check (
  school_id = user_school_id()
  and from_user_id = auth.uid()
  and user_role() = any(array['principal','deputy','dos','secretary','bursar','class_teacher','teacher','it_admin','student','parent'])
  and (
    user_role() not in ('teacher','class_teacher')
    or teacher_can_message(auth.uid(), to_user_id)
  )
);

-- ── school_events: restrict a teacher's own class_id to classes they teach ─
-- Senior roles (principal/deputy/dos/secretary) keep unrestricted access.
-- A teacher/class_teacher can still manage events they created, but only if
-- the event's class_id is null (general/school-wide) or one of their own.
drop policy if exists staff_manage_own_events on school_events;

create policy staff_manage_own_events on school_events
for all
using (
  school_id = user_school_id()
  and (
    user_role() = any(array['principal','deputy','dos','secretary'])
    or (
      created_by = (select id from staff where auth_user_id = auth.uid() limit 1)
      and (
        user_role() not in ('teacher','class_teacher')
        or class_id is null
        or staff_has_class((select id from staff where auth_user_id = auth.uid() limit 1), class_id)
      )
    )
  )
)
with check (
  school_id = user_school_id()
  and (
    user_role() = any(array['principal','deputy','dos','secretary'])
    or (
      created_by = (select id from staff where auth_user_id = auth.uid() limit 1)
      and (
        user_role() not in ('teacher','class_teacher')
        or class_id is null
        or staff_has_class((select id from staff where auth_user_id = auth.uid() limit 1), class_id)
      )
    )
  )
);
