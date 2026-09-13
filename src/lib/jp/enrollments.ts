import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { JpEnrollment, JpEnrollmentSource } from '@/types'

export function buildJpEnrollmentId(studentId: string, courseId: string): string {
  return `${studentId}_${courseId}`
}

export function parseJpEnrollment(id: string, data: Record<string, unknown>): JpEnrollment {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    courseId: String(data.courseId ?? ''),
    source: (data.source as JpEnrollmentSource) ?? 'admin',
    status: (data.status as JpEnrollment['status']) ?? 'active',
    grantedBy: String(data.grantedBy ?? ''),
    grantedAt: String(data.grantedAt ?? ''),
    expiresAt: data.expiresAt == null ? null : String(data.expiresAt),
    startedAt: data.startedAt == null ? null : String(data.startedAt),
    notes: data.notes != null ? String(data.notes) : undefined,
  }
}

export async function getJpEnrollment(studentId: string, courseId: string): Promise<JpEnrollment | null> {
  const id = buildJpEnrollmentId(studentId, courseId)
  const snap = await getDoc(doc(db, 'jpEnrollments', id))
  if (!snap.exists()) return null
  return parseJpEnrollment(id, snap.data())
}

export async function listJpEnrollmentsForStudent(studentId: string): Promise<JpEnrollment[]> {
  const snap = await getDocs(query(collection(db, 'jpEnrollments'), where('studentId', '==', studentId)))
  return snap.docs.map((d) => parseJpEnrollment(d.id, d.data()))
}

export async function listJpEnrollmentsForCourse(courseId: string): Promise<JpEnrollment[]> {
  const snap = await getDocs(query(collection(db, 'jpEnrollments'), where('courseId', '==', courseId)))
  return snap.docs.map((d) => parseJpEnrollment(d.id, d.data()))
}

export interface GrantJpEnrollmentParams {
  studentId: string
  courseId: string
  source: JpEnrollmentSource
  grantedBy: string
  expiresAt?: string | null
  startedAt?: string | null
  notes?: string
}

export async function grantJpEnrollment(params: GrantJpEnrollmentParams): Promise<JpEnrollment> {
  const id = buildJpEnrollmentId(params.studentId, params.courseId)
  const enrollment: JpEnrollment = {
    id,
    studentId: params.studentId,
    courseId: params.courseId,
    source: params.source,
    status: 'active',
    grantedBy: params.grantedBy,
    grantedAt: new Date().toISOString(),
    expiresAt: params.expiresAt ?? null,
    startedAt: params.startedAt ?? null,
    notes: params.notes,
  }
  await setDoc(doc(db, 'jpEnrollments', id), enrollment)
  return enrollment
}

export async function revokeJpEnrollment(studentId: string, courseId: string, revokedBy: string): Promise<void> {
  const id = buildJpEnrollmentId(studentId, courseId)
  const existing = await getJpEnrollment(studentId, courseId)
  const revokeNote = `Revoked by ${revokedBy} at ${new Date().toISOString()}`
  await updateDoc(doc(db, 'jpEnrollments', id), {
    status: 'revoked',
    notes: existing?.notes ? `${existing.notes}\n${revokeNote}` : revokeNote,
  })
}

export async function extendJpEnrollment(
  studentId: string,
  courseId: string,
  newExpiresAtISO: string | null,
): Promise<void> {
  const id = buildJpEnrollmentId(studentId, courseId)
  await updateDoc(doc(db, 'jpEnrollments', id), {
    expiresAt: newExpiresAtISO,
  })
}

export function isJpEnrollmentActive(enrollment: JpEnrollment): boolean {
  if (enrollment.status !== 'active') return false
  if (enrollment.expiresAt === null) return true
  return new Date(enrollment.expiresAt).getTime() > Date.now()
}
