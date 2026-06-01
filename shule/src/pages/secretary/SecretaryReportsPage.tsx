import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { Modal } from '../../components/ui/Modal'
import { AttendanceHeatmap } from '../../components/shared/AttendanceHeatmap'

const C = {
  brand:   '#0d9488',
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#f43f5e',
  info:    '#0ea5e9',
  violet:  '#8b5cf6',
  txt3:    '#94a3b8',
  border:  '#e2e8f0',
}

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 12,
  color: '#0f172a',
}

// ─── Print helper — clones report into body, prints, then cleans up ──────────
function printReport(elementId: string) {
  const el = document.getElementById(elementId)
  if (!el) return
  const clone = el.cloneNode(true) as HTMLElement
  clone.id = 'print-root'
  document.body.appendChild(clone)
  document.body.classList.add('printing-report')
  const cleanup = () => {
    document.body.classList.remove('printing-report')
    clone.remove()
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}

// ─── Report definitions ─────────────────────────────────────────────────────
interface ReportDef {
  id:          number
  name:        string
  description: string
  iconPath:    string
  accent:      string
}

const REPORTS: ReportDef[] = [
  {
    id:          1,
    name:        'Student Register',
    description: 'All active students grouped by class with admission details',
    iconPath:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
    accent:      C.brand,
  },
  {
    id:          2,
    name:        'Enrolment Statistics',
    description: 'Students by class and gender breakdown charts',
    iconPath:    'M18 20V10M12 20V4M6 20v-6',
    accent:      C.info,
  },
  {
    id:          3,
    name:        'Staff Register',
    description: 'All active staff with role, employment type, and join date',
    iconPath:    'M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z',
    accent:      C.violet,
  },
  {
    id:          4,
    name:        'Attendance Summary',
    description: 'Class-level attendance heatmap over the last 30 days',
    iconPath:    'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
    accent:      C.success,
  },
  {
    id:          5,
    name:        'Report Card Pipeline',
    description: 'Per-class: draft, ready, approved, released, and completion %',
    iconPath:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 3h6v4H9z',
    accent:      C.warning,
  },
  {
    id:          6,
    name:        'Fee Status Summary',
    description: 'Counts only — paid / partial / unpaid per class. No amounts.',
    iconPath:    'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
    accent:      C.success,
  },
  {
    id:          7,
    name:        'Guardian Contact List',
    description: 'Guardian names, relationships, phones. Exportable to Excel.',
    iconPath:    'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.06 1.18 2 2 0 012 .02h3a2 2 0 012 1.72',
    accent:      C.violet,
  },
  {
    id:          8,
    name:        'New Students This Term',
    description: 'Students enrolled this term with guardian and enrolment date',
    iconPath:    'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M19 8v6M22 11h-6M9 11a4 4 0 100-8 4 4 0 000 8z',
    accent:      C.brand,
  },
]

// ─── Report card tile ───────────────────────────────────────────────────────
function ReportCard({ report, onGenerate }: { report: ReportDef; onGenerate: () => void }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'box-shadow 0.18s, transform 0.18s',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLDivElement
      el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
      el.style.transform  = 'translateY(-2px)'
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLDivElement
      el.style.boxShadow = 'none'
      el.style.transform  = 'none'
    }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${report.accent}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={report.accent} strokeWidth="2"
          width="18" height="18" strokeLinecap="round" strokeLinejoin="round">
          <path d={report.iconPath} />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14,
          color: 'var(--txt)', marginBottom: 4,
        }}>
          {report.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.5 }}>
          {report.description}
        </div>
      </div>
      <button
        onClick={onGenerate}
        style={{
          alignSelf: 'flex-start',
          padding: '7px 16px',
          borderRadius: 8,
          border: 'none',
          background: report.accent,
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Generate
      </button>
    </div>
  )
}

