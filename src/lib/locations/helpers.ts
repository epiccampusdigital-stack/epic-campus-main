import type { EpicUser, Role, Student, StudentLocation } from '@/types'
import { LOCATION_LABELS } from '@/lib/students/helpers'

export const LOCATION_OPTIONS: { id: StudentLocation | ''; label: string }[] = [
  { id: '', label: 'All locations' },
  { id: 'ahangama', label: LOCATION_LABELS.ahangama },
  { id: 'galle', label: LOCATION_LABELS.galle },
  { id: 'waduraba', label: LOCATION_LABELS.waduraba },
  { id: 'pinnaduwa', label: LOCATION_LABELS.pinnaduwa },
]

/** Default location filter by role */
export function getDefaultLocationFilter(user: EpicUser | null): StudentLocation | '' {
  if (!user) return ''
  if (user.role === 'reception' || user.role === 'teacher') {
    return user.locationAssigned ?? ''
  }
  return ''
}

export function shouldApplyLocationDefault(role: Role): boolean {
  return role === 'reception' || role === 'teacher'
}

export function filterStudentsByLocation(
  students: Student[],
  locationFilter: StudentLocation | '',
): Student[] {
  if (!locationFilter) return students
  return students.filter((s) => s.location === locationFilter)
}

export function buildStudentLocationMap(students: Student[]): Map<string, StudentLocation | undefined> {
  const map = new Map<string, StudentLocation | undefined>()
  for (const s of students) {
    map.set(s.id, s.location)
  }
  return map
}

export function studentIdSetForLocation(
  students: Student[],
  locationFilter: StudentLocation | '',
): Set<string> {
  const filtered = filterStudentsByLocation(students, locationFilter)
  return new Set(filtered.map((s) => s.id))
}

export function isInMonth(iso: string, monthKey: string): boolean {
  return iso.slice(0, 7) === monthKey
}
