import { COURSE_MAP } from '@/lib/constants/courses'
import { LOCATION_LABELS } from '@/lib/students/helpers'
import type { Student } from '@/types'
import type { StudentIDCardProps } from '@/components/students/StudentIDCard'

function intakeLabel(student: Student): string {
  const raw = student.enrollmentDate || student.batchStartDate
  const year = raw ? new Date(raw).getFullYear() : new Date().getFullYear()
  return `${year} Intake`
}

function locationLabel(student: Student): string {
  if (student.location && LOCATION_LABELS[student.location]) {
    return `${LOCATION_LABELS[student.location]} Campus`
  }
  return 'Ahangama Campus'
}

export function studentToIdCardProps(
  student: Student,
  idNumberFallback?: string,
): Omit<StudentIDCardProps, 'size'> {
  return {
    studentId: student.id,
    studentName: student.name,
    course: COURSE_MAP[student.courseId]?.label ?? student.courseId,
    location: locationLabel(student),
    intake: intakeLabel(student),
    idNumber: student.studentCode || idNumberFallback || `EC-${new Date().getFullYear()}-000`,
    photoUrl: student.photoUrl,
  }
}
