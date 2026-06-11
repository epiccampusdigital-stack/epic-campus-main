import { computeBatchEndDate } from '@/lib/students/helpers'
import { LOCATION_LABELS } from '@/lib/students/helpers'
import { COURSE_MAP } from '@/lib/constants/courses'
import type { AttendanceRecord, ExamAttempt, ExamResult, Student } from '@/types'

export type RiskLevel = 'high' | 'medium' | 'low' | 'on-track'

export interface StudentRiskProfile {
  studentId: string
  studentName: string
  course: string
  location: string
  riskLevel: RiskLevel
  riskScore: number
  flags: string[]
  recommendation: string
  lastCalculated: string
  attendancePercent: number
  examAverage: number
  paymentStatus: 'paid' | 'partial' | 'overdue' | 'none'
  daysSinceLastLogin: number
  batchWeeksRemaining: number
  /** For contact actions — stored in cache for quick lookup */
  studentMobile?: string
}

export type RiskScoreInput = Omit<
  StudentRiskProfile,
  'riskLevel' | 'riskScore' | 'flags' | 'recommendation' | 'lastCalculated'
>

export function calculateRiskScore(
  profile: RiskScoreInput,
): { score: number; flags: string[]; level: RiskLevel } {
  let score = 0
  const flags: string[] = []

  if (profile.attendancePercent < 50) {
    score += 40
    flags.push(`Attendance critically low (${profile.attendancePercent}%)`)
  } else if (profile.attendancePercent < 70) {
    score += 25
    flags.push(`Attendance below 70% (${profile.attendancePercent}%)`)
  } else if (profile.attendancePercent < 80) {
    score += 10
    flags.push(`Attendance slightly low (${profile.attendancePercent}%)`)
  }

  if (profile.examAverage < 40) {
    score += 30
    flags.push(`Exam average critically low (${profile.examAverage}%)`)
  } else if (profile.examAverage < 55) {
    score += 20
    flags.push(`Exam average below passing (${profile.examAverage}%)`)
  } else if (profile.examAverage < 70) {
    score += 8
    flags.push('Exam average needs improvement')
  }

  if (profile.paymentStatus === 'overdue') {
    score += 20
    flags.push('Payment overdue')
  } else if (profile.paymentStatus === 'partial') {
    score += 10
    flags.push('Payment partially complete')
  } else if (profile.paymentStatus === 'none') {
    score += 15
    flags.push('No payment recorded')
  }

  if (profile.daysSinceLastLogin > 14) {
    score += 10
    flags.push(`No portal activity in ${profile.daysSinceLastLogin} days`)
  } else if (profile.daysSinceLastLogin > 7) {
    score += 5
    flags.push('Low portal engagement')
  }

  const level: RiskLevel =
    score >= 60 ? 'high' : score >= 35 ? 'medium' : score >= 15 ? 'low' : 'on-track'

  return { score, flags, level }
}

export function buildDefaultRecommendation(flags: string[], level: RiskLevel): string {
  if (level === 'on-track') return 'Continue regular check-ins and positive reinforcement.'
  if (flags.some((f) => f.includes('Attendance'))) {
    return 'Call the student today to understand attendance barriers.'
  }
  if (flags.some((f) => f.includes('Exam'))) {
    return 'Arrange a tutorial session focused on weak exam areas.'
  }
  if (flags.some((f) => f.includes('Payment'))) {
    return 'Refer the student to reception for a payment plan discussion.'
  }
  if (flags.some((f) => f.toLowerCase().includes('portal'))) {
    return 'Send a WhatsApp reminder to log into the student portal.'
  }
  return 'Schedule a one-on-one check-in with the student this week.'
}

export function getRiskBadgeClasses(level: RiskLevel): string {
  switch (level) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200'
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200'
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200'
    case 'on-track':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200'
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'high':
      return 'High Risk'
    case 'medium':
      return 'Watch'
    case 'low':
      return 'Low Risk'
    case 'on-track':
      return 'On Track'
  }
}

const FINANCIAL_FLAG_PATTERNS = [/payment/i, /overdue/i, /paid/i]

export function stripFinancialFlags(flags: string[]): string[] {
  return flags.filter((f) => !FINANCIAL_FLAG_PATTERNS.some((p) => p.test(f)))
}

