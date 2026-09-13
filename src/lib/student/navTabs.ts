export type StudentEnrollmentType = 'residential' | 'online' | 'both'

export interface StudentNavItem {
  label: string
  href: string
  icon: string
}

// The online course has no batch, schedule, ID-card-as-passport-photo,
// payment plan, or visa tracker — its nav is a fixed, minimal set rather
// than a filtered version of the residential list. There is no
// /student/notifications route (and no other student-facing notifications
// surface) yet, so that item is intentionally left out rather than linking
// somewhere dead — add it back here once a real surface exists.
export const ONLINE_NAV_ITEMS: StudentNavItem[] = [
  { label: 'Course', href: '/student/japanese', icon: 'ti-book-2' },
  { label: 'Messages', href: '/student/messages', icon: 'ti-message' },
  { label: 'Profile', href: '/my-id', icon: 'ti-user' },
]

/**
 * Residential students (and dual-enrollment 'both' students, who still need
 * every residential feature) must see their existing nav completely
 * unchanged — this passes it straight through untouched. Only 'online'
 * students get the reduced online-course nav.
 */
export function getVisibleTabs<T extends StudentNavItem>(
  enrollmentType: StudentEnrollmentType | undefined,
  residentialItems: T[],
): (T | StudentNavItem)[] {
  if (enrollmentType === 'online') return ONLINE_NAV_ITEMS
  return residentialItems
}
