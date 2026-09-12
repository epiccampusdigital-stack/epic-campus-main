import type { Student } from '@/types'

type EnrollmentType = NonNullable<Student['enrollmentType']>

/** Full nav href set residential students see today (StudentSidebar + StudentBottomNav), unchanged. */
const RESIDENTIAL_TABS = [
  '/epic-wall',
  '/my-dashboard',
  '/my-schedule',
  '/my-id',
  '/my-payments',
  '/student/payments',
  '/my-results',
  '/my-materials',
  '/student/messages',
  '/student/assistant',
  '/book-consultation',
  '/my-visa',
  '/exams',
  '/exam-code',
]

/** Online students have no batch/campus presence — Japanese course, messages, notifications, profile/payments only. */
const ONLINE_TABS = [
  '/student/japanese',
  '/student/messages',
  '/student/notifications',
  '/my-id',
  '/my-payments',
  '/student/payments',
]

export function getVisibleTabs(enrollmentType: EnrollmentType): string[] {
  if (enrollmentType === 'online') return ONLINE_TABS
  if (enrollmentType === 'residential') return RESIDENTIAL_TABS
  return Array.from(new Set([...RESIDENTIAL_TABS, ...ONLINE_TABS]))
}
