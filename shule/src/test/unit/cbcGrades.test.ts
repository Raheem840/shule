// Phase 2 — Unit tests for CBC grade logic in src/types/app.ts
// No mocking needed: app.ts has zero external dependencies.
import { describe, it, expect } from 'vitest'
import { calculateCBCGrade, calculateCBCTotal, calcCBC } from '../../types/app'

// Grade scale: A=90–100, B=75–89, C=65–74, D=50–64, E=0–49
describe('calculateCBCGrade', () => {
  describe('grade E (< 50)', () => {
    it('0 returns E', () => expect(calculateCBCGrade(0)).toBe('E'))
    it('49 returns E — boundary just below D', () => expect(calculateCBCGrade(49)).toBe('E'))
    it('-1 returns E — negative input, no throw', () => expect(calculateCBCGrade(-1)).toBe('E'))
  })

  describe('grade D (50–64)', () => {
    it('50 returns D — start of D', () => expect(calculateCBCGrade(50)).toBe('D'))
    it('64 returns D — end of D', () => expect(calculateCBCGrade(64)).toBe('D'))
  })

  describe('grade C (65–74)', () => {
    it('65 returns C — start of C', () => expect(calculateCBCGrade(65)).toBe('C'))
    it('74 returns C — end of C', () => expect(calculateCBCGrade(74)).toBe('C'))
  })

  describe('grade B (75–89)', () => {
    it('75 returns B — start of B', () => expect(calculateCBCGrade(75)).toBe('B'))
    it('89 returns B — end of B', () => expect(calculateCBCGrade(89)).toBe('B'))
  })

  describe('grade A (90–100)', () => {
    it('90 returns A — start of A', () => expect(calculateCBCGrade(90)).toBe('A'))
    it('100 returns A', () => expect(calculateCBCGrade(100)).toBe('A'))
    it('101 returns A — above 100, no throw', () => expect(calculateCBCGrade(101)).toBe('A'))
  })
})

describe('calculateCBCTotal', () => {
  it('scales CA points to /20 then adds exam score', () => {
    // 6 pts, 3 assessed → maxPoints=9, outOf20=6/9×20=13.333…
    // total = round((13.333 + 60) × 10) / 10 = 73.3
    expect(calculateCBCTotal(6, 3, 60)).toBe(73.3)
  })

  it('when assessed=0 outOf20 is 0, total equals examScore', () => {
    expect(calculateCBCTotal(0, 0, 60)).toBe(60)
  })

  it('when totalPoints=0 outOf20 is 0', () => {
    expect(calculateCBCTotal(0, 3, 40)).toBe(40)
  })

  it('perfect score: 9 pts, 3 assessed, 80 exam → 100', () => {
    // 9/9 × 20 = 20, + 80 = 100
    expect(calculateCBCTotal(9, 3, 80)).toBe(100)
  })
})

describe('calcCBC — full CBCResult', () => {
  it('A grade: descriptor=Exceptional, gradePoints=5', () => {
    // 9/9×20=20, +75=95 → A
    const r = calcCBC(9, 3, 75)
    expect(r.grade).toBe('A')
    expect(r.descriptor).toBe('Exceptional')
    expect(r.gradePoints).toBe(5)
    expect(r.total).toBe(95)
  })

  it('B grade: descriptor=Outstanding, gradePoints=4', () => {
    // 6/9×20=13.3, +65=78.3 → B
    const r = calcCBC(6, 3, 65)
    expect(r.grade).toBe('B')
    expect(r.descriptor).toBe('Outstanding')
    expect(r.gradePoints).toBe(4)
    expect(r.total).toBe(78.3)
  })

  it('C grade: descriptor=Satisfactory, gradePoints=3', () => {
    // 3/9×20=6.7, +60=66.7 → C
    const r = calcCBC(3, 3, 60)
    expect(r.grade).toBe('C')
    expect(r.descriptor).toBe('Satisfactory')
    expect(r.gradePoints).toBe(3)
  })

  it('D grade: descriptor=Basic, gradePoints=2', () => {
    // 0/9×20=0, +55=55 → D
    const r = calcCBC(0, 3, 55)
    expect(r.grade).toBe('D')
    expect(r.descriptor).toBe('Basic')
    expect(r.gradePoints).toBe(2)
  })

  it('E grade: descriptor=Elementary, gradePoints=1', () => {
    // 0/9×20=0, +40=40 → E
    const r = calcCBC(0, 3, 40)
    expect(r.grade).toBe('E')
    expect(r.descriptor).toBe('Elementary')
    expect(r.gradePoints).toBe(1)
  })

  it('returns all required fields', () => {
    const r = calcCBC(6, 3, 60)
    expect(r).toHaveProperty('totalPoints', 6)
    expect(r).toHaveProperty('maxPoints', 9)
    expect(r).toHaveProperty('outOf20')
    expect(r).toHaveProperty('examScore', 60)
    expect(r).toHaveProperty('total')
    expect(r).toHaveProperty('grade')
    expect(r).toHaveProperty('gradePoints')
    expect(r).toHaveProperty('descriptor')
  })

  it('outOf20 is rounded to 1 decimal place', () => {
    // 6/9 × 20 = 13.333… → should be 13.3
    const r = calcCBC(6, 3, 60)
    expect(r.outOf20).toBe(13.3)
  })

  it('assessed=0 gives outOf20=0', () => {
    const r = calcCBC(0, 0, 70)
    expect(r.outOf20).toBe(0)
    expect(r.total).toBe(70)
  })
})
