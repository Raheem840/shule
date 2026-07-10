import { useState } from 'react'

// Explains the CBC scoring formula used on every report card (calcCBC in
// src/types/app.ts) in plain language — shown collapsed by default under
// each report card in the student/parent portals so it doesn't compete with
// the actual results, but is one tap away when a parent asks "why this grade?"
export function ReportCardCalcExplainer() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '0.85rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', font: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: 'var(--brand-light)', color: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, fontFamily: 'var(--font2)',
          }}>i</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>
            How is this report card calculated?
          </span>
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          padding: '0 1.1rem 1.1rem',
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'calcExplainerIn 0.2s ease',
        }}>
          <style>{`@keyframes calcExplainerIn { from { opacity:0; transform: translateY(-4px) } to { opacity:1; transform:none } }`}</style>

          <ExplainerStep
            n={1}
            title="Continuous Assessment (CA) scores"
            body={
              <>
                Each competency-based assessment is scored on a 0–3 scale:
                <ScoreLegend />
              </>
            }
          />

          <ExplainerStep
            n={2}
            title="CA score converted to a mark out of 20"
            body={
              <>
                <FormulaLine>CA total points ÷ (competencies assessed × 3) × 20 = CA mark /20</FormulaLine>
                <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 4 }}>
                  e.g. 8 points across 3 competencies → 8 ÷ 9 × 20 = <strong>17.8 / 20</strong>
                </div>
              </>
            }
          />

          <ExplainerStep
            n={3}
            title="Add the End-of-Term Exam"
            body={
              <>
                <FormulaLine>CA mark (/20) + Exam score (/80) = Final Total (/100)</FormulaLine>
                <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 4 }}>
                  e.g. 17.8 + 65 = <strong>82.8 / 100</strong>
                </div>
              </>
            }
          />

          <ExplainerStep
            n={4}
            title="Final total maps to a grade"
            body={<GradeTable />}
          />

          <div style={{
            fontSize: 11, color: 'var(--txt3)', lineHeight: 1.6,
            paddingTop: 10, borderTop: '1px dashed var(--border)',
          }}>
            This is the official Uganda CBC (Competency-Based Curriculum) formula used across the school —
            the same calculation is applied to every subject and every student.
          </div>
        </div>
      )}
    </div>
  )
}

function ExplainerStep({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)',
      }}>
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  )
}

function FormulaLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font3)', fontSize: 11.5, fontWeight: 700, color: 'var(--brand)',
      background: 'var(--brand-light)', border: '1px solid rgba(13,148,136,0.18)',
      borderRadius: 8, padding: '6px 10px', display: 'inline-block',
    }}>
      {children}
    </div>
  )
}

const SCORE_LEGEND = [
  { v: 3, label: 'Naturalization / Characterization', sub: 'fully mastered' },
  { v: 2, label: 'Precision / Valuing', sub: 'competent' },
  { v: 1, label: 'Imitation / Receiving', sub: 'entry level' },
  { v: 0, label: 'Not yet demonstrated', sub: 'or absent' },
]

function ScoreLegend() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      {SCORE_LEGEND.map(s => (
        <div key={s.v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
          <span style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font3)',
          }}>{s.v}</span>
          <span style={{ color: 'var(--txt2)' }}>{s.label}</span>
          <span style={{ color: 'var(--txt3)' }}>— {s.sub}</span>
        </div>
      ))}
    </div>
  )
}

const GRADE_ROWS = [
  { grade: 'A', range: '80 – 100', descriptor: 'Exceptional', color: 'var(--success)' },
  { grade: 'B', range: '70 – 79',  descriptor: 'Outstanding',  color: 'var(--info)' },
  { grade: 'C', range: '60 – 69',  descriptor: 'Satisfactory', color: 'var(--warning)' },
  { grade: 'D', range: '50 – 59',  descriptor: 'Basic',        color: '#f97316' },
  { grade: 'E', range: '0 – 49',   descriptor: 'Elementary',   color: 'var(--danger)' },
]

function GradeTable() {
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {GRADE_ROWS.map(r => (
        <div key={r.grade} style={{
          display: 'grid', gridTemplateColumns: '24px 70px 1fr', alignItems: 'center', gap: 8, fontSize: 11.5,
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 6, color: '#fff', fontWeight: 800, fontSize: 10.5,
            background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font2)',
          }}>{r.grade}</span>
          <span style={{ color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{r.range}</span>
          <span style={{ color: 'var(--txt2)' }}>{r.descriptor}</span>
        </div>
      ))}
    </div>
  )
}
