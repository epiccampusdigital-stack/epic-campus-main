import { NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export interface VerifiedStaff {
  uid: string
  role: string
}

// Shared by the jp/course, jp/modules and jp/lessons routes — verifies the
// bearer token and checks the caller's Firestore `users` role against an
// allowlist (read routes allow teacher view-only access; write routes don't).
export async function verifyJpRole(req: NextRequest, allowedRoles: string[]): Promise<VerifiedStaff | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    if (!allowedRoles.includes(role)) return null
    return { uid: decoded.uid, role }
  } catch {
    return null
  }
}

// Any signed-in user, no role check — returns their uid, or null.
export async function verifySignedIn(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

// Mirrors the client-side fallback chain in loadStudentProfile (studentId
// linked on the user doc, then a students doc keyed by uid, then a uid
// field lookup) — done with the Admin SDK so it doesn't depend on the
// caller's own Firestore security-rule context. Used anywhere a route needs
// the students/{id} doc id for a signed-in student's own uid (jpOrders,
// jpEnrollments, jpFulfilment, video-token are all keyed by that doc id).
export async function resolveStudentId(uid: string): Promise<string | null> {
  const userSnap = await adminDb.collection('users').doc(uid).get()
  const linkedStudentId = userSnap.exists ? String(userSnap.data()?.studentId ?? '') : ''
  if (linkedStudentId) {
    const linkedSnap = await adminDb.collection('students').doc(linkedStudentId).get()
    if (linkedSnap.exists) return linkedSnap.id
  }

  const byDocId = await adminDb.collection('students').doc(uid).get()
  if (byDocId.exists) return byDocId.id

  const byUid = await adminDb.collection('students').where('uid', '==', uid).limit(1).get()
  if (!byUid.empty) return byUid.docs[0].id

  return null
}