export function whatsappContactUrl(phone: string, studentName: string, flag?: string): string {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('94') ? digits : digits.startsWith('0') ? `94${digits.slice(1)}` : `94${digits}`
  const message = flag
    ? `Hi ${studentName}, this is Epic Campus. We noticed ${flag.toLowerCase()} and wanted to check in — how can we support you?`
    : `Hi ${studentName}, this is Epic Campus. We wanted to check in on your progress — is everything okay?`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function attendancePercentForStudent(
  studentId: string,
  records: AttendanceRecord[],
): number {
  const studentRecords = records.filter((r) => r.studentId === studentId)
  if (studentRecords.length === 0) return 100
  const attended = studentRecords.filter(
    (r) => r.status === 'present' || r.status === 'late',
  ).length
  return Math.round((attended / studentRecords.length) * 100)
}

export function computeExamAverage(
  studentId: string,
  results: ExamResult[],
  attempts: ExamAttempt[],
): number {
  const scores: number[] = []
  for (const r of results) {
    if (r.studentId !== studentId) continue
    if (r.score != null) scores.push(Number(r.score))
  }
  for (const a of attempts) {
    if (a.studentId !== studentId) continue
    if (a.totalScore != null) scores.push(Number(a.totalScore))
  }
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
}

export function mapPaymentStatus(student: Student): StudentRiskProfile['paymentStatus'] {
  const schedule = student.feeSchedule
  const hasUnpaid =
    schedule &&
    (!schedule.registration.paid ||
      !schedule.course.paid ||
      schedule.otherExpenses.some((o) => !o.paid))

  if (student.paymentStatus === 'paid' && !hasUnpaid) return 'paid'
  if (student.paymentStatus === 'partial' || (hasUnpaid && student.paymentStatus === 'paid')) {
    return 'partial'
  }

  if (hasUnpaid || student.paymentStatus === 'pending') {
    const endDate =
      student.batchEndDate ??
      (student.batchStartDate && student.batchDuration
        ? computeBatchEndDate(
            student.batchStartDate,
            student.batchDuration,
            student.batchCustomDays,
          )
        : undefined)
    if (endDate && new Date(endDate) < new Date()) return 'overdue'
    if (!schedule?.registration.paid && !schedule?.course.paid) return 'none'
    return 'partial'
  }

  return 'none'
}

export function batchWeeksRemaining(student: Student): number {
  const endDate =
    student.batchEndDate ??
    (student.batchStartDate && student.batchDuration
      ? computeBatchEndDate(
          student.batchStartDate,
          student.batchDuration,
          student.batchCustomDays,
        )
      : undefined)
  if (!endDate) return 0
  const days = Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  return Math.max(0, Math.ceil(days / 7))
}

export function daysSinceLastActivity(
  studentId: string,
  attendance: AttendanceRecord[],
  studySessionDates: Map<string, string>,
  fallbackIso: string,
): number {
  const dates: number[] = []

  for (const r of attendance) {
    if (r.studentId !== studentId) continue
    const d = new Date(r.date || r.createdAt).getTime()
    if (!Number.isNaN(d)) dates.push(d)
  }

  const studyDate = studySessionDates.get(studentId)
  if (studyDate) {
    const d = new Date(studyDate).getTime()
    if (!Number.isNaN(d)) dates.push(d)
  }

  const fallback = new Date(fallbackIso).getTime()
  if (!Number.isNaN(fallback)) dates.push(fallback)

  const latest = Math.max(...dates)
  return Math.max(0, Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24)))
}

export function parseRiskProfile(
  id: string,
  data: Record<string, unknown>,
): StudentRiskProfile {
  return {
    studentId: String(data.studentId ?? id),
    studentName: String(data.studentName ?? ''),
    course: String(data.course ?? ''),
    location: String(data.location ?? ''),
    riskLevel: (data.riskLevel as RiskLevel) ?? 'on-track',
    riskScore: Number(data.riskScore ?? 0),
    flags: Array.isArray(data.flags) ? data.flags.map(String) : [],
    recommendation: String(data.recommendation ?? ''),
    lastCalculated: String(data.lastCalculated ?? ''),
    attendancePercent: Number(data.attendancePercent ?? 0),
    examAverage: Number(data.examAverage ?? 0),
    paymentStatus: (data.paymentStatus as StudentRiskProfile['paymentStatus']) ?? 'none',
    daysSinceLastLogin: Number(data.daysSinceLastLogin ?? 0),
    batchWeeksRemaining: Number(data.batchWeeksRemaining ?? 0),
    studentMobile: data.studentMobile ? String(data.studentMobile) : undefined,
  }
}

export function buildRiskProfileForStudent(
  student: Student,
  attendance: AttendanceRecord[],
  examResults: ExamResult[],
  examAttempts: ExamAttempt[],
  studySessionDates: Map<string, string>,
): StudentRiskProfile {
  const attendancePercent = attendancePercentForStudent(student.id, attendance)
  const examAverage = computeExamAverage(student.id, examResults, examAttempts)
  const paymentStatus = mapPaymentStatus(student)
  const daysSinceLastLogin = daysSinceLastActivity(
    student.id,
    attendance,
    studySessionDates,
    student.enrollmentDate ?? student.createdAt,
  )
  const weeks = batchWeeksRemaining(student)

  const input: RiskScoreInput = {
    studentId: student.id,
    studentName: student.name,
    course: COURSE_MAP[student.courseId]?.label ?? student.courseId,
    location: student.location ? LOCATION_LABELS[student.location] : '—',
    attendancePercent,
    examAverage,
    paymentStatus,
    daysSinceLastLogin,
    batchWeeksRemaining: weeks,
    studentMobile: student.mobile,
  }

  const { score, flags, level } = calculateRiskScore(input)
  const recommendation = buildDefaultRecommendation(flags, level)

  return {
    ...input,
    riskLevel: level,
    riskScore: score,
    flags,
    recommendation,
    lastCalculated: new Date().toISOString(),
  }
}
