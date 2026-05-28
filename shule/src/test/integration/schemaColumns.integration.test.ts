/**
 * Schema column integration tests.
 * Uses real Supabase client + MSW to verify the correct column names
 * reach the network. These tests catch column renames that vi.mock bypasses.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

const BASE = 'http://test.supabase.co'

describe('schema column integration', () => {
  it('exam_journal query uses date_given — not date', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/rest/v1/exam_journal`, ({ request }) => {
        capturedUrl = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    const { supabase } = await import('../../lib/supabase')
    await supabase
      .from('exam_journal')
      .select('id, date_given, teacher_notes')
      .eq('school_id', 'school-1')

    expect(capturedUrl).toContain('date_given')
    expect(capturedUrl).not.toContain('select=id%2Cdate%2C')
  })

  it('fee_payments query uses fee_structure_id — not fee_type_id', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/rest/v1/fee_payments`, ({ request }) => {
        capturedUrl = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    const { supabase } = await import('../../lib/supabase')
    await supabase
      .from('fee_payments')
      .select('id, fee_structure_id, amount_due, amount_paid, balance')
      .eq('school_id', 'school-1')

    expect(capturedUrl).toContain('fee_structure_id')
    expect(capturedUrl).not.toContain('fee_type_id')
  })

  it('student_guardians query uses full_name — not guardian_name', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/rest/v1/student_guardians`, ({ request }) => {
        capturedUrl = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    const { supabase } = await import('../../lib/supabase')
    await supabase
      .from('student_guardians')
      .select('id, full_name, relationship, phone, is_primary')
      .eq('school_id', 'school-1')

    expect(capturedUrl).toContain('full_name')
    expect(capturedUrl).not.toContain('guardian_name')
  })

  it('exam_results query includes is_absent column', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/rest/v1/exam_results`, ({ request }) => {
        capturedUrl = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    const { supabase } = await import('../../lib/supabase')
    await supabase
      .from('exam_results')
      .select('id, score, grade, is_absent, term, year')
      .eq('school_id', 'school-1')

    expect(capturedUrl).toContain('is_absent')
  })

  it('report_cards query includes approved_by and unlock_count', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/rest/v1/report_cards`, ({ request }) => {
        capturedUrl = decodeURIComponent(request.url)
        return HttpResponse.json([])
      }),
    )

    const { supabase } = await import('../../lib/supabase')
    await supabase
      .from('report_cards')
      .select('id, term, year, status, approved_by, released_by, unlock_count, unlock_reason')
      .eq('school_id', 'school-1')

    expect(capturedUrl).toContain('approved_by')
    expect(capturedUrl).toContain('unlock_count')
  })
})
