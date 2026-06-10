import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type {
  DosOverview, DosClassPerformance, TeacherPerfRow,
  SubjectRanking, PassRatePoint, ClassSubjectBreakdown,
  StudentRankEntry, CurriculumTopic,
} from '../types/week9'

// ── useDosOverview ─────────────────────────────────────────────────────────
export function useDosOverview() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['dos-overview', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<DosOverview> => {
      const sid = user!.schoolId

      // Parallel fetches — no .select('*')
      const currentYear = new Date().getFullYear()

      const [studentsRes, staffRes, journalsRes, resultsRes, curriculumRes] = await Promise.all([
        supabase
          .from('students')
          .select('id')
          .eq('school_id', sid)
          .eq('status', 'active'),
        supabase
          .from('staff')
          .select('id, role')
          .eq('school_id', sid)
          .eq('is_active', true)
          .in('role', ['teacher', 'class_teacher']),
        supabase
          .from('exam_journal')
          .select('id, subject_id, pass_mark, total_marks, term, year')
          .eq('school_id', sid),
        supabase
          .from('exam_results')
          .select('exam_journal_id, subject_id, score, term, year')
          .eq('school_id', sid),
        supabase
          .from('curriculum_plan')
          .select('id, covered_at')
          .eq('school_id', sid)
          .eq('year', currentYear),
      ])

      if (studentsRes.error) throw new Error(studentsRes.error.message)
      if (staffRes.error)    throw new Error(staffRes.error.message)
      if (journalsRes.error) throw new Error(journalsRes.error.message)
      if (resultsRes.error)  throw new Error(resultsRes.error.message)

      const students   = studentsRes.data ?? []
      const teachers   = staffRes.data ?? []
      const journals   = journalsRes.data ?? []
      const results    = resultsRes.data ?? []
      const curriculum = curriculumRes.data ?? []

      const examJournalsThisTerm = journals.filter(
        (j: any) => Number(j.year) === currentYear
      ).length
      const curriculumTopicsCovered = curriculum.filter(
        (t: any) => t.covered_at != null
      ).length

      // Build pass mark lookup: journalId → passMark
      const passMarkMap = new Map<string, number>(
        journals.map((j: any) => [j.id, j.pass_mark as number])
      )

      // Overall pass rate
      const graded = results.filter((r: any) => r.score != null)
      const passed = graded.filter((r: any) => r.score >= (passMarkMap.get(r.exam_journal_id) ?? 50))
      const overallPassRate = graded.length > 0
        ? Math.round((passed.length / graded.length) * 100)
        : 0

      // Per-subject stats for subject rankings
      const subjectMap = new Map<string, { scores: number[]; passed: number; failed: number }>()
      for (const r of graded) {
        const sid2 = r.subject_id as string
        if (!subjectMap.has(sid2)) subjectMap.set(sid2, { scores: [], passed: 0, failed: 0 })
        const s = subjectMap.get(sid2)!
        s.scores.push(r.score as number)
        const passMark = passMarkMap.get(r.exam_journal_id) ?? 50
        if ((r.score as number) >= passMark) s.passed++ ;else s.failed++
      }

      // Fetch subject names
      const subjectIds = [...subjectMap.keys()]
      let subjectNames = new Map<string, string>()
      if (subjectIds.length > 0) {
        const { data: subs } = await supabase
          .from('subjects')
          .select('id, name')
          .in('id', subjectIds)
          .eq('school_id', sid)
        for (const s of (subs ?? [])) subjectNames.set(s.id, s.name)
      }

      const subjectRankings: SubjectRanking[] = [...subjectMap.entries()]
        .map(([subjectId, s]) => {
          const avg = s.scores.length > 0
            ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length)
            : 0
          const total = s.passed + s.failed
          return {
            subjectId,
            subjectName: subjectNames.get(subjectId) ?? subjectId,
            classAverage: avg,
            passRate: total > 0 ? Math.round((s.passed / total) * 100) : 0,
            highest: s.scores.length > 0 ? Math.max(...s.scores) : 0,
            lowest: s.scores.length > 0 ? Math.min(...s.scores) : 0,
          }
        })
        .sort((a, b) => b.classAverage - a.classAverage)

      const subjectsBelowFifty = subjectRankings.filter(s => s.passRate < 50).length

      // Pass rate trend — last 3 distinct term+year combinations
      const termMap = new Map<string, { passed: number; total: number }>()
      for (const r of graded) {
        const key = `T${r.term} ${r.year}`
        if (!termMap.has(key)) termMap.set(key, { passed: 0, total: 0 })
        const t = termMap.get(key)!
        t.total++
        const passMark = passMarkMap.get(r.exam_journal_id) ?? 50
        if ((r.score as number) >= passMark) t.passed++
      }

      const passRateTrend: PassRatePoint[] = [...termMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-3)
        .map(([label, t]) => ({
          label,
          rate: t.total > 0 ? Math.round((t.passed / t.total) * 100) : 0,
        }))

      return {
        totalStudents:     students.length,
        overallPassRate,
        subjectsBelowFifty,
        activeTeachers:    teachers.length,
        examJournalsThisTerm,
        curriculumTopicsCovered,
        passRateTrend,
        subjectRankings,
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useDosClassPerformance ─────────────────────────────────────────────────
export function useDosClassPerformance(classId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['dos-class-perf', user?.schoolId, classId],
    enabled: !!user && !!classId,
    queryFn: async (): Promise<DosClassPerformance> => {
      const sid = user!.schoolId

      const [journalsRes, resultsRes, studentsRes, subjectsRes] = await Promise.all([
        supabase
          .from('exam_journal')
          .select('id, subject_id, pass_mark, class_id')
          .eq('school_id', sid)
          .eq('class_id', classId!),
        supabase
          .from('exam_results')
          .select('exam_journal_id, student_id, subject_id, score')
          .eq('school_id', sid),
        supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('school_id', sid)
          .eq('class_id', classId!),
        supabase
          .from('subjects')
          .select('id, name')
          .eq('school_id', sid),
      ])

      if (journalsRes.error) throw new Error(journalsRes.error.message)
      if (resultsRes.error)  throw new Error(resultsRes.error.message)

      const journals  = journalsRes.data ?? []
      const allResult = resultsRes.data ?? []
      const students  = studentsRes.data ?? []
      const subjects  = subjectsRes.data ?? []

      const subjectNameMap = new Map<string, string>(
        subjects.map((s: any) => [s.id, s.name])
      )
      const passMarkMap = new Map<string, number>(
        journals.map((j: any) => [j.id, j.pass_mark])
      )
      const classJournalIds = new Set(journals.map((j: any) => j.id))

      // Filter results to this class's journals
      const results = allResult.filter((r: any) => classJournalIds.has(r.exam_journal_id))

      // Per-subject breakdown
      const subjectStats = new Map<string, { scores: number[]; passed: number; studentSet: Set<string> }>()
      for (const r of results) {
        if (r.score == null) continue
        const subId = r.subject_id as string
        if (!subjectStats.has(subId)) subjectStats.set(subId, { scores: [], passed: 0, studentSet: new Set() })
        const s = subjectStats.get(subId)!
        s.scores.push(r.score)
        s.studentSet.add(r.student_id)
        const pm = passMarkMap.get(r.exam_journal_id) ?? 50
        if (r.score >= pm) s.passed++
      }

      const subjectBreakdown: ClassSubjectBreakdown[] = [...subjectStats.entries()].map(([subjectId, s]) => ({
        subjectId,
        subjectName: subjectNameMap.get(subjectId) ?? subjectId,
        average:     s.scores.length > 0 ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : 0,
        passRate:    s.scores.length > 0 ? Math.round((s.passed / s.scores.length) * 100) : 0,
        studentCount: s.studentSet.size,
      }))

      // Per-student average across all subjects
      const studentScores = new Map<string, number[]>()
      for (const r of results) {
        if (r.score == null) continue
        if (!studentScores.has(r.student_id)) studentScores.set(r.student_id, [])
        studentScores.get(r.student_id)!.push(r.score)
      }

      const studentRanks: StudentRankEntry[] = students.map((stu: any) => {
        const scores = studentScores.get(stu.id) ?? []
        const avg = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0
        return {
          studentId: stu.id,
          name: `${stu.first_name} ${stu.last_name}`,
          average: avg,
        }
      }).sort((a: StudentRankEntry, b: StudentRankEntry) => b.average - a.average)

      return {
        subjectBreakdown,
        topStudents:    studentRanks.slice(0, 5),
        bottomStudents: studentRanks.slice(-5).reverse(),
      }
    },
    staleTime: 5 * 60_000,
  })
}

