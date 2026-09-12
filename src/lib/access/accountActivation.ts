import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Role, Student } from '@/types'

/**
 * Roles allowed to change Account Activation (per-student override or batch
 * default). Deliberately narrow and NOT the same constant as STAFF_ROLES —
 * reception's permissions were recently audited and must not be widened again
 * just because a shared role list grew. Keep this list independent.
 */
export const ACTIVATION_ROLES: Role[] = ['admin', 'owner', 'teacher', 'reception']

export interface BatchAccountSettings {
  batchId: string
  accountActivated: boolean
  updatedAt: string
  updatedBy: string
}

/**
 * Routes that require an activated account. Base paths — a route is locked if
 * the current pathname equals one of these or starts with one of these + "/".
 * Everything NOT listed here (Epic Wall, My Payments, Pay Online, Book
 * Consultation, and anything else) stays open regardless of activation.
 */
export const LOCKED_ROUTES = [
  '/exams',
  '/exam-code',
  '/my-dashboard',
  '/my-schedule',
  '/my-id',
  '/my-results',
  '/my-materials',
  '/student/messages',
  '/student/assistant',
  '/my-visa',
]

export function isLockedRoute(pathname: string): boolean {
  return LOCKED_ROUTES.some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

/**
 * Resolves whether a student's whole portal is unlocked.
 *   1. A per-student override always wins, whichever way it's set.
 *   2. Otherwise, fall back to the batch's default.
 *   3. With neither set, the account is INACTIVE — fail closed.
 */
export function resolveAccountActivation(
  student: Pick<Student, 'accountActivationOverride' | 'batchId'>,
  batchSettings: BatchAccountSettings | null,
): boolean {
  if (student.accountActivationOverride === true || student.accountActivationOverride === false) {
    return student.accountActivationOverride
  }
  if (batchSettings) {
    return batchSettings.accountActivated
  }
  return false
}

function parseBatchAccountSettings(batchId: string, data: Record<string, unknown>): BatchAccountSettings {
  return {
    batchId,
    accountActivated: data.accountActivated === true,
    updatedAt: String(data.updatedAt ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
  }
}

export async function getBatchAccountSettings(batchId: string): Promise<BatchAccountSettings | null> {
  if (!batchId) return null
  const snap = await getDoc(doc(db, 'batchSettings', batchId))
  if (!snap.exists()) return null
  return parseBatchAccountSettings(batchId, snap.data())
}

/** Every batchSettings doc, keyed by batchId — drives the admin batch panel. */
export async function getAllBatchAccountSettings(): Promise<Record<string, BatchAccountSettings>> {
  const snap = await getDocs(collection(db, 'batchSettings'))
  const out: Record<string, BatchAccountSettings> = {}
  for (const d of snap.docs) {
    out[d.id] = parseBatchAccountSettings(d.id, d.data())
  }
  return out
}

export async function setBatchAccountActivation(
  batchId: string,
  accountActivated: boolean,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    doc(db, 'batchSettings', batchId),
    { batchId, accountActivated, updatedAt: new Date().toISOString(), updatedBy },
    { merge: true },
  )
}
