import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { ROUTES } from '@/lib/constants/routes'
import type { Role } from '@/types'

export async function guardManagement() {
  const session = await getSession()
  if (!session) redirect(ROUTES.login)
  const allowed: Role[] = ['admin', 'owner', 'reception', 'accountant', 'teacher']
  if (!allowed.includes(session.role)) redirect(ROUTES.login)
  return session
}

export async function guardStudent() {
  const session = await getSession()
  if (!session) redirect(ROUTES.login)
  if (session.role !== 'student') redirect(ROUTES.login)
  return session
}

export async function guardExamination() {
  const session = await getSession()
  if (!session) redirect(ROUTES.login)
  const allowed: Role[] = ['admin', 'teacher', 'examCoordinator']
  if (!allowed.includes(session.role)) redirect(ROUTES.login)
  return session
}

export async function guardBusiness() {
  const session = await getSession()
  if (!session) redirect(ROUTES.login)
  const allowed: Role[] = ['admin', 'owner']
  if (!allowed.includes(session.role)) redirect(ROUTES.login)
  return session
}