// ── useDosTeacherPerformance ───────────────────────────────────────────────
export function useDosTeacherPerformance() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['dos-teacher-perf', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<TeacherPerfRow[]> => {
      const sid = user!.schoolId

      const [staffRes, journalsRes, resultsRes, topicsRes, subjectsRes] = await Promise.all([
        supabase
          .from('staff')
          .select('id, first_name, last_name, role, subjects, classes, phone, email, staff_number')
          .eq('school_id', sid)
          .in('role', ['teacher', 'class_teacher'])
          .eq('is_active', true),
        supabase
          .from('exam_journal')
          .select('id, teacher_id, pass_mark, subject_id, class_id, term, year')
          .eq('school_id', sid),
        supabase
          .from('exam_results')
          .select('exam_journal_id, score, teacher_id')
          .eq('school_id', sid),
        supabase
          .from('curriculum_plan')
          .select('subject_id, covered_at, school_id')
          .eq('school_id', sid),
        supabase
          .from('subjects')
          .select('id, name')
          .eq('school_id', sid)
          .eq('is_active', true),
      ])

      if (staffRes.error) throw new Error(staffRes.error.message)

      const staff    = staffRes.data ?? []
      const journals = journalsRes.data ?? []
      const results  = resultsRes.data ?? []
      const topics   = topicsRes.data ?? []
      const subjects = subjectsRes.data ?? []

      // Subject name lookup
      const subjectNameMap = new Map<string, string>(
        subjects.map((s: any) => [s.id as string, s.name as string])
      )

      // Pass mark lookup
      const passMarkMap = new Map<string, number>(
        journals.map((j: any) => [j.id, j.pass_mark])
      )

      return staff.map((teacher: any): TeacherPerfRow => {
        const tJournals = journals.filter((j: any) => j.teacher_id === teacher.id)
        const tJournalIds = new Set(tJournals.map((j: any) => j.id))
        const tResults = results.filter((r: any) => tJournalIds.has(r.exam_journal_id) && r.score != null)

        const passed = tResults.filter((r: any) => r.score >= (passMarkMap.get(r.exam_journal_id) ?? 50))
        const passRate = tResults.length > 0
          ? Math.round((passed.length / tResults.length) * 100)
          : 0

        // curriculum_plan has no teacher_id column — derive via subject ownership
        const teacherSubjects = new Set<string>((teacher.subjects ?? []) as string[])
        const tTopics   = topics.filter((t: any) => teacherSubjects.has(t.subject_id as string))
        const covered   = tTopics.filter((t: any) => t.covered_at != null).length
        const coverage  = tTopics.length > 0 ? Math.round((covered / tTopics.length) * 100) : 0

        // Get unique subject IDs from journals (for subject activity count)
        const uniqueSubjects = [...new Set(tJournals.map((j: any) => j.subject_id as string))]

        const assignedSubjectIds = (teacher.subjects ?? []) as string[]
        // Use staff.classes[] directly — this is the source of truth for assigned teaching classes
        const assignedClassIds   = (teacher.classes  ?? []) as string[]

        return {
          staffId:             teacher.id,
          name:                `${teacher.first_name} ${teacher.last_name}`,
          subjects:            uniqueSubjects,
          subjectIds:          assignedSubjectIds,
          subjectNames:        assignedSubjectIds.map(id => subjectNameMap.get(id) ?? id),
          classes:             assignedClassIds,
          isClassTeacher:      (teacher.role as string) === 'class_teacher',
          passRate,
          assessmentsThisTerm: tJournals.length,
          curriculumCoverage:  coverage,
          phone:               (teacher.phone as string)        ?? null,
          email:               (teacher.email as string)        ?? null,
          staffNumber:         (teacher.staff_number as string) ?? null,
        }
      })
    },
    staleTime: 5 * 60_000,
  })
}

