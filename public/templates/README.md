# Shule Import Templates

Pre-filled CSV templates with realistic Ugandan school data.
Download any file and fill in your school's actual data before importing.

| File | Records | Purpose |
|------|---------|---------|
| students_import_template.csv | 30 rows — S.1 through S.4 | Import new students (Secretary → Import Data) |
| staff_import_template.csv | 20 rows — all roles | Import staff members (Secretary → Import Data) |
| fee_payments_import_template.csv | 18 rows — all classes | Bulk import fee records (Bursar → Import) |
| timetable_import_template.csv | 10 rows — two classes | Reference for planning a timetable before building it in the Timetable page's drag-and-drop UI |

Every column here is checked against its page's actual import parser each time
either changes — if you add/rename a field in `studentImport.ts`,
`ImportDataPage.tsx`'s staff handler, or `BursarImportPage.tsx`'s column specs,
update the matching template here too so a downloaded file never falls out of
sync with what the importer actually accepts.

## Notes
- Keep column headers exactly as shown
- Date format: YYYY-MM-DD (e.g. 2026-02-15)
- Amounts in UGX as whole numbers (no commas, no decimals)
- gender: Male or Female
- student_type: day or boarder
- term: 1, 2, or 3
- qualification_level (staff): 1–7, matching StaffRegistrationWizard's QUAL_LEVELS scale
  (1 Certificate → 7 PhD/Doctorate)
- admission_number (students/fee payments): optional — leave blank to let the
  system auto-generate `STU/{year}/{seq}`; if provided, it's used exactly as
  typed and skips name-based matching
- day (timetable): Monday, Tuesday, Wednesday, Thursday, or Friday
- start_time / end_time (timetable): 24-hour HH:MM
- timetable_import_template.csv is reference-only — there's no bulk-upload for
  timetables yet, so use it to plan the week's slots before entering them in
  the app's Timetable drag-and-drop UI
