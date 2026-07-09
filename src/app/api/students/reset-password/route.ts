import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'owner', 'reception']

async function verifyStaff(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return STAFF_ROLES.includes(role) ? decoded.uid : null
  } catch {
    return null
  }
}

/** Sets a student's Firebase Auth email + password in one call so reception can
 *  activate/repair a login instantly, then syncs the email into the students and
 *  users Firestore docs. The Auth update is the critical step (it's what lets the
 *  student log in); the Firestore syncs are best-effort and never fail the call. */
export async function POST(req: NextRequest) {
  try {
    const staffUid = await verifyStaff(req)
    if (!staffUid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { uid, email, password, studentId } = (await req.json()) as {
      uid?: string
      email?: string
      password?: string
      studentId?: string
    }

    if (!uid || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'uid, email and password are required' },
        { status: 400 },
      )
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 },
      )
    }

    // 1. Critical: update Firebase Auth email + password. If this throws, the
    //    student cannot log in, so we surface the error to the caller.
    await adminAuth.updateUser(String(uid), {
      email: String(email),
      password: String(password),
    })

    // 2. Sync the email into the students doc (best-effort). Student doc IDs are
    //    NOT the Firebase uid, so prefer the explicit studentId. merge-set avoids
    //    a "no document to update" throw on an unexpected id.
    try {
      await adminDb
        .collection('students')
        .doc(String(studentId || uid))
        .set({ email: String(email) }, { merge: true })
    } catch (e) {
      console.error('[students/reset-password] students sync failed', e)
    }

    // 3. Sync the users doc only if one exists for this uid (best-effort).
    try {
      const userRef = adminDb.collection('users').doc(String(uid))
      const userSnap = await userRef.get()
      if (userSnap.exists) await userRef.update({ email: String(email) })
    } catch (e) {
      console.error('[students/reset-password] users sync failed', e)
    }

    return NextResponse.json({ success: true, email: String(email), password: String(password) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[students/reset-password]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
