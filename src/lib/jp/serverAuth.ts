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
