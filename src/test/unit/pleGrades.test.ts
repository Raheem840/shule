// Unit tests for Primary (P1-P7) / PLE grade logic in src/types/app.ts
import { describe, it, expect } from 'vitest'
import {
  calculatePLEGrade, plePoints, calculatePLEAggregate, calculatePLEDivision,
} from '../../types/app'

describe('calculatePLEGrade', () => {
  it('90 returns D1 (best)', () => expect(calculatePLEGrade(90)).toBe('D1'))
  it('89 returns D2', () => expect(calculatePLEGrade(89)).toBe('D2'))
  it('70 returns C3, 69 returns C4', () => {
    expect(calculatePLEGrade(70)).toBe('C3')
    expect(calculatePLEGrade(69)).toBe('C4')
  })
  it('50 returns P7, 49 returns P8', () => {
    expect(calculatePLEGrade(50)).toBe('P7')
    expect(calculatePLEGrade(49)).toBe('P8')
  })
  it('39 and below returns F9 (fail)', () => {
    expect(calculatePLEGrade(39)).toBe('F9')
    expect(calculatePLEGrade(0)).toBe('F9')
  })
})

describe('plePoints', () => {
  it('D1 is worth 1 point (lower = better, opposite of CBC)', () => {
    expect(plePoints('D1')).toBe(1)
  })
  it('F9 is worth 9 points (worst)', () => {
    expect(plePoints('F9')).toBe(9)
  })
})

describe('calculatePLEAggregate', () => {
  it('best possible aggregate across 4 subjects is 4 (all D1)', () => {
    expect(calculatePLEAggregate(['D1', 'D1', 'D1', 'D1'])).toBe(4)
  })
  it('worst aggregate across 4 subjects is 36 (all F9)', () => {
    expect(calculatePLEAggregate(['F9', 'F9', 'F9', 'F9'])).toBe(36)
  })
  it('sums arbitrary mixed grades', () => {
    // D1(1) + C3(3) + P7(7) + F9(9) = 20
    expect(calculatePLEAggregate(['D1', 'C3', 'P7', 'F9'])).toBe(20)
  })
})

describe('calculatePLEDivision', () => {
  it('4-12 is Division 1', () => {
    expect(calculatePLEDivision(4)).toBe('Division 1')
    expect(calculatePLEDivision(12)).toBe('Division 1')
  })
  it('13-23 is Division 2', () => {
    expect(calculatePLEDivision(13)).toBe('Division 2')
    expect(calculatePLEDivision(23)).toBe('Division 2')
  })
  it('24-29 is Division 3', () => {
    expect(calculatePLEDivision(24)).toBe('Division 3')
    expect(calculatePLEDivision(29)).toBe('Division 3')
  })
  it('30-34 is Division 4 (last passing band)', () => {
    expect(calculatePLEDivision(30)).toBe('Division 4')
    expect(calculatePLEDivision(34)).toBe('Division 4')
  })
  it('35-36 is Ungraded', () => {
    expect(calculatePLEDivision(35)).toBe('Ungraded')
    expect(calculatePLEDivision(36)).toBe('Ungraded')
  })
})