// ── useDosCurriculumPlan ────────────────────────────────────────────────────
export function useDosCurriculumPlan(
  subjectId: string | null,
  classId: string | null
) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['dos-curriculum', user?.schoolId, subjectId, classId],
    enabled: !!user && !!subjectId && !!classId,
    queryFn: async (): Promise<CurriculumTopic[]> => {
      const { data, error } = await supabase
        .from('curriculum_plan')
        .select(
          'id, school_id, subject_id, class_id, topic, term, year,' +
          ' expected_date, covered, covered_at, covered_by'
        )
        .eq('school_id', user!.schoolId)
        .eq('subject_id', subjectId!)
        .eq('class_id', classId!)
        .order('expected_date', { ascending: true, nullsFirst: false })

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any, idx: number) => ({
        id:            r.id,
        schoolId:      r.school_id,
        subjectId:     r.subject_id,
        classId:       r.class_id,
        topicName:     r.topic,
        ncdcCode:      null,
        term:          r.term,
        year:          r.year,
        plannedDate:   r.expected_date,
        coveredAt:     r.covered_at,
        coveredBy:     r.covered_by,
        teacherId:     null,
        sequenceOrder: idx + 1,
      }))
    },
    staleTime: 2 * 60_000,
  })
}

// ── useMarkTopicCovered ────────────────────────────────────────────────────
export function useMarkTopicCovered() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (topicId: string) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('curriculum_plan')
        .update({
          covered:    true,
          covered_at: new Date().toISOString(),
          covered_by: user.id,
        })
        .eq('id', topicId)
        .eq('school_id', user.schoolId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dos-curriculum', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['dos-overview', user?.schoolId] })
    },
  })
}

