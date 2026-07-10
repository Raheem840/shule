# Shule Import Templates

Pre-filled CSV templates with realistic Ugandan school data.
Download any file and fill in your school's actual data before importing.

| File | Records | Purpose |
|------|---------|---------|
| students_import_template.csv | 25 rows — S.1 through S.6 | Import new students |
| staff_import_template.csv | 15 rows — all roles | Import staff members |
| fee_payments_import_template.csv | 25 rows — all classes | Bulk import fee records |
| exam_marks_import_template.csv | 20 rows — one class | Reference for mark format |
| attendance_import_template.csv | 20 rows — two days | Reference for attendance format |
| timetable_import_template.csv | 10 rows — two classes | Reference for planning a timetable before building it in the Timetable page's drag-and-drop UI |

## Notes
- Keep column headers exactly as shown
- Date format: YYYY-MM-DD (e.g. 2026-02-15)
- Amounts in UGX as whole numbers (no commas, no decimals)
- gender: Male or Female
- student_type: day or boarder
- term: 1, 2, or 3
- is_absent: TRUE or FALSE
- day (timetable): Monday, Tuesday, Wednesday, Thursday, or Friday
- start_time / end_time (timetable): 24-hour HH:MM
- timetable_import_template.csv is reference-only — there's no bulk-upload for
  timetables yet, so use it to plan the week's slots before entering them in
  the app's Timetable drag-and-drop UI