// ─── Shared print/download helpers ──────────────────────────────────────────
async function downloadReportPdf(elementId: string, filename: string) {
  const el = document.getElementById(elementId)
  if (!el) return
  // Temporarily hide action buttons so they don't appear in PDF
  const actions = el.querySelector('.rpt-actions') as HTMLElement | null
  if (actions) actions.style.display = 'none'
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF }       = await import('jspdf')
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const w      = pdf.internal.pageSize.getWidth()
  const h      = (canvas.height / canvas.width) * w
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
  pdf.save(filename)
  if (actions) actions.style.display = ''
}

function ReportActions({ elementId, filename }: { elementId: string; filename: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="rpt-actions" style={{
      display: 'flex', gap: 8, marginBottom: 16,
      paddingBottom: 12, borderBottom: '1px solid var(--border)',
    }}>
      <button
        onClick={() => printReport(elementId)}
        style={{
          padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface)', fontSize: 12, fontWeight: 700,
          color: 'var(--txt)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print
      </button>
      <button
        onClick={async () => {
          setBusy(true)
          await downloadReportPdf(elementId, filename)
          setBusy(false)
        }}
        disabled={busy}
        style={{
          padding: '7px 14px', borderRadius: 8, border: 'none',
          background: C.brand, color: '#fff', fontSize: 12,
          fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.7 : 1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {busy ? 'Generating…' : 'Download PDF'}
      </button>
    </div>
  )
}

// ─── Empty-state row ─────────────────────────────────────────────────────────
function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '24px 10px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
        No records found
      </td>
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 1 — Student Register
// ═══════════════════════════════════════════════════════════════════════════
function useReport1Data() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rpt-student-register', user?.schoolId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const [studRes, classRes, streamRes] = await Promise.all([
        supabase.from('students')
          .select('id, admission_number, first_name, last_name, class_id, stream_id, status')
          .eq('school_id', sid)
          .eq('status', 'active')
          .order('last_name', { ascending: true }),
        supabase.from('classes').select('id, name').eq('school_id', sid),
        supabase.from('streams').select('id, name, class_id').eq('school_id', sid),
      ])
      const classMap  = new Map((classRes.data ?? []).map((c: any) => [c.id, c.name]))
      const streamMap = new Map((streamRes.data ?? []).map((s: any) => [s.id, s.name]))
      const students = (studRes.data ?? []).map((s: any) => ({
        id:         s.id,
        admNo:      s.admission_number,
        name:       `${s.first_name} ${s.last_name}`,
        className:  classMap.get(s.class_id) ?? '—',
        streamName: streamMap.get(s.stream_id) ?? '—',
        status:     s.status,
      }))
      const groups = new Map<string, typeof students>()
      for (const s of students) {
        if (!groups.has(s.className)) groups.set(s.className, [])
        groups.get(s.className)!.push(s)
      }
      return { groups: Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)), total: students.length }
    },
  })
}

function Report1Content() {
  const { data, isLoading } = useReport1Data()
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  const groups = data?.groups ?? []
  const total  = data?.total ?? 0
  return (
    <div id="rpt-1" style={{ fontFamily: 'var(--font, system-ui)', color: '#0f172a' }}>
      <ReportActions elementId="rpt-1" filename="StudentRegister.pdf" />
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>Student Register</h2>
          <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
            Active students — {total} total · {new Date().toLocaleDateString('en-GB')}
          </div>
        </div>
      </div>
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
          No active students registered yet.
        </div>
      ) : groups.map(([className, students]) => (
        <div key={className} style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13,
            color: C.brand, marginBottom: 6, paddingBottom: 4,
            borderBottom: '2px solid #e2e8f0',
          }}>
            {className} ({students.length} students)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', 'Adm No', 'Name', 'Stream', 'Status'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                  <td style={{ padding: '7px 10px', fontSize: 11, color: '#94a3b8' }}>{i + 1}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'monospace', color: 'var(--txt2)' }}>{s.admNo}</td>
                  <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12 }}>{s.streamName}</td>
                  <td style={{ padding: '7px 10px', fontSize: 11 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6,
                      background: s.status === 'active' ? '#ecfdf5' : '#fff1f2',
                      color: s.status === 'active' ? C.success : C.danger,
                      fontWeight: 700,
                    }}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 2 — Enrolment Statistics