// ── RLS error helper ───────────────────────────────────────────────────────
function isRlsError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42501' ||
    (error.message?.includes('row-level security') ?? false) ||
    (error.message?.includes('permission denied') ?? false)
  )
}

const RLS_SQL_FIX = `RLS policy blocks DoS updates. IT Admin must run in Supabase SQL Editor:
DROP POLICY IF EXISTS "staff_update_admin" ON staff;
CREATE POLICY "staff_update_admin" ON staff FOR UPDATE TO authenticated USING (school_id = public.user_school_id() AND public.user_role() IN ('principal','secretary','it_admin','dos'));`

// ── useAssignClassTeacher ──────────────────────────────────────────────────
// Assigns a teacher as class teacher for a stream.
// Enforces: one class teacher per class — throws if another stream in the
// same class already has a different class teacher assigned.
export function useAssignClassTeacher() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      streamId,
      classId: _classId,
      teacherId,
    }: {
      streamId: string
      classId: string
      teacherId: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      // Update the stream
      const { error: streamErr } = await supabase
        .from('streams')
        .update({ class_teacher_id: teacherId })
        .eq('id', streamId)
        .eq('school_id', user.schoolId)

      if (streamErr) throw new Error(streamErr.message)

      // Update staff.role = 'class_teacher' — try direct update, fall back to RPC
      const { error: staffErr } = await supabase
        .from('staff')
        .update({ role: 'class_teacher' })
        .eq('id', teacherId)
        .eq('school_id', user.schoolId)

      if (staffErr) {
        if (!isRlsError(staffErr)) throw new Error(staffErr.message)

        // RLS blocked — try RPC fallback
        const { error: rpcErr } = await supabase.rpc('dos_assign_class_teacher', {
          p_stream_id: streamId,
          p_teacher_id: teacherId,
          p_school_id: user.schoolId,
        })

        if (rpcErr) throw new Error(RLS_SQL_FIX)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dos-teacher-perf', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['streams'] })
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
    },
  })
}

// ── useAssignTeacherClasses ──────────────────────────────────────────────────
// DoS updates the classes array on a staff member (which classes they teach).
export function useAssignTeacherClasses() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ staffId, classIds }: { staffId: string; classIds: string[] }) => {
      if (!user) throw new Error('Not authenticated')
      const schoolId = user.schoolId

      // Try direct update first
      const { error } = await supabase
        .from('staff')
        .update({ classes: classIds })
        .eq('id', staffId)
        .eq('school_id', schoolId)

      if (error) {
        if (!isRlsError(error)) throw new Error(error.message)

        // RLS blocked — try RPC fallback
        const { error: rpcErr } = await supabase.rpc('dos_assign_classes', {
          p_staff_id: staffId,
          p_classes: classIds,
          p_school_id: schoolId,
        })

        if (rpcErr) throw new Error(RLS_SQL_FIX)
      }

      return staffId
    },
    onSuccess: (staffId: string) => {
      void qc.invalidateQueries({ queryKey: ['dos-teacher-perf', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['teachers-for-timetable', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['my-staff-record'] })
      void qc.invalidateQueries({ queryKey: ['staff-by-id', staffId] })
      void qc.invalidateQueries({ queryKey: ['staff-classes-raw', staffId] })
    },
  })
}

// ── useAssignTeacherSubjects ─────────────────────────────────────────────────
// DoS updates the subjects array on a staff member.
export function useAssignTeacherSubjects() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ staffId, subjectIds }: { staffId: string; subjectIds: string[] }) => {
      if (!user) throw new Error('Not authenticated')
      const schoolId = user.schoolId

      // Try direct update first
      const { error } = await supabase
        .from('staff')
        .update({ subjects: subjectIds })
        .eq('id', staffId)
        .eq('school_id', schoolId)

      if (error) {
        if (!isRlsError(error)) throw new Error(error.message)

        // RLS blocked — try RPC fallback
        const { error: rpcErr } = await supabase.rpc('dos_assign_subjects', {
          p_staff_id: staffId,
          p_subjects: subjectIds,
          p_school_id: schoolId,
        })

        if (rpcErr) throw new Error(RLS_SQL_FIX)
      }

      return staffId
    },
    onSuccess: (staffId: string) => {
      void qc.invalidateQueries({ queryKey: ['dos-teacher-perf', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['teachers-for-timetable', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['staff-by-id', staffId] })
    },
  })
}
