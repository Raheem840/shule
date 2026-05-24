// Phase 2 — Unit test for calcFeeStatus from useFeePayments.
// calcFeeStatus is a pure function; the supabase mock below only prevents
// the env-var throw that fires when the module is first imported.
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
  },
}))
vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}))

import { calcFeeStatus } from '../../hooks/useFeePayments'

describe('calcFeeStatus', () => {
  describe("'paid' — balance <= 0", () => {
    it('balance 0 → paid', () => {
      expect(calcFeeStatus(500_000, 0)).toBe('paid')
    })
    it('balance negative (overpayment) → paid', () => {
      expect(calcFeeStatus(600_000, -50_000)).toBe('paid')
    })
    it('balance exactly 0 with full payment → paid', () => {
      expect(calcFeeStatus(400_000, 0)).toBe('paid')
    })
  })

  describe("'partial' — balance > 0 and amountPaid > 0", () => {
    it('partial payment → partial', () => {
      expect(calcFeeStatus(200_000, 300_000)).toBe('partial')
    })
    it('small partial payment → partial', () => {
      expect(calcFeeStatus(1, 999_999)).toBe('partial')
    })
  })

  describe("'unpaid' — balance > 0 and amountPaid = 0", () => {
    it('zero paid → unpaid', () => {
      expect(calcFeeStatus(0, 400_000)).toBe('unpaid')
    })
    it('any positive balance with 0 paid → unpaid', () => {
      expect(calcFeeStatus(0, 1)).toBe('unpaid')
    })
  })
})
