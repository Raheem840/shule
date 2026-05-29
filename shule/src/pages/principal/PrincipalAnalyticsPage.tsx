import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useDosOverview } from '../../hooks/useDos'
import {
  useSchoolFeeSummary,
  useAllClassPerformance,
  useAttendanceByClass,
  useGenderEnrollment,
  useStaffRoleBreakdown,
  useMonthlyDiscipline,
  usePrincipalKpis,
} from '../../hooks/usePrincipal'
import { useFeeCollectionByClass, ugx } from '../../hooks/useFeePayments'
import { ROLE_LABEL } from '../../config/roleNav'
import type { UserRole } from '../../store/AuthContext'

// Design system hex values (Recharts can't read CSS vars)
const C = {
  brand:   '#0d9488',
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#f43f5e',
  info:    '#0ea5e9',
  violet:  '#8b5cf6',
  amber:   '#f59e0b',
  txt3:    '#94a3b8',
  border:  '#e2e8f0',
}

const GENDER_COLORS  = [C.brand, C.violet, C.txt3]
const STAFF_COLORS   = [C.brand, C.info, C.violet, C.warning, C.success, C.danger, C.txt3]

function ugxCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ── Shared card wrapper ────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   'var(--surface)',
  border:       '1px solid var(--border)',
  borderRadius: 14,
  padding:      20,
}

// ── Class heatmap ──────────────────────────────────────────────────────────
type ClassPerf = ReturnType<typeof useAllClassPerformance>['data'] extends (infer T)[] | undefined ? T : never

function heatPalette(passRate: number | null) {
  if (passRate == null)  return { bg: '#94a3b808', border: C.txt3,    text: C.txt3    }
  if (passRate >= 80)    return { bg: '#10b98112', border: C.success,  text: C.success  }
  if (passRate >= 60)    return { bg: '#f59e0b12', border: C.warning,  text: C.warning  }
  return                        { bg: '#f43f5e12', border: C.danger,   text: C.danger   }
}

