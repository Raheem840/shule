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
    classId:        (r.class_id as string | null) ?? null,
    isCompulsory:   (r.is_compulsory as boolean) ?? true,
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
        surveyActive: false,
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
        .select('id, school_id, name, amount, applies_to, term, is_active, academic_year_id, class_id, is_compulsory')
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
  classId:        string | null
  isCompulsory:   boolean
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
          class_id:         input.classId,
          is_compulsory:    input.isCompulsory,
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


// ── useDeleteFeeType ──────────────────────────────────────────
export function useDeleteFeeType() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_structure').delete().eq('id', id).eq('school_id', user!.schoolId)
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['fee-structure', user?.schoolId] }) },
  })
}

// ── useAutoChargeFees ─────────────────────────────────────────
export function useAutoChargeFees() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ feeStructureId, classId, appliesTo, term, year, amount, academicYearId }: {
      feeStructureId: string; classId: string | null; appliesTo: FeeStructure['appliesTo']
      term: number; year: number; amount: number; academicYearId: string
    }) => {
      if (!user) throw new Error('Not authenticated')
      let q = supabase.from('students').select('id, student_type').eq('school_id', user.schoolId).eq('status', 'active')
      if (classId) q = q.eq('class_id', classId)
      if (appliesTo === 'boarders')     q = q.eq('student_type', 'boarder')
      if (appliesTo === 'day_scholars') q = q.eq('student_type', 'day')
      const { data: students, error: stuErr } = await q
      if (stuErr) throw stuErr
      if (!students?.length) return { charged: 0 }
      const studentIds = students.map(s => s.id as string)
      const { data: existing } = await supabase.from('fee_payments').select('student_id')
        .eq('school_id', user.schoolId).eq('fee_structure_id', feeStructureId)
        .eq('term', term).in('student_id', studentIds)
      const alreadyCharged = new Set((existing ?? []).map(r => r.student_id as string))
      const toCharge = studentIds.filter(id => !alreadyCharged.has(id))
      if (!toCharge.length) return { charged: 0 }
      const inserts = toCharge.map(sid => ({
        school_id: user.schoolId, student_id: sid, fee_structure_id: feeStructureId,
        academic_year_id: academicYearId, term, year, amount_due: amount,
        amount_paid: 0, balance: amount, imported: false, created_by: user.id,
      }))
      for (let i = 0; i < inserts.length; i += 100) {
        const { error } = await supabase.from('fee_payments').insert(inserts.slice(i, i + 100))
        if (error) throw error
      }
      return { charged: toCharge.length }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fee-payments', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['bursar-student-fees'] })
      void qc.invalidateQueries({ queryKey: ['bursar-kpis'] })
    },
  })
}
