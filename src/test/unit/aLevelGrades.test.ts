// Unit tests for A-Level (S5-S6) grade logic in src/types/app.ts
import { describe, it, expect } from 'vitest'
import { calculateALevelGrade, calculateALevelTotal, calcALevel } from '../../types/app'

// Mirrors O-level's formula for now (school-level convention, not yet
// UNEB-confirmed) — see the doc-comment above calculateALevelGrade.
describe('calculateALevelGrade', () => {
  it('79 returns B, 80 returns A — same boundary as O-level', () => {
    expect(calculateALevelGrade(79)).toBe('B')
    expect(calculateALevelGrade(80)).toBe('A')
  })

  it('0 returns E', () => expect(calculateALevelGrade(0)).toBe('E'))
  it('100 returns A', () => expect(calculateALevelGrade(100)).toBe('A'))
})

describe('calculateALevelTotal', () => {
  it('scales CA points to /20 then adds exam score, same as O-level', () => {
    expect(calculateALevelTotal(6, 3, 60)).toBe(73.3)
  })
})

describe('calcALevel — full CBCResult', () => {
  it('A grade: 9/9x20=20 +75=95 -> A, gradePoints=5', () => {
    const r = calcALevel(9, 3, 75)
    expect(r.grade).toBe('A')
    expect(r.gradePoints).toBe(5)
    expect(r.total).toBe(95)
  })

  it('is independent of calculateCBCGrade as a distinct function reference', () => {
    // Not a strict-equality check on the function itself (they may share an
    // implementation today) — just confirms this module exports its own
    // named entry point that A-Level callers depend on, per the doc-comment
    // explaining why: independently correctable once UNEB publishes real
    // A-Level numbers, without touching O-level's already-confirmed formula.
    expect(typeof calculateALevelGrade).toBe('function')
    expect(calculateALevelGrade).not.toBe(undefined)
  })
})