function ClassHeatmap({ classes }: { classes: ClassPerf[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10,
      }}>
        {classes.map(cls => {
          const pal = heatPalette(cls.passRate)
          return (
            <div key={cls.classId} style={{
              background:   pal.bg,
              border:       `1.5px solid ${pal.border}`,
              borderRadius: 12,
              padding:      '14px 10px',
              display:      'flex',
              flexDirection:'column',
              alignItems:   'center',
              gap:          4,
              transition:   'transform 0.15s',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {cls.className}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font3)', color: pal.text, lineHeight: 1 }}>
                {cls.passRate != null ? `${cls.passRate}%` : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--txt3)' }}>
                {cls.studentCount} students
              </div>
              {cls.avgScore != null && (
                <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                  avg {cls.avgScore}
                </div>
              )}
              {cls.passRate != null && (
                <div style={{ width: '100%', height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2, marginTop: 2 }}>
                  <div style={{ width: `${cls.passRate}%`, height: 3, background: pal.border, borderRadius: 2 }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--txt3)' }}>
        {[
          { color: C.success, label: '≥ 80%  Good'      },
          { color: C.warning, label: '60–79%  Fair'      },
          { color: C.danger,  label: '< 60%  Needs help' },
          { color: C.txt3,    label: 'No data'           },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── KPI tile ───────────────────────────────────────────────────────────────
function KpiTile({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: 'var(--font3)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Chart container ────────────────────────────────────────────────────────
function ChartCard({ title, children, height = 240 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>{title}</div>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

// ── Spinner wrapper ────────────────────────────────────────────────────────
function Loading() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function PrincipalAnalyticsPage() {
  const [tab, setTab] = useState<'academic' | 'attendance' | 'finance'>('academic')
  const currentYear = new Date().getFullYear()

  const { data: kpis,       isLoading: kpisLoading       } = usePrincipalKpis()
  const { data: dos,        isLoading: dosLoading         } = useDosOverview()
  const { data: classPerf,  isLoading: classPerfLoading   } = useAllClassPerformance()
  const { data: attByClass, isLoading: attLoading         } = useAttendanceByClass()
  const { data: gender,     isLoading: genderLoading      } = useGenderEnrollment()
  const { data: staffRoles, isLoading: staffRolesLoading  } = useStaffRoleBreakdown()
  const { data: discipline, isLoading: disciplineLoading  } = useMonthlyDiscipline()
  const { data: fees,       isLoading: feesLoading        } = useSchoolFeeSummary()
  const { data: byClass,    isLoading: byClassLoading     } = useFeeCollectionByClass(1, currentYear)

  const TABS = [
    { key: 'academic',   label: 'Academic'   },
    { key: 'attendance', label: 'Attendance' },
    { key: 'finance',    label: 'Finance'    },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Analytics"
        subtitle="School-wide performance, attendance, and finance at a glance."
      />

      {/* Tab bar */}
      <div className="sui-tab-list-pill">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`sui-tab-pill${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ACADEMIC ─────────────────────────────────────────────────────── */}
      {tab === 'academic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI row */}
          {kpisLoading
            ? <Loading />
            : kpis && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <KpiTile label="Overall Pass Rate"    value={`${kpis.overallPassRate}%`}        color={C.brand}   />
                <KpiTile label="Active Students"      value={kpis.totalStudents}                 color="var(--txt)"/>
                <KpiTile label="Active Staff"         value={kpis.totalStaff}                    color={C.info}    />
                <KpiTile label="Report Cards Pending" value={kpis.pendingReportCards}            color={C.warning} />
              </div>
            )
          }

          {/* Class performance heatmap */}
          {classPerfLoading
            ? <Loading />
            : (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>
                  Class Pass Rate Heatmap
                </div>
                {!classPerf?.length ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
                    Class performance data will appear once teachers enter and publish exam marks.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 16 }}>
                      Each tile shows the pass rate across all recorded exams for that class.
                    </div>
                    <ClassHeatmap classes={classPerf} />
                  </>
                )}
              </div>
            )
          }

          {/* Pass rate trend + Gender enrollment */}
          {dosLoading || genderLoading
            ? <Loading />
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
                <div style={card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>Pass Rate Trend</div>
                  {!dos?.passRateTrend.length ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
                      Pass rate trend will appear once exam results are published.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={dos.passRateTrend} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.txt3 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.txt3 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v) => [`${Number(v)}%`, 'Pass Rate']} />
                        <Line type="monotone" dataKey="rate" stroke={C.brand} strokeWidth={2.5} dot={{ r: 4, fill: C.brand }} name="Pass Rate" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div style={card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>Gender Enrollment</div>
                  {!gender?.length ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
                      No student enrollment data yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={gender}
                          dataKey="count"
                          nameKey="gender"
                          cx="50%" cy="50%"
                          outerRadius={72}
                          innerRadius={36}
                          paddingAngle={3}
                          label={({ name, percent = 0 }) => `${name} ${Math.round(percent * 100)}%`}
                        >
                          {gender.map((_, i) => (
                            <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} students`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )
          }

          {/* Subject rankings */}
          {!dosLoading && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>Subject Rankings by Pass Rate</div>
              {!dos?.subjectRankings.length ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
                  Subject rankings will appear once exam results are published.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.min(320, dos.subjectRankings.length * 28 + 40)}>
                  <BarChart
                    data={dos.subjectRankings.slice(0, 12)}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 110 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: C.txt3 }} />
                    <YAxis type="category" dataKey="subjectName" tick={{ fontSize: 11, fill: C.txt3 }} width={110} />
                    <Tooltip formatter={(v) => [`${Number(v)}%`, 'Pass Rate']} />
                    <Bar dataKey="passRate" name="Pass Rate" radius={[0, 5, 5, 0]}>
                      {dos.subjectRankings.slice(0, 12).map((entry, i) => (
                        <Cell key={i} fill={entry.passRate >= 80 ? C.success : entry.passRate >= 60 ? C.brand : C.danger} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE ───────────────────────────────────────────────────── */}
      {tab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI + staff role breakdown side by side */}
          {kpisLoading || staffRolesLoading
            ? <Loading />
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Attendance KPI card */}
                {kpis && (
                  <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>This Week's Attendance</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                      <div style={{
                        fontSize: 56, fontWeight: 900, fontFamily: 'var(--font3)', lineHeight: 1,
                        color: kpis.attendanceRateThisWeek >= 85 ? C.success
                             : kpis.attendanceRateThisWeek >= 70 ? C.warning : C.danger,
                      }}>
                        {kpis.attendanceRateThisWeek}%
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt3)', paddingBottom: 8 }}>school-wide</div>
                    </div>
                    <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99 }}>
                      <div style={{
                        height: 8, borderRadius: 99,
                        width: `${kpis.attendanceRateThisWeek}%`,
                        background: kpis.attendanceRateThisWeek >= 85 ? C.success
                                  : kpis.attendanceRateThisWeek >= 70 ? C.warning : C.danger,
                        transition: 'width 0.5s',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                      {kpis.attendanceRateThisWeek >= 85 ? 'Good — school is well attended this week.'
                       : kpis.attendanceRateThisWeek >= 70 ? 'Fair — some classes may need follow-up.'
                       : 'Below target — attendance needs urgent attention.'}
                    </div>
                  </div>
                )}

                {/* Staff role breakdown */}
                {staffRoles && staffRoles.length > 0 && (
                  <ChartCard title="Staff Role Breakdown" height={200}>
                    <PieChart>
                      <Pie
                        data={staffRoles.map(r => ({ ...r, label: ROLE_LABEL[r.role as UserRole] ?? r.role }))}
                        dataKey="count"
                        nameKey="label"
                        cx="50%" cy="50%"
                        outerRadius={70}
                        innerRadius={32}
                        paddingAngle={2}
                      >
                        {staffRoles.map((_, i) => (
                          <Cell key={i} fill={STAFF_COLORS[i % STAFF_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [`${v}`, name]} />
                      <Legend
                        formatter={(value) => <span style={{ fontSize: 11, color: 'var(--txt2)' }}>{value}</span>}
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ChartCard>
                )}
              </div>
            )
          }

          {/* Attendance by class */}
          {attLoading
            ? <Loading />
            : (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>Attendance by Class — Last 30 Days</div>
                {!attByClass?.length ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
                    Attendance data will appear once teachers start recording daily attendance.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.min(340, attByClass.length * 30 + 40)}>
                    <BarChart
                      data={attByClass}
                      layout="vertical"
                      margin={{ top: 4, right: 20, bottom: 4, left: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: C.txt3 }} />
                      <YAxis type="category" dataKey="className" tick={{ fontSize: 11, fill: C.txt3 }} width={60} />
                      <Tooltip formatter={(v) => [`${Number(v)}%`, 'Attendance']} />
                      <Bar dataKey="rate" name="Attendance" radius={[0, 5, 5, 0]}>
                        {attByClass.map((entry, i) => (
                          <Cell key={i} fill={
                            entry.rate == null ? C.txt3
                            : entry.rate >= 85 ? C.success
                            : entry.rate >= 70 ? C.warning : C.danger
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )
          }

          {/* Monthly discipline trend */}
          {disciplineLoading
            ? <Loading />
            : (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>Discipline Incidents — Last 6 Months</div>
                {!discipline?.length ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
                    No discipline records found for the last 6 months.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={discipline} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.txt3 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.txt3 }} />
                      <Tooltip formatter={(v) => [`${v} incident${Number(v) !== 1 ? 's' : ''}`, '']} />
                      <Bar dataKey="count" name="Incidents" fill={C.warning} radius={[4, 4, 0, 0]}>
                        {discipline.map((entry, i) => (
                          <Cell key={i} fill={entry.count === 0 ? C.txt3 : entry.count >= 5 ? C.danger : C.warning} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )
          }
        </div>
      )}

      {/* ── FINANCE ──────────────────────────────────────────────────────── */}
      {tab === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {feesLoading
            ? <Loading />
            : fees && (
              <>
                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <KpiTile label="Expected"        value={ugx(fees.totalExpected)}   color="var(--txt2)" />
                  <KpiTile label="Collected"        value={ugx(fees.totalCollected)}  color={C.success}   />
                  <KpiTile label="Outstanding"      value={ugx(fees.outstanding)}     color={C.danger}    />
                  <KpiTile
                    label="Collection Rate"
                    value={fees.totalExpected > 0 ? `${Math.round((fees.totalCollected / fees.totalExpected) * 100)}%` : '—'}
                    color={C.brand}
                    sub={`${fees.overdueCount} ${fees.overdueCount === 1 ? 'account' : 'accounts'} with balance`}
                  />
                </div>

                {/* Pie + by-class bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                  <ChartCard title="Collection Overview" height={220}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Collected',   value: fees.totalCollected },
                          { name: 'Outstanding', value: fees.outstanding    },
                        ]}
                        dataKey="value"
                        cx="50%" cy="50%"
                        outerRadius={75}
                        innerRadius={36}
                        paddingAngle={4}
                        label={({ name, percent = 0 }) => `${name} ${Math.round(percent * 100)}%`}
                      >
                        <Cell fill={C.success} />
                        <Cell fill={C.danger}  />
                      </Pie>
                      <Tooltip formatter={(v) => [ugx(Number(v)), '']} />
                    </PieChart>
                  </ChartCard>

                  {byClassLoading
                    ? <div style={card}><Loading /></div>
                    : (
                      <div style={card}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>
                          {`Fees by Class — Term 1 ${currentYear}`}
                        </div>
                        {!byClass?.length ? (
                          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
                            No fee payment data for Term 1 {currentYear} yet.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={byClass.map(c => ({ name: c.className, collected: c.collected, outstanding: c.outstanding }))}
                              margin={{ top: 4, right: 12, bottom: 4, left: 10 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.txt3 }} />
                              <YAxis tickFormatter={ugxCompact} tick={{ fontSize: 9, fill: C.txt3 }} />
                              <Tooltip formatter={(v) => [ugx(Number(v)), '']} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Bar dataKey="collected"   name="Collected"   fill={C.success} radius={[4, 4, 0, 0]} />
                              <Bar dataKey="outstanding" name="Outstanding" fill={C.danger}  radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    )
                  }
                </div>

                {/* Fee structure vs collections — running total donut with text */}
                <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>Fee Collection Health</div>
                    {[
                      { label: 'Collected',   value: fees.totalCollected, color: C.success },
                      { label: 'Outstanding', value: fees.outstanding,    color: C.danger  },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                          {row.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: row.color, fontFamily: 'var(--font3)' }}>
                          {ugx(row.value)}
                        </span>
                      </div>
                    ))}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99 }}>
                        <div style={{
                          height: 8, borderRadius: 99,
                          width: fees.totalExpected > 0 ? `${Math.round((fees.totalCollected / fees.totalExpected) * 100)}%` : '0%',
                          background: `linear-gradient(90deg, ${C.success}, ${C.brand})`,
                          transition: 'width 0.6s',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
                        {fees.totalExpected > 0
                          ? `${Math.round((fees.totalCollected / fees.totalExpected) * 100)}% of expected fees collected`
                          : 'No fee structure configured yet.'}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )
          }
        </div>
      )}
    </div>
  )
}
