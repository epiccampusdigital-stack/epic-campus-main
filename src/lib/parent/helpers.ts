import { Timestamp } from 'firebase/firestore'
import {
  COURSE_FEE_LKR,
  REGISTRATION_FEE_LKR,
} from '@/lib/payments/constants'
import type {
  AttendanceRecord,
  ExamResult,
  ParentAccount,
  Payment,
  Student,
  StudentFeeSchedule,
} from '@/types'

export function generateParentAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function toIso(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString()
  }
  return new Date().toISOString()
}

export function parseParentAccount(
  id: string,
  data: Record<string, unknown>,
): ParentAccount {
  return {
    id,
    parentName: String(data.parentName ?? ''),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    linkedAt: toIso(data.linkedAt),
    createdAt: toIso(data.createdAt),
  }
}

export function feeScheduleTotals(schedule: StudentFeeSchedule) {
  const otherTotal = schedule.otherExpenses.reduce((s, o) => s + o.amount, 0)
  const totalDue = REGISTRATION_FEE_LKR + COURSE_FEE_LKR + otherTotal
  let paidCount = 0
  const totalItems = 2 + schedule.otherExpenses.length
  let paidAmount = 0
  if (schedule.registration.paid) {
    paidCount += 1
    paidAmount += schedule.registration.amount
  }
  if (schedule.course.paid) {
    paidCount += 1
    paidAmount += schedule.course.amount
  }
  for (const o of schedule.otherExpenses) {
    if (o.paid) {
      paidCount += 1
      paidAmount += o.amount
    }
  }
  return {
    totalDue,
    totalItems,
    paidCount,
    paidAmount,
    balance: Math.max(0, totalDue - paidAmount),
  }
}

export function attendanceThisMonth(records: AttendanceRecord[]): {
  present: number
  total: number
} {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthRecords = records.filter((r) => r.date.startsWith(prefix))
  const present = monthRecords.filter(
    (r) => r.status === 'present' || r.status === 'late',
  ).length
  return { present, total: monthRecords.length }
}

export function examResultsSummary(results: ExamResult[]): {
  passed: number
  total: number
} {
  const total = results.length
  const passed = results.filter((r) => r.status === 'pass').length
  return { passed, total }
}

export function visaStatusLabel(status?: Student['visaStatus']): string {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'in-progress':
      return 'In progress'
    case 'rejected':
      return 'Rejected'
    default:
      return 'Not started'
  }
}

export const VISA_STATUS_LABELS: Record<
  NonNullable<Student['visaStatus']>,
  string
> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function isExamPassed(status: ExamResult['status']): boolean {
  return status === 'pass'
}

export function paymentDueSummary(
  student: Student,
  payments: Payment[],
): { paid: number; due: number } {
  const schedule = student.feeSchedule
  if (schedule) {
    const { paidCount, totalItems } = feeScheduleTotals(schedule)
    return { paid: paidCount, due: totalItems }
  }
  const paid = payments.filter((p) => p.status === 'paid').length
  const pending = payments.filter(
    (p) => p.status === 'pending' || p.status === 'partial',
  ).length
  return { paid, due: paid + pending }
}
