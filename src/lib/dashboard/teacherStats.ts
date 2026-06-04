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

function groupResultsByStudent(results: ExamResult[]): Map<string, ExamResult[]> {
  const map = new Map<string, ExamResult[]>()
  for (const r of results) {
    const list = map.get(r.studentId) ?? []
    list.push(r)
    map.set(r.studentId, list)
  }
  return map
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

export function studentIsRepeating(
  studentId: string,
  resultsByStudent: Map<string, ExamResult[]>,
  attemptsByStudent: Map<string, ExamAttempt[]>,
): boolean {
  const results = resultsByStudent.get(studentId) ?? []
  const byExam = new Map<string, number>()
  for (const r of results) {
    byExam.set(r.examId, (byExam.get(r.examId) ?? 0) + 1)
  }
  if (Array.from(byExam.values()).some((n) => n > 1)) return true

  const attempts = attemptsByStudent.get(studentId) ?? []
  const byPaper = new Map<string, number>()
  for (const a of attempts) {
    byPaper.set(a.paperId, (byPaper.get(a.paperId) ?? 0) + 1)
  }
  return Array.from(byPaper.values()).some((n) => n > 1)
}

export function studentHasAllPassed(studentId: string, resultsByStudent: Map<string, ExamResult[]>): boolean {
  const results = resultsByStudent.get(studentId) ?? []
  return results.length > 0 && results.every((r) => r.status === 'pass')
}

export function studentHasFailedNotRetaking(
  studentId: string,
  resultsByStudent: Map<string, ExamResult[]>,
  attemptsByStudent: Map<string, ExamAttempt[]>,
): boolean {
  const results = resultsByStudent.get(studentId) ?? []
  if (!results.some((r) => r.status === 'fail')) return false
  if (studentHasAllPassed(studentId, resultsByStudent)) return false
  if (studentIsRepeating(studentId, resultsByStudent, attemptsByStudent)) return false
  return true
}

export function computeTeacherStatCounts(
  students: Student[],
  examResults: ExamResult[],
  examAttempts: ExamAttempt[],
): TeacherStatCounts {
  const resultsByStudent = groupResultsByStudent(examResults)
  const attemptsByStudent = groupAttemptsByStudent(examAttempts)

  let active = 0
  let passed = 0
  let failed = 0
  let dropped = 0
  let repeats = 0

  for (const s of students) {
    if (isActiveEnrollmentStudent(s)) active++
    if (isDroppedOrInactiveStudent(s)) dropped++
    if (studentHasAllPassed(s.id, resultsByStudent)) passed++
    if (studentIsRepeating(s.id, resultsByStudent, attemptsByStudent)) repeats++
    if (studentHasFailedNotRetaking(s.id, resultsByStudent, attemptsByStudent)) failed++
  }

  return { active, passed, failed, dropped, repeats }
}

export function filterStudentsByTeacherStat(
  students: Student[],
  filter: TeacherStatFilter,
  examResults: ExamResult[],
  examAttempts: ExamAttempt[],
): Student[] {
  const resultsByStudent = groupResultsByStudent(examResults)
  const attemptsByStudent = groupAttemptsByStudent(examAttempts)

  return students.filter((s) => {
    switch (filter) {
      case 'active':
        return isActiveEnrollmentStudent(s)
      case 'dropped':
        return isDroppedOrInactiveStudent(s)
      case 'passed':
        return studentHasAllPassed(s.id, resultsByStudent)
      case 'repeats':
        return studentIsRepeating(s.id, resultsByStudent, attemptsByStudent)
      case 'failed':
        return studentHasFailedNotRetaking(s.id, resultsByStudent, attemptsByStudent)
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
