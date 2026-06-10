/**
 * Canonical column lists for every table Shule queries.
 * ALWAYS use these — never pass '*' to .select()
 * Selecting * returns all columns including large text fields
 * on every query, which is slow on Ugandan mobile connections.
 */
export const COLUMNS = {
  students: 'id, school_id, admission_number, first_name, last_name, class_id, stream_id, gender, status, enrolled_at, photo_url',
  students_list: 'id, admission_number, first_name, last_name, class_id, stream_id, status',
  staff: 'id, school_id, staff_number, first_name, last_name, role, department_id, is_active',
  staff_list: 'id, first_name, last_name, role, is_active',
  exam_results: 'id, exam_journal_id, student_id, subject_id, score, grade, term, year, teacher_id',
  exam_journal: 'id, teacher_id, subject_id, class_id, stream_id, assessment_type, name, date_given, total_marks, pass_mark, term, year',
  attendance: 'id, student_id, class_id, date, status, recorded_by',
  messages: 'id, from_user_id, to_user_id, body, sent_at, read_at',
  classes: 'id, name, level, academic_year_id',
  streams: 'id, class_id, name, class_teacher_id',
} as const

export type ColumnSet = keyof typeof COLUMNS

/** Standard page size — never fetch more than this at once */
export const PAGE_SIZE = 50

/**
 * Build a Supabase range for pagination.
 * @example supabase.from('students').select(...).range(...pageRange(0))
 */
export function pageRange(page: number): [number, number] {
  const from = page * PAGE_SIZE
  return [from, from + PAGE_SIZE - 1]
}
