-- Migration: teacher_attendance_scoped_to_assigned_classes
-- Created: Sat 04 Jul 2026 05:38:52 PM EAT
-- Author: Sinqura Dev Team
-- Description: The attendance INSERT/UPDATE RLS policies only checked role
-- ('teacher'/'class_teacher'/'secretary'/'principal') + school_id — nothing
-- scoped a teacher's write to a class they're actually assigned to. The app's
-- own UI (AttendancePage.tsx) only ever lets a teacher pick from their
-- assigned classes, but that's a UI-level restriction only — a direct API
-- call could mark attendance for any class in the school. Secretary and
-- principal are intentionally left unrestricted (they already have broader
-- authority over attendance per existing product decisions).

-- ── CHANGES ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "attendance: staff can insert" ON "public"."attendance";
CREATE POLICY "attendance: staff can insert" ON "public"."attendance"
FOR INSERT
WITH CHECK (
  (school_id = auth_school_id())
  AND (
    auth_role() = ANY (ARRAY['secretary'::text, 'principal'::text])
    OR (
      auth_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.auth_user_id = auth.uid()
          AND s.school_id = attendance.school_id
          AND (
            attendance.class_id = ANY (s.classes)
            OR EXISTS (
              SELECT 1 FROM streams st
              WHERE st.class_teacher_id = s.id AND st.class_id = attendance.class_id
            )
          )
      )
    )
  )
);

DROP POLICY IF EXISTS "attendance_insert" ON "public"."attendance";
CREATE POLICY "attendance_insert" ON "public"."attendance"
FOR INSERT TO "authenticated"
WITH CHECK (
  (school_id = user_school_id())
  AND (
    user_role() = ANY (ARRAY['secretary'::text, 'principal'::text])
    OR (
      user_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.auth_user_id = auth.uid()
          AND s.school_id = attendance.school_id
          AND (
            attendance.class_id = ANY (s.classes)
            OR EXISTS (
              SELECT 1 FROM streams st
              WHERE st.class_teacher_id = s.id AND st.class_id = attendance.class_id
            )
          )
      )
    )
  )
);

DROP POLICY IF EXISTS "attendance_update" ON "public"."attendance";
CREATE POLICY "attendance_update" ON "public"."attendance"
FOR UPDATE TO "authenticated"
USING (
  (school_id = user_school_id())
  AND (
    user_role() = ANY (ARRAY['secretary'::text, 'principal'::text])
    OR (
      user_role() = ANY (ARRAY['teacher'::text, 'class_teacher'::text])
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.auth_user_id = auth.uid()
          AND s.school_id = attendance.school_id
          AND (
            attendance.class_id = ANY (s.classes)
            OR EXISTS (
              SELECT 1 FROM streams st
              WHERE st.class_teacher_id = s.id AND st.class_id = attendance.class_id
            )
          )
      )
    )
  )
);

-- ── VERIFICATION ─────────────────────────────────────────────
-- As a teacher-role JWT whose staff.classes[] does NOT include some class X:
-- INSERT INTO attendance (school_id, student_id, class_id, date, status, recorded_by)
-- VALUES (<own school>, <any student in class X>, X, current_date, 'present', <own staff id>)
-- should now be rejected by RLS (previously succeeded for any class in the school).
