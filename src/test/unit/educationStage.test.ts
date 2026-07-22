// Unit tests for src/lib/educationStage.ts — class-name-based stage detection.
import { describe, it, expect } from 'vitest'
import { classifyClassName, isTerminalLevel } from '../../lib/educationStage'

describe('classifyClassName', () => {
  it('normalizes P.1 / p1 / P 1 / Primary 1 identically to primary level 1', () => {
    expect(classifyClassName('P.1')).toEqual({ stage: 'primary', level: 1 })
    expect(classifyClassName('p1')).toEqual({ stage: 'primary', level: 1 })
    expect(classifyClassName('P 1')).toEqual({ stage: 'primary', level: 1 })
    expect(classifyClassName('Primary 1')).toEqual({ stage: 'primary', level: 1 })
  })

  it('P7 is primary level 7', () => {
    expect(classifyClassName('P.7')).toEqual({ stage: 'primary', level: 7 })
  })

  it('S1-S4 are olevel', () => {
    expect(classifyClassName('S.1')).toEqual({ stage: 'olevel', level: 1 })
    expect(classifyClassName('S.4')).toEqual({ stage: 'olevel', level: 4 })
    expect(classifyClassName('Senior 4')).toEqual({ stage: 'olevel', level: 4 })
  })

  it('S5-S6 are alevel', () => {
    expect(classifyClassName('S.5')).toEqual({ stage: 'alevel', level: 5 })
    expect(classifyClassName('S.6')).toEqual({ stage: 'alevel', level: 6 })
    expect(classifyClassName('Senior 6')).toEqual({ stage: 'alevel', level: 6 })
  })

  it('unrecognized names return null stage/level', () => {
    expect(classifyClassName('East')).toEqual({ stage: null, level: null })
    expect(classifyClassName('')).toEqual({ stage: null, level: null })
  })

  it('out-of-range numbers return null (P8, S7)', () => {
    expect(classifyClassName('P.8')).toEqual({ stage: null, level: null })
    expect(classifyClassName('S.7')).toEqual({ stage: null, level: null })
  })
})

describe('isTerminalLevel', () => {
  it('primary level 7 is terminal', () => {
    expect(isTerminalLevel('primary', 7)).toBe(true)
    expect(isTerminalLevel('primary', 6)).toBe(false)
  })
  it('alevel level 6 is terminal', () => {
    expect(isTerminalLevel('alevel', 6)).toBe(true)
    expect(isTerminalLevel('alevel', 5)).toBe(false)
  })
  it('olevel is never terminal (continues to A-level within the same school)', () => {
    expect(isTerminalLevel('olevel', 4)).toBe(false)
  })
})
