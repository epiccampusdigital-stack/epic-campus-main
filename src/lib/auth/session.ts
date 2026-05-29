import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/admin'
import type { EpicUser, Role } from '@/types'

export async function getSession(): Promise<EpicUser | null> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('epic-session')?.value
    if (!token) return null

    const decoded = await adminAuth.verifyIdToken(token)

    return {
      uid:         decoded.uid,
      email:       decoded.email ?? '',
      displayName: decoded.name  ?? '',
      role:        (decoded.role as Role) ?? 'student',
      branchId:    decoded.branchId as string | undefined,
      studentId:   decoded.studentId as string | undefined,
      createdAt:   new Date(decoded.iat * 1000).toISOString(),
    }
  } catch {
    return null
  }
}

export async function requireSession(): Promise<EpicUser> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorised')
  }
  return session
}

export async function requireRole(allowedRoles: Role[]): Promise<EpicUser> {
  const session = await requireSession()
  if (!allowedRoles.includes(session.role)) {
    throw new Error('Forbidden')
  }
  return session
}
