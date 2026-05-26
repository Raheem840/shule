// Unit tests for CBC grade logic in src/types/app.ts
// No mocking needed: app.ts has zero external dependencies.
import { describe, it, expect } from 'vitest'
import { calculateCBCGrade, calculateCBCTotal, calcCBC } from '../../types/app'

// UNEB CBC grade scale: A=80–100, B=70–79, C=60–69, D=50–59, E=0–49
describe('calculateCBCGrade', () => {
  describe('grade E (< 50)', () => {
    it('0 returns E', () => expect(calculateCBCGrade(0)).toBe('E'))
    it('49 returns E — boundary just below D', () => expect(calculateCBCGrade(49)).toBe('E'))
    it('-1 returns E — negative input, no throw', () => expect(calculateCBCGrade(-1)).toBe('E'))
  })

  describe('grade D (50–59)', () => {
    it('50 returns D — start of D', () => expect(calculateCBCGrade(50)).toBe('D'))
    it('59 returns D — end of D', () => expect(calculateCBCGrade(59)).toBe('D'))
  })

  describe('grade C (60–69)', () => {
    it('60 returns C — start of C', () => expect(calculateCBCGrade(60)).toBe('C'))
    it('69 returns C — end of C', () => expect(calculateCBCGrade(69)).toBe('C'))
  })

  describe('grade B (70–79)', () => {
    it('70 returns B — start of B', () => expect(calculateCBCGrade(70)).toBe('B'))
    it('79 returns B — end of B', () => expect(calculateCBCGrade(79)).toBe('B'))
  })

  describe('grade A (80–100)', () => {
    it('80 returns A — start of A', () => expect(calculateCBCGrade(80)).toBe('A'))
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
  it('A grade: 9/9×20=20 +75=95 → A, descriptor=Exceptional, gradePoints=5', () => {
    const r = calcCBC(9, 3, 75)
    expect(r.grade).toBe('A')
    expect(r.descriptor).toBe('Exceptional')
    expect(r.gradePoints).toBe(5)
    expect(r.total).toBe(95)
  })

  it('B grade: 6/9×20=13.3 +65=78.3 → B (70–79), descriptor=Outstanding', () => {
    const r = calcCBC(6, 3, 65)
    expect(r.grade).toBe('B')
    expect(r.descriptor).toBe('Outstanding')
    expect(r.gradePoints).toBe(4)
    expect(r.total).toBe(78.3)
  })

  it('C grade: 3/9×20=6.7 +60=66.7 → C (60–69), descriptor=Satisfactory', () => {
    const r = calcCBC(3, 3, 60)
    expect(r.grade).toBe('C')
    expect(r.descriptor).toBe('Satisfactory')
    expect(r.gradePoints).toBe(3)
  })

  it('D grade: 0/9×20=0 +55=55 → D (50–59), descriptor=Basic', () => {
    const r = calcCBC(0, 3, 55)
    expect(r.grade).toBe('D')
    expect(r.descriptor).toBe('Basic')
    expect(r.gradePoints).toBe(2)
  })

  it('E grade: 0/9×20=0 +40=40 → E (0–49), descriptor=Elementary', () => {
    const r = calcCBC(0, 3, 40)
    expect(r.grade).toBe('E')
    expect(r.descriptor).toBe('Elementary')
    expect(r.gradePoints).toBe(1)
  })

  it('boundary A/B: score 79 → B, score 80 → A', () => {
    expect(calcCBC(0, 0, 79).grade).toBe('B')
    expect(calcCBC(0, 0, 80).grade).toBe('A')
  })

  it('boundary B/C: score 69 → C, score 70 → B', () => {
    expect(calcCBC(0, 0, 69).grade).toBe('C')
    expect(calcCBC(0, 0, 70).grade).toBe('B')
  })

  it('boundary C/D: score 59 → D, score 60 → C', () => {
    expect(calcCBC(0, 0, 59).grade).toBe('D')
    expect(calcCBC(0, 0, 60).grade).toBe('C')
  })

  it('boundary D/E: score 49 → E, score 50 → D', () => {
    expect(calcCBC(0, 0, 49).grade).toBe('E')
    expect(calcCBC(0, 0, 50).grade).toBe('D')
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
