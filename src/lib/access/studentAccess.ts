import type { EpicUser, Student } from '@/types'
import { getBatchAccountSettings, resolveAccountActivation } from '@/lib/access/accountActivation'
import { isJpEnrollmentActive, listJpEnrollmentsForStudent } from '@/lib/jp/enrollments'

export type StudentAccess = {
  isAccountActive: boolean
  hasActiveJpEnrollment: boolean
  enrollmentType: 'residential' | 'online' | 'both'
}

/**
 * Composes two independent checks: Account Activation (residential batch
 * gate) and JP enrollment (online course gate). Online students have no
 * batch, so they must never be routed through the batchSettings fallback —
 * skip that lookup entirely for 'online' enrollmentType.
 */
export async function resolveStudentAccess(student: Student, user: EpicUser): Promise<StudentAccess> {
  void user

  const enrollmentType = student.enrollmentType ?? 'residential'

  const batchSettings =
    enrollmentType === 'online'
      ? null
      : student.batchId
        ? await getBatchAccountSettings(student.batchId)
        : null

  const isAccountActive = resolveAccountActivation(student, batchSettings)

  const enrollments = await listJpEnrollmentsForStudent(student.id)
  const hasActiveJpEnrollment = enrollments.some(isJpEnrollmentActive)

  return { isAccountActive, hasActiveJpEnrollment, enrollmentType }
}
