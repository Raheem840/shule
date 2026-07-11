/**
 * Import template generator — produces downloadable CSV with correct
 * column headers and realistic example rows for each import type.
 */

type TemplateType = 'students' | 'staff'

export function generateImportTemplate(type: TemplateType): void {
  // Use pre-built static templates with 15-25 realistic Ugandan records
  const staticFile = type === 'students'
    ? '/templates/students_import_template.csv'
    : '/templates/staff_import_template.csv'
  const filename = type === 'students'
    ? 'shule_student_import_template.csv'
    : 'shule_staff_import_template.csv'

  const a = document.createElement('a')
  a.href     = staticFile
  a.download = filename
  a.click()
}

/** Download the pre-built fee payments template (matches BursarImportPage's REQUIRED/OPTIONAL columns exactly) */
export function downloadFeeTemplate(): void {
  const a = document.createElement('a')
  a.href     = '/templates/fee_payments_import_template.csv'
  a.download = 'shule_fee_payments_template.csv'
  a.click()
}

/** Download the pre-built timetable reference template (10 rows, two classes) — reference only, no bulk-upload exists yet */
export function downloadTimetableTemplate(): void {
  const a = document.createElement('a')
  a.href     = '/templates/timetable_import_template.csv'
  a.download = 'shule_timetable_template.csv'
  a.click()
}
