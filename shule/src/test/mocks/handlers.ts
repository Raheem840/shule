import { http, HttpResponse } from 'msw'

const BASE = 'http://test.supabase.co'

export const handlers = [
  // exam_journal — returns schema-correct row with date_given (not date)
  http.get(`${BASE}/rest/v1/exam_journal`, () =>
    HttpResponse.json([{
      id:               'j-1',
      school_id:        'school-1',
      teacher_id:       't-1',
      subject_id:       'sub-1',
      class_id:         'cls-1',
      stream_id:        null,
      academic_year_id: null,
      assessment_type:  'mid_term',
      name:             'Mid-Term Test',
      date_given:       '2025-06-10',
      teacher_notes:    null,
      total_marks:      80,
      pass_mark:        40,
      term:             '1',
      year:             2025,
      status:           'draft',
      ca_label:         null,
      ca_component:     null,
      ca_weighting:     null,
      learning_area:    null,
      competency:       null,
      integration_theme: null,
      trade_area:       null,
      dit_module_code:  null,
    }]),
  ),

  // exam_results — includes is_absent column
  http.get(`${BASE}/rest/v1/exam_results`, () =>
    HttpResponse.json([{
      id:              'res-1',
      school_id:       'school-1',
      exam_journal_id: 'j-1',
      student_id:      'stu-1',
      subject_id:      'sub-1',
      teacher_id:      't-1',
      score:           72,
      grade:           'B',
      is_absent:       false,
      term:            '1',
      year:            2025,
    }]),
  ),

  // fee_payments — fee_structure_id (not fee_type_id)
  http.get(`${BASE}/rest/v1/fee_payments`, () =>
    HttpResponse.json([{
      id:               'pay-1',
      school_id:        'school-1',
      student_id:       'stu-1',
      fee_structure_id: 'fs-1',
      academic_year_id: null,
      amount_due:       400000,
      amount_paid:      200000,
      balance:          200000,
      payment_date:     '2025-06-01',
      receipt_number:   'RCP-001',
      term:             1,
      year:             2025,
      notes:            null,
      imported:         false,
      created_by:       null,
    }]),
  ),

  // student_guardians — full_name (not guardian_name)
  http.get(`${BASE}/rest/v1/student_guardians`, () =>
    HttpResponse.json([{
      id:              'g-1',
      school_id:       'school-1',
      student_id:      'stu-1',
      full_name:       'Mary Nakato',
      relationship:    'mother',
      phone:           '0700111222',
      email:           null,
      do_not_contact:  false,
      is_primary:      true,
      comms_preference: 'sms',
    }]),
  ),

  // report_cards — term as TEXT
  http.get(`${BASE}/rest/v1/report_cards`, () =>
    HttpResponse.json([{
      id:                'rc-1',
      school_id:         'school-1',
      student_id:        'stu-1',
      term:              '1',
      year:              2025,
      status:            'ready',
      principal_remarks: null,
      generated_at:      '2025-06-01T10:00:00Z',
      approved_at:       null,
      approved_by:       null,
      released_at:       null,
      released_by:       null,
      unlock_reason:     null,
      unlock_count:      0,
      pdf_url:           'https://storage.url/rc-1.pdf',
    }]),
  ),
]
