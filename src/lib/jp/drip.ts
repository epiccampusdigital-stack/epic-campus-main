import type { JpEnrollment, JpLesson } from '@/types'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function getEnrollmentStart(enrollment: JpEnrollment): Date | null {
  const iso = enrollment.startedAt ?? enrollment.grantedAt
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function weeksElapsed(start: Date, now: Date): number {
  return Math.floor((now.getTime() - start.getTime()) / MS_PER_WEEK)
}

// Week 1 begins on startedAt (falling back to grantedAt) — a lesson with
// releaseWeek 1 is available immediately on enrollment.
export function isLessonReleased(lesson: JpLesson, enrollment: JpEnrollment): boolean {
  if (lesson.isFreePreview) return true

  const start = getEnrollmentStart(enrollment)
  if (!start) return lesson.releaseWeek <= 1

  const elapsed = weeksElapsed(start, new Date())
  return elapsed + 1 >= lesson.releaseWeek
}

// Inverse of the elapsed+1 >= releaseWeek check: the lesson unlocks exactly
// (releaseWeek - 1) weeks after the enrollment start. Returns null once the
// lesson is already released (or is a free preview, which has no lock date).
export function getNextReleaseDate(lesson: JpLesson, enrollment: JpEnrollment): string | null {
  if (isLessonReleased(lesson, enrollment)) return null

  const start = getEnrollmentStart(enrollment)
  if (!start) return null

  const unlockDate = new Date(start.getTime() + (lesson.releaseWeek - 1) * MS_PER_WEEK)
  return unlockDate.toISOString()
}