// ═══════════════════════════════════════════════════════════════════════════
function useReport2Data() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rpt-enrolment-stats', user?.schoolId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const [studRes, classRes] = await Promise.all([
        supabase.from('students').select('id, class_id, gender, status').eq('school_id', sid).eq('status', 'active'),
        supabase.from('classes').select('id, name').eq('school_id', sid),
      ])
      const classMap = new Map((classRes.data ?? []).map((c: any) => [c.id, c.name]))
      const byClass  = new Map<string, { M: number; F: number; other: number }>()
      for (const s of studRes.data ?? []) {
        const row = s as any
        const cn  = classMap.get(row.class_id) ?? 'Unknown'
        if (!byClass.has(cn)) byClass.set(cn, { M: 0, F: 0, other: 0 })
        const g = row.gender as string | null
        const entry = byClass.get(cn)!
        if (g === 'male')        entry.M++
        else if (g === 'female') entry.F++
        else                     entry.other++
      }
      const byClassArr = Array.from(byClass.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, v]) => ({ name, total: v.M + v.F + v.other, M: v.M, F: v.F }))
      const totalStudents = byClassArr.reduce((acc, r) => acc + r.total, 0)
      const totalMale     = byClassArr.reduce((acc, r) => acc + r.M, 0)
      const totalFemale   = byClassArr.reduce((acc, r) => acc + r.F, 0)
      return { byClassArr, totalStudents, totalMale, totalFemale }
    },
  })
}

