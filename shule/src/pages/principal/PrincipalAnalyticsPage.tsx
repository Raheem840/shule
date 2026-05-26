import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useDosOverview } from '../../hooks/useDos'
import { useSchoolFeeSummary } from '../../hooks/usePrincipal'
import { useFeeCollectionByClass, ugx } from '../../hooks/useFeePayments'

function ugxCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function PrincipalAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'academic' | 'finance'>('academic')
  const currentYear = new Date().getFullYear()

  const { data: dos,  isLoading: dosLoading  } = useDosOverview()
  const { data: fees, isLoading: feesLoading } = useSchoolFeeSummary()
  const { data: byClass = [], isLoading: byClassLoading } = useFeeCollectionByClass(1, currentYear)

  const academicLoading = dosLoading
  const financeLoading  = feesLoading || byClassLoading

  const TABS = [
    { key: 'academic', label: 'Academic' },
    { key: 'finance',  label: 'Finance'  },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Analytics"
        subtitle="School-wide performance and finance trends."
      />

      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={activeTab === t.key ? 'sui-btn-primary' : 'sui-btn-ghost'}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Academic tab */}
      {activeTab === 'academic' && (
        <>
          {academicLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

          {!academicLoading && dos && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Overall Pass Rate',    value: `${dos.overallPassRate}%`, color: 'var(--brand)'   },
                  { label: 'Active Students',       value: dos.totalStudents,          color: 'var(--txt)'    },
                  { label: 'Active Teachers',       value: dos.activeTeachers,         color: 'var(--info)'   },
                  { label: 'Subjects Below 50%',    value: dos.subjectsBelowFifty,     color: 'var(--danger)' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: 'var(--font3)' }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Pass rate trend */}
              {dos.passRateTrend.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>Pass Rate Trend</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dos.passRateTrend} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--txt3)' }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={v => `${Number(v)}%`} />
                      <Line type="monotone" dataKey="rate" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 4 }} name="Pass Rate" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Subject rankings */}
              {dos.subjectRankings.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 16 }}>Subject Rankings by Pass Rate</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dos.subjectRankings.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                      <YAxis type="category" dataKey="subjectName" tick={{ fontSize: 11, fill: 'var(--txt2)' }} width={100} />
                      <Tooltip formatter={v => `${Number(v)}%`} />
                      <Bar dataKey="passRate" name="Pass Rate" fill="var(--brand)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Finance tab */}
      {activeTab === 'finance' && (
        <>
          {financeLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

          {!financeLoading && fees && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Expected',       value: ugx(fees.totalExpected),  color: 'var(--txt2)'    },
                  { label: 'Collected',       value: ugx(fees.totalCollected), color: 'var(--success)' },
                  { label: 'Outstanding',     value: ugx(fees.outstanding),    color: 'var(--danger)'  },
                  { label: 'Collection Rate', value: fees.totalExpected > 0 ? `${Math.round((fees.totalCollected / fees.totalExpected) * 100)}%` : '—', color: 'var(--brand)' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontFamily: 'var(--font3)' }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Pie + bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Collection Overview</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[{ name: 'Collected', value: fees.totalCollected }, { name: 'Outstanding', value: fees.outstanding }]}
                        dataKey="value" cx="50%" cy="50%" outerRadius={70}
                        label={({ name, percent = 0 }) => `${name} ${Math.round(percent * 100)}%`}>
                        <Cell fill="#0d9488" />
                        <Cell fill="#f43f5e" />
                      </Pie>
                      <Legend />
                      <Tooltip formatter={v => ugx(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>By Class (Term 1 {currentYear})</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byClass.map(c => ({ name: c.className, collected: c.collected, outstanding: c.outstanding }))} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--txt3)' }} />
                      <YAxis tickFormatter={ugxCompact} tick={{ fontSize: 9, fill: 'var(--txt3)' }} />
                      <Tooltip formatter={v => ugx(Number(v))} />
                      <Bar dataKey="collected"   name="Collected"   fill="#0d9488" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outstanding" name="Outstanding" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
