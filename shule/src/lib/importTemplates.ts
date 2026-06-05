/**
 * Import template generator — produces a downloadable CSV with correct
 * column headers and realistic example rows for each import type.
 */

type TemplateType = 'students' | 'staff'

const STUDENT_TEMPLATE = {
  headers: [
    'first_name',
    'last_name',
    'dob',
    'gender',
    'class_name',
    'stream_name',
    'student_type',
    'nationality',
    'religion',
    'previous_school',
  ],
  rows: [
    ['Aisha', 'Nakamya', '2010-03-14', 'Female', 'S1', 'East', 'day', 'Ugandan', 'Islam', 'Kampala Preparatory School'],
    ['Brian', 'Ssemakula', '2009-07-22', 'Male', 'S2', 'West', 'boarder', 'Ugandan', 'Catholic', "St. Mary's Primary School"],
    ['Grace', 'Apolot', '2011-01-08', 'Female', 'S1', 'North', 'day', 'Ugandan', 'Protestant', 'Soroti Primary School'],
  ],
}

const STAFF_TEMPLATE = {
  headers: [
    'first_name',
    'last_name',
    'role',
    'email',
    'phone',
    'national_id',
    'employment_type',
    'department_name',
    'qualification_level',
    'qualification_title',
  ],
  rows: [
    ['Prossy', 'Nantume', 'teacher', 'p.nantume@school.ug', '0772123456', 'CM90123456QWBA', 'full_time', 'Sciences', 'Bachelor', 'Bachelor of Science Education'],
    ['Ronald', 'Okello', 'class_teacher', 'r.okello@school.ug', '0753987654', 'CF88234567RWCA', 'full_time', 'Languages', 'Bachelor', 'Bachelor of Arts Education'],
    ['Fatuma', 'Nabwire', 'dos', 'f.nabwire@school.ug', '0701456789', 'CM92345678STDA', 'full_time', '', 'Masters', 'Master of Education'],
  ],
}

function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(',')),
  ]
  return lines.join('\r\n')
}

function triggerDownload(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  // UTF-8 BOM — Excel on Windows needs this to open CSV correctly
  const bom = '﻿'
  const blob = new Blob([bom + content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function generateImportTemplate(type: TemplateType): void {
  if (type === 'students') {
    const csv = buildCsv(STUDENT_TEMPLATE.headers, STUDENT_TEMPLATE.rows)
    triggerDownload('shule_student_import_template.csv', csv)
  } else {
    const csv = buildCsv(STAFF_TEMPLATE.headers, STAFF_TEMPLATE.rows)
    triggerDownload('shule_staff_import_template.csv', csv)
  }
}