function Report2Content() {
  const { data, isLoading } = useReport2Data()
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  const byClassArr     = data?.byClassArr ?? []
  const totalStudents  = data?.totalStudents ?? 0
  const totalMale      = data?.totalMale ?? 0
  const totalFemale    = data?.totalFemale ?? 0
  return (
    <div id="rpt-2">
      <ReportActions elementId="rpt-2" filename="EnrolmentStatistics.pdf" />
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>Enrolment Statistics</h2>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 16 }}>
        {totalStudents} total active students · {totalMale} male · {totalFemale} female · {new Date().toLocaleDateString('en-GB')}
      </div>
      {byClassArr.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
          No enrolment data available yet.
        </div>
      ) : (
        <>
          {/* Summary table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Class', 'Male', 'Female', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byClassArr.map((row, i) => (
                <tr key={row.name} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                  <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 700 }}>{row.name}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, color: C.info }}>{row.M}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, color: C.violet }}>{row.F}</td>
                  <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700 }}>{row.total}</td>
                </tr>
              ))}
              <tr style={{ background: '#f0fdfa', borderTop: '2px solid #e2e8f0' }}>
                <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 800, color: C.brand }}>TOTAL</td>
                <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.info }}>{totalMale}</td>
                <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.violet }}>{totalFemale}</td>
                <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 800 }}>{totalStudents}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 700, marginBottom: 8 }}>Students per Class</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byClassArr} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.txt3 }} />
                <YAxis tick={{ fontSize: 10, fill: C.txt3 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill={C.brand} radius={[4, 4, 0, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 700, marginBottom: 8 }}>Gender Breakdown per Class</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byClassArr} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.txt3 }} />
              <YAxis tick={{ fontSize: 10, fill: C.txt3 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="M" fill={C.info}   name="Male"   radius={[2, 2, 0, 0]} />
              <Bar dataKey="F" fill={C.violet} name="Female" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 3 — Staff Register
// ═══════════════════════════════════════════════════════════════════════════
function useReport3Data() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rpt-staff-register', user?.schoolId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, staff_number, first_name, last_name, role, employment_type, join_date')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .order('last_name', { ascending: true })
      return (data ?? []).map((s: any) => ({
        id:      s.id,
        staffNo: s.staff_number ?? '—',
        name:    `${s.first_name} ${s.last_name}`,
        role:    (s.role as string).replace('_', ' '),
        empType: s.employment_type ?? '—',
        joinDate: s.join_date ? new Date(s.join_date).toLocaleDateString('en-GB') : '—',
      }))
    },
  })
}

function Report3Content() {
  const { data = [], isLoading } = useReport3Data()
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  return (
    <div id="rpt-3">
      <ReportActions elementId="rpt-3" filename="StaffRegister.pdf" />
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>Staff Register</h2>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 16 }}>
        {data.length} active staff · {new Date().toLocaleDateString('en-GB')}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['#', 'Staff No', 'Name', 'Role', 'Employment Type', 'Join Date'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? <EmptyRow cols={6} /> : data.map((s, i) => (
            <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
              <td style={{ padding: '7px 10px', fontSize: 11, color: '#94a3b8' }}>{i + 1}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'monospace', color: 'var(--txt2)' }}>{s.staffNo}</td>
              <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, textTransform: 'capitalize' }}>{s.role}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, textTransform: 'capitalize' }}>{s.empType}</td>
              <td style={{ padding: '7px 10px', fontSize: 12 }}>{s.joinDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 4 — Attendance Heatmap
// ═══════════════════════════════════════════════════════════════════════════
function useReport4Data() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rpt-attendance-heatmap', user?.schoolId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const daysAgo30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const [attRes, classRes] = await Promise.all([
        supabase.from('attendance')
          .select('student_id, class_id, status, date')
          .eq('school_id', sid)
          .gte('date', daysAgo30),
        supabase.from('classes').select('id, name').eq('school_id', sid),
      ])
      const classMap = new Map((classRes.data ?? []).map((c: any) => [c.id, c.name]))
      type WeekEntry = { present: number; total: number; label: string }
      const classWeeks = new Map<string, Map<number, WeekEntry>>()
      for (const a of attRes.data ?? []) {
        const row     = a as any
        const d       = new Date(row.date)
        const weekNum = Math.ceil((Date.now() - d.getTime()) / (7 * 86400000))
        const cid     = row.class_id as string
        if (!classWeeks.has(cid)) classWeeks.set(cid, new Map())
        const wm = classWeeks.get(cid)!
        const wLabel = `Week -${weekNum}`
        if (!wm.has(weekNum)) wm.set(weekNum, { present: 0, total: 0, label: wLabel })
        const entry = wm.get(weekNum)!
        entry.total++
        if (row.status === 'present') entry.present++
      }
      const data = Array.from(classWeeks.entries()).map(([cid, wm]) => ({
        classId:   cid,
        className: classMap.get(cid) ?? cid,
        weeks: Array.from(wm.entries()).map(([wn, entry]) => ({
          weekNumber: wn,
          weekLabel:  entry.label,
          rate: entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : null,
        })).sort((a, b) => b.weekNumber - a.weekNumber),
      })).sort((a, b) => a.className.localeCompare(b.className))
      const maxWeeks = Math.max(...data.map(d => d.weeks.length), 4)
      return { data, termWeeks: maxWeeks }
    },
  })
}

function Report4Content() {
  const { data: res, isLoading } = useReport4Data()
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  return (
    <div id="rpt-4">
      <ReportActions elementId="rpt-4" filename="AttendanceSummary.pdf" />
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>Attendance Summary</h2>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 12 }}>
        Last 30 days by class and week · {new Date().toLocaleDateString('en-GB')}
      </div>
      {!res || res.data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
          No attendance records in the last 30 days.
        </div>
      ) : (
        <AttendanceHeatmap data={res.data} termWeeks={res.termWeeks} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 5 — Report Card Pipeline
// ═══════════════════════════════════════════════════════════════════════════
function useReport5Data() {
  const { user } = useAuth()
  const year = new Date().getFullYear()
  return useQuery({
    queryKey: ['rpt-rc-pipeline', user?.schoolId, year],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const [rcRes, studRes, classRes] = await Promise.all([
        supabase.from('report_cards').select('id, student_id, status, term, year').eq('school_id', sid).eq('year', year),
        supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('classes').select('id, name').eq('school_id', sid),
      ])
      const classMap  = new Map((classRes.data ?? []).map((c: any) => [c.id, c.name]))
      const studClass = new Map((studRes.data ?? []).map((s: any) => [s.id, s.class_id]))
      type Row = { total: number; draft: number; ready: number; approved: number; released: number }
      const byClass = new Map<string, Row>()
      for (const c of classRes.data ?? []) byClass.set((c as any).id, { total: 0, draft: 0, ready: 0, approved: 0, released: 0 })
      for (const s of studRes.data ?? []) {
        const row = s as any
        const cid = row.class_id as string
        if (byClass.has(cid)) byClass.get(cid)!.total++
      }
      for (const rc of rcRes.data ?? []) {
        const row   = rc as any
        const cid   = studClass.get(row.student_id) ?? ''
        const entry = byClass.get(cid)
        if (!entry) continue
        const st = row.status as string
        if (st === 'draft')         entry.draft++
        else if (st === 'ready')    entry.ready++
        else if (st === 'approved') entry.approved++
        else if (st === 'released') entry.released++
      }
      return Array.from(byClass.entries())
        .map(([cid, row]) => ({
          classId:    cid,
          className:  classMap.get(cid) ?? cid,
          ...row,
          completion: row.total > 0 ? Math.round(((row.approved + row.released) / row.total) * 100) : 0,
        }))
        .sort((a, b) => a.className.localeCompare(b.className))
    },
  })
}

function Report5Content() {
  const { data = [], isLoading } = useReport5Data()
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  return (
    <div id="rpt-5">
      <ReportActions elementId="rpt-5" filename="ReportCardPipeline.pdf" />
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>Report Card Pipeline</h2>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 16 }}>
        {new Date().getFullYear()} · {data.length} classes
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Class', 'Total', 'Draft', 'Ready', 'Approved', 'Released', 'Completion'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? <EmptyRow cols={7} /> : data.map((row, i) => (
            <tr key={row.classId} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
              <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 700 }}>{row.className}</td>
              <td style={{ padding: '7px 10px', fontSize: 12 }}>{row.total}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: C.txt3 }}>{row.draft}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: C.info }}>{row.ready}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: C.warning }}>{row.approved}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: C.success }}>{row.released}</td>
              <td style={{ padding: '7px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: C.success, width: `${row.completion}%` }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.success, width: 32 }}>{row.completion}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 6 — Fee Status Summary (counts only)
// ═══════════════════════════════════════════════════════════════════════════
function useReport6Data() {
  const { user } = useAuth()
  const year = new Date().getFullYear()
  return useQuery({
    queryKey: ['rpt-fee-status', user?.schoolId, year],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const [feeRes, studRes, classRes] = await Promise.all([
        supabase.from('fee_payments').select('student_id, amount_paid, amount_due').eq('school_id', sid),
        supabase.from('students').select('id, class_id').eq('school_id', sid).eq('status', 'active'),
        supabase.from('classes').select('id, name').eq('school_id', sid),
      ])
      const classMap  = new Map((classRes.data ?? []).map((c: any) => [c.id, c.name]))
      const studClass = new Map((studRes.data ?? []).map((s: any) => [s.id, s.class_id]))
      const studentStatus = new Map<string, 'paid' | 'partial' | 'unpaid'>()
      for (const p of feeRes.data ?? []) {
        const row  = p as any
        const due  = Number(row.amount_due ?? 0)
        const paid = Number(row.amount_paid ?? 0)
        let st: 'paid' | 'partial' | 'unpaid'
        if (due <= 0)         st = 'paid'
        else if (paid >= due) st = 'paid'
        else if (paid > 0)    st = 'partial'
        else                  st = 'unpaid'
        const cur = studentStatus.get(row.student_id)
        if (!cur) { studentStatus.set(row.student_id, st); continue }
        if (cur === 'paid' && st !== 'paid') studentStatus.set(row.student_id, st)
        else if (cur === 'partial' && st === 'unpaid') studentStatus.set(row.student_id, st)
      }
      const byClass = new Map<string, { paid: number; partial: number; unpaid: number; name: string }>()
      for (const [sid2, cls] of studClass.entries()) {
        const cn = classMap.get(cls) ?? 'Unknown'
        if (!byClass.has(cls)) byClass.set(cls, { paid: 0, partial: 0, unpaid: 0, name: cn })
        const st = studentStatus.get(sid2) ?? 'unpaid'
        const entry = byClass.get(cls)!
        if (st === 'paid')         entry.paid++
        else if (st === 'partial') entry.partial++
        else                       entry.unpaid++
      }
      return Array.from(byClass.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(r => ({
          ...r,
          total:   r.paid + r.partial + r.unpaid,
          pctPaid: r.paid + r.partial + r.unpaid > 0
            ? Math.round((r.paid / (r.paid + r.partial + r.unpaid)) * 100) : 0,
        }))
    },
  })
}

function Report6Content() {
  const { data = [], isLoading } = useReport6Data()
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  const totals = data.reduce(
    (acc, r) => ({ paid: acc.paid + r.paid, partial: acc.partial + r.partial, unpaid: acc.unpaid + r.unpaid }),
    { paid: 0, partial: 0, unpaid: 0 }
  )
  return (
    <div id="rpt-6">
      <ReportActions elementId="rpt-6" filename="FeeStatusSummary.pdf" />
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>Fee Status Summary</h2>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Student counts only — no monetary values · {new Date().toLocaleDateString('en-GB')}</div>
      {data.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.txt3 }} />
            <YAxis tick={{ fontSize: 10, fill: C.txt3 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="paid"    fill={C.success} name="Paid"    radius={[2, 2, 0, 0]} />
            <Bar dataKey="partial" fill={C.warning} name="Partial" radius={[2, 2, 0, 0]} />
            <Bar dataKey="unpaid"  fill={C.danger}  name="Unpaid"  radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Class', 'Paid', 'Partial', 'Unpaid', '% Paid'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? <EmptyRow cols={5} /> : data.map((row, i) => (
            <tr key={row.name} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
              <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 700 }}>{row.name}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: C.success, fontWeight: 700 }}>{row.paid}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: C.warning, fontWeight: 700 }}>{row.partial}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: C.danger,  fontWeight: 700 }}>{row.unpaid}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.brand }}>{row.pctPaid}%</td>
            </tr>
          ))}
          {data.length > 0 && (
            <tr style={{ background: '#f0fdfa', borderTop: '2px solid #e2e8f0' }}>
              <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 800, color: C.brand }}>TOTAL</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.success }}>{totals.paid}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.warning }}>{totals.partial}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.danger  }}>{totals.unpaid}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.brand }}>
                {totals.paid + totals.partial + totals.unpaid > 0
                  ? `${Math.round((totals.paid / (totals.paid + totals.partial + totals.unpaid)) * 100)}%`
                  : '—'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 7 — Guardian Contact List
// ═══════════════════════════════════════════════════════════════════════════
function useReport7Data() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rpt-guardians', user?.schoolId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const [guardRes, studRes] = await Promise.all([
        supabase.from('student_guardians')
          .select('id, student_id, full_name, relationship, phone, email, do_not_contact')
          .eq('school_id', sid),
        supabase.from('students')
          .select('id, first_name, last_name, class_id')
          .eq('school_id', sid)
          .eq('status', 'active'),
      ])
      const studMap = new Map((studRes.data ?? []).map((s: any) => [s.id, { name: `${s.first_name} ${s.last_name}`, classId: s.class_id }]))
      const activeStudentIds = new Set(studRes.data?.map((s: any) => s.id) ?? [])
      return (guardRes.data ?? [])
        .filter((g: any) => activeStudentIds.has(g.student_id))
        .map((g: any) => ({
          id:           g.id,
          studentName:  studMap.get(g.student_id)?.name ?? '—',
          guardianName: g.full_name,
          relationship: g.relationship,
          phone:        g.phone ?? '—',
          email:        g.email ?? '—',
          doNotContact: g.do_not_contact as boolean,
        }))
        .sort((a: any, b: any) => a.studentName.localeCompare(b.studentName))
    },
  })
}

async function exportGuardiansToExcel(data: ReturnType<typeof useReport7Data>['data']) {
  if (!data?.length) return
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Guardians')
  ws.columns = [
    { header: 'Student',        key: 'studentName',  width: 22 },
    { header: 'Guardian',       key: 'guardianName', width: 22 },
    { header: 'Relationship',   key: 'relationship', width: 14 },
    { header: 'Phone',          key: 'phone',        width: 16 },
    { header: 'Email',          key: 'email',        width: 26 },
    { header: 'Do Not Contact', key: 'doNotContact', width: 14 },
  ]
  ws.getRow(1).font = { bold: true }
  for (const row of data) ws.addRow(row)
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href = url; a.download = 'GuardianContactList.xlsx'; a.click()
  URL.revokeObjectURL(url)
}

function Report7Content() {
  const { data, isLoading } = useReport7Data()
  const [busy, setBusy] = useState(false)
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  const rows = data ?? []
  return (
    <div id="rpt-7">
      <div className="rpt-actions" style={{ display: 'flex', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => printReport('rpt-7')}
          style={{
            padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', fontSize: 12, fontWeight: 700,
            color: 'var(--txt)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print
        </button>
        <button
          onClick={async () => { setBusy(true); await downloadReportPdf('rpt-7', 'GuardianContacts.pdf'); setBusy(false) }}
          disabled={busy}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: C.brand, color: '#fff', fontSize: 12,
            fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Generating…' : 'Download PDF'}
        </button>
        <button
          onClick={async () => { setBusy(true); await exportGuardiansToExcel(data); setBusy(false) }}
          disabled={busy}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: C.success, color: '#fff', fontSize: 12,
            fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>Guardian Contact List</h2>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 16 }}>
        {rows.length} guardian records · {new Date().toLocaleDateString('en-GB')}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Student', 'Guardian', 'Relationship', 'Phone', 'Email', 'Do Not Contact'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow cols={6} /> : rows.map((g, i) => (
            <tr key={g.id} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
              <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600 }}>{g.studentName}</td>
              <td style={{ padding: '7px 10px', fontSize: 12 }}>{g.guardianName}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, textTransform: 'capitalize' }}>{g.relationship}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'monospace' }}>{g.phone}</td>
              <td style={{ padding: '7px 10px', fontSize: 12 }}>{g.email}</td>
              <td style={{ padding: '7px 10px', fontSize: 12 }}>
                {g.doNotContact
                  ? <span style={{ color: C.danger,  fontWeight: 700 }}>Yes</span>
                  : <span style={{ color: C.success }}>No</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 8 — New Students This Term
// ═══════════════════════════════════════════════════════════════════════════
function useReport8Data() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['rpt-new-students', user?.schoolId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const { data: ayRows } = await supabase
        .from('academic_years')
        .select('id, is_active, term1_start, term1_end, term2_start, term2_end, term3_start, term3_end')
        .eq('school_id', sid)
        .order('start_date', { ascending: false })

      const activeAy = (ayRows ?? []).find((r: any) => r.is_active) ?? (ayRows ?? [])[0] ?? null
      const today    = new Date()
      let termStart: Date | null = null
      if (activeAy) {
        for (const [s, e] of [
          [activeAy.term1_start, activeAy.term1_end],
          [activeAy.term2_start, activeAy.term2_end],
          [activeAy.term3_start, activeAy.term3_end],
        ]) {
          if (!s || !e) continue
          const sd = new Date(s), ed = new Date(e)
          if (today >= sd && today <= ed) { termStart = sd; break }
        }
      }

      const baseDate = termStart
        ? termStart.toISOString().slice(0, 10)
        : new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10)

      const [studRes, classRes, guardRes] = await Promise.all([
        supabase.from('students')
          .select('id, first_name, last_name, class_id, enrolled_at')
          .eq('school_id', sid)
          .gte('enrolled_at', baseDate)
          .order('enrolled_at', { ascending: false }),
        supabase.from('classes').select('id, name').eq('school_id', sid),
        supabase.from('student_guardians')
          .select('student_id, full_name, phone')
          .eq('school_id', sid),
      ])

      const classMap  = new Map((classRes.data ?? []).map((c: any) => [c.id, c.name]))
      const guardMap  = new Map<string, { name: string; phone: string }>()
      for (const g of guardRes.data ?? []) {
        if (!guardMap.has((g as any).student_id)) {
          guardMap.set((g as any).student_id, { name: (g as any).full_name, phone: (g as any).phone ?? '—' })
        }
      }

      return {
        students: (studRes.data ?? []).map((s: any) => ({
          id:            s.id,
          name:          `${s.first_name} ${s.last_name}`,
          className:     classMap.get(s.class_id) ?? '—',
          guardianName:  guardMap.get(s.id)?.name  ?? '—',
          guardianPhone: guardMap.get(s.id)?.phone ?? '—',
          enrolledDate:  new Date(s.enrolled_at).toLocaleDateString('en-GB'),
        })),
        baseDateLabel: termStart
          ? `from ${new Date(baseDate).toLocaleDateString('en-GB')} (term start)`
          : `since ${new Date(baseDate).toLocaleDateString('en-GB')}`,
      }
    },
  })
}

function Report8Content() {
  const { data, isLoading } = useReport8Data()
  if (isLoading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
  const students = data?.students ?? []
  return (
    <div id="rpt-8">
      <ReportActions elementId="rpt-8" filename="NewStudentsThisTerm.pdf" />
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20 }}>New Students This Term</h2>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 16 }}>
        {students.length} new enrolment{students.length !== 1 ? 's' : ''} {data?.baseDateLabel ?? ''} · {new Date().toLocaleDateString('en-GB')}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['#', 'Name', 'Class', 'Guardian', 'Guardian Phone', 'Enrolled'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? <EmptyRow cols={6} /> : students.map((s, i) => (
            <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
              <td style={{ padding: '7px 10px', fontSize: 11, color: '#94a3b8' }}>{i + 1}</td>
              <td style={{ padding: '7px 10px', fontSize: 13, fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '7px 10px', fontSize: 12 }}>{s.className}</td>
              <td style={{ padding: '7px 10px', fontSize: 12 }}>{s.guardianName}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'monospace' }}>{s.guardianPhone}</td>
              <td style={{ padding: '7px 10px', fontSize: 12, color: 'var(--txt2)' }}>{s.enrolledDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Report content renderer ────────────────────────────────────────────────
function ReportContent({ id }: { id: number }) {
  switch (id) {
    case 1: return <Report1Content />
    case 2: return <Report2Content />
    case 3: return <Report3Content />
    case 4: return <Report4Content />
    case 5: return <Report5Content />
    case 6: return <Report6Content />
    case 7: return <Report7Content />
    case 8: return <Report8Content />
    default: return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECRETARY REPORTS PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function SecretaryReportsPage() {
  const [activeReport, setActiveReport] = useState<number | null>(null)
  const activeReportDef = REPORTS.find(r => r.id === activeReport) ?? null

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div className="sui-hero-band">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
            color: 'var(--txt)', margin: 0, letterSpacing: '-0.5px',
          }}>
            Reports
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
            Generate, preview, print and download school reports
          </div>
        </div>
      </div>

      {/* Report grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {REPORTS.map(report => (
          <ReportCard
            key={report.id}
            report={report}
            onGenerate={() => setActiveReport(report.id)}
          />
        ))}
      </div>

      {/* Report modal — full preview with print/download */}
      {activeReport !== null && (
        <Modal
          open={activeReport !== null}
          onClose={() => setActiveReport(null)}
          title={activeReportDef?.name ?? 'Report'}
          size="xl"
        >
          {/* Note: print is handled by popup window — modal itself is not printed */}
          <div style={{ maxHeight: '80vh', overflowY: 'auto', padding: '4px 0' }}>
            <ReportContent id={activeReport} />
          </div>
        </Modal>
      )}
    </div>
  )
}
