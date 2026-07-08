import type { ExamAttempt, ExamResult, Student } from '@/types'

export type TeacherStatFilter = 'active' | 'passed' | 'failed' | 'dropped' | 'repeats'

export interface TeacherStatCounts {
  active: number
  passed: number
  failed: number
  dropped: number
  repeats: number
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function isActiveEnrollmentStudent(student: Student): boolean {
  if (student.status !== 'active') return false
  if (!student.batchEndDate) return true
  return student.batchEndDate >= todayIso()
}

export function isDroppedOrInactiveStudent(student: Student): boolean {
  if (student.status === 'withdrawn') return true
  if (student.status === 'pending' && student.batchEndDate) {
    return student.batchEndDate < todayIso()
  }
  return false
}

// Real exam data lives in examAttempts (the examResults collection has no writer).
// A student "passes" a paper when their best attempt percentage meets this threshold.
const PASS_THRESHOLD = 70

function attemptPercent(a: ExamAttempt): number {
  return a.percentage ?? a.totalScore ?? 0
}

function groupAttemptsByStudent(attempts: ExamAttempt[]): Map<string, ExamAttempt[]> {
  const map = new Map<string, ExamAttempt[]>()
  for (const a of attempts) {
    const list = map.get(a.studentId) ?? []
    list.push(a)
    map.set(a.studentId, list)
  }
  return map
}

/** Best (highest) percentage per paper for a student's attempts. */
function bestPercentByPaper(attempts: ExamAttempt[]): number[] {
  const best = new Map<string, number>()
  for (const a of attempts) {
    best.set(a.paperId, Math.max(best.get(a.paperId) ?? 0, attemptPercent(a)))
  }
  return Array.from(best.values())
}

export function studentIsRepeating(
  studentId: string,
  attemptsByStudent: Map<string, ExamAttempt[]>,
): boolean {
  const attempts = attemptsByStudent.get(studentId) ?? []
  const byPaper = new Map<string, number>()
  for (const a of attempts) {
    byPaper.set(a.paperId, (byPaper.get(a.paperId) ?? 0) + 1)
  }
  return Array.from(byPaper.values()).some((n) => n > 1)
}

export function studentHasAllPassed(
  studentId: string,
  attemptsByStudent: Map<string, ExamAttempt[]>,
): boolean {
  const attempts = attemptsByStudent.get(studentId) ?? []
  if (attempts.length === 0) return false
  return bestPercentByPaper(attempts).every((pct) => pct >= PASS_THRESHOLD)
}

export function studentHasFailedNotRetaking(
  studentId: string,
  attemptsByStudent: Map<string, ExamAttempt[]>,
): boolean {
  const attempts = attemptsByStudent.get(studentId) ?? []
  if (attempts.length === 0) return false
  if (!attempts.some((a) => attemptPercent(a) < PASS_THRESHOLD)) return false
  if (studentHasAllPassed(studentId, attemptsByStudent)) return false
  if (studentIsRepeating(studentId, attemptsByStudent)) return false
  return true
}

export function computeTeacherStatCounts(
  students: Student[],
  // Kept for backwards-compat with callers; pass/fail now derive from examAttempts only.
  _examResults: ExamResult[],
  examAttempts: ExamAttempt[],
): TeacherStatCounts {
  const attemptsByStudent = groupAttemptsByStudent(examAttempts)

  let active = 0
  let passed = 0
  let failed = 0
  let dropped = 0
  let repeats = 0

  for (const s of students) {
    if (isActiveEnrollmentStudent(s)) active++
    if (isDroppedOrInactiveStudent(s)) dropped++
    if (studentHasAllPassed(s.id, attemptsByStudent)) passed++
    if (studentIsRepeating(s.id, attemptsByStudent)) repeats++
    if (studentHasFailedNotRetaking(s.id, attemptsByStudent)) failed++
  }

  return { active, passed, failed, dropped, repeats }
}

export function filterStudentsByTeacherStat(
  students: Student[],
  filter: TeacherStatFilter,
  // Kept for backwards-compat with callers; pass/fail now derive from examAttempts only.
  _examResults: ExamResult[],
  examAttempts: ExamAttempt[],
): Student[] {
  const attemptsByStudent = groupAttemptsByStudent(examAttempts)

  return students.filter((s) => {
    switch (filter) {
      case 'active':
        return isActiveEnrollmentStudent(s)
      case 'dropped':
        return isDroppedOrInactiveStudent(s)
      case 'passed':
        return studentHasAllPassed(s.id, attemptsByStudent)
      case 'repeats':
        return studentIsRepeating(s.id, attemptsByStudent)
      case 'failed':
        return studentHasFailedNotRetaking(s.id, attemptsByStudent)
      default:
        return true
    }
  })
}

export const TEACHER_STAT_LABELS: Record<TeacherStatFilter, string> = {
  active: 'Active Students',
  passed: 'Passed',
  failed: 'Failed',
  dropped: 'Missed / Dropped',
  repeats: 'Repeats',
}
