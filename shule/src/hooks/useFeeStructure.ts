import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { FeeStructure, AcademicYear } from '../types/app'

type AnyRow = Record<string, unknown>

// ── Row mapper ────────────────────────────────────────────────
function toFeeStructure(r: AnyRow): FeeStructure {
  return {
    id:             r.id as string,
    schoolId:       r.school_id as string,
    name:           r.name as string,
    amount:         r.amount as number,
    appliesTo:      r.applies_to as FeeStructure['appliesTo'],
    term:           r.term as FeeStructure['term'],
    isActive:       r.is_active as boolean,
    academicYearId: r.academic_year_id as string,
  }
}

// ── useAcademicYears ──────────────────────────────────────────
// Needed for the "Add Fee Type" modal to know which year to stamp.
export function useAcademicYears() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['academic-years', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, school_id, name, start_date, end_date, is_active')
        .eq('school_id', user!.schoolId)
        .order('start_date', { ascending: false })

      if (error) throw error

      return (data ?? []).map(r => ({
        id:        r.id as string,
        schoolId:  r.school_id as string,
        name:      r.name as string,
        startDate: r.start_date as string,
        endDate:   r.end_date as string,
        isActive:  r.is_active as boolean,
        term1Start: null, term1End: null,
        term2Start: null, term2End: null,
        term3Start: null, term3End: null,
      } satisfies AcademicYear))
    },
  })
}

// ── useFeeStructure ───────────────────────────────────────────
export function useFeeStructure(academicYearId?: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['fee-structure', user?.schoolId, academicYearId ?? 'all'],
    enabled:  !!user?.schoolId,
    queryFn: async () => {
      let q = supabase
        .from('fee_structure')
        .select('id, school_id, name, amount, applies_to, term, is_active, academic_year_id')
        .eq('school_id', user!.schoolId)
        .order('term',  { ascending: true })
        .order('name',  { ascending: true })

      if (academicYearId) q = q.eq('academic_year_id', academicYearId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map(r => toFeeStructure(r as AnyRow))
    },
  })
}

// ── useAddFeeType ─────────────────────────────────────────────
export type AddFeeTypeInput = {
  name:           string
  amount:         number
  appliesTo:      FeeStructure['appliesTo']
  term:           FeeStructure['term']
  academicYearId: string
}

export function useAddFeeType() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: AddFeeTypeInput) => {
      const { data, error } = await supabase
        .from('fee_structure')
        .insert({
          school_id:        user!.schoolId,
          name:             input.name.trim(),
          amount:           input.amount,
          applies_to:       input.appliesTo,
          term:             input.term,
          academic_year_id: input.academicYearId,
          is_active:        true,
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structure', user?.schoolId] })
    },
  })
}

// ── useUpdateFeeAmount ────────────────────────────────────────
// Called on inline cell blur when bursar edits an amount.
export function useUpdateFeeAmount() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await supabase
        .from('fee_structure')
        .update({ amount })
        .eq('id', id)
        .eq('school_id', user!.schoolId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structure', user?.schoolId] })
    },
  })
}

// ── useToggleFeeActive ────────────────────────────────────────
export function useToggleFeeActive() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('fee_structure')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('school_id', user!.schoolId)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structure', user?.schoolId] })
    },
  })
}
