import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { staffId, uid: uidFromBody } = await req.json()
    if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 })

    // 1. Read the staff document to retrieve the Auth UID and email.
    let uid: string | undefined = typeof uidFromBody === 'string' ? uidFromBody : undefined
    let email: string | undefined
    try {
      const snap = await adminDb.collection('users').doc(staffId).get()
      if (snap.exists) {
        const data = snap.data()
        uid = (data?.uid as string | undefined) || uid || staffId
        email = (data?.email as string | undefined) || undefined
      }
    } catch (err) {
      console.error('[DeleteAccount] Firestore lookup failed', err)
    }

    // 2. Remove the Firebase Auth account by UID. A missing account is not an
    //    error — there is simply nothing to delete. Any other failure is logged
    //    and surfaced as a warning, but must NOT block the Firestore deletion.
    let authWarning = false
    if (uid) {
      try {
        await adminAuth.deleteUser(uid)
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code !== 'auth/user-not-found') {
          authWarning = true
          console.error('[DeleteAccount] Auth deletion by uid failed', err)
        }
      }
    }

    // 2b. Fallback — the uid stored on the Firestore doc can be stale or missing
    //     (e.g. the doc was recreated under a new id but the Auth account for
    //     this email was never cleaned up). Look the account up by email too.
    if (email) {
      try {
        const authUser = await adminAuth.getUserByEmail(email)
        await adminAuth.deleteUser(authUser.uid)
      } catch {
        // Not found (or already deleted above) — ignore.
      }
    }

    // 3. Delete the Firestore document(s).
    await adminDb.collection('users').doc(staffId).delete().catch(() => {})
    await adminDb.collection('staff').doc(staffId).delete().catch(() => {})

    // 3b. Clean up any pending join-request doc(s) for this person. These are
    //     created via the Google sign-in "request access" flow into
    //     `pendingApprovals`, keyed by an auto id (not staffId), so they must
    //     be found by uid/email rather than deleted directly by staffId.
    try {
      const pendingDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
      if (uid) {
        const snap = await adminDb.collection('pendingApprovals').where('uid', '==', uid).get()
        pendingDocs.push(...snap.docs)
      }
      if (email) {
        const snap = await adminDb.collection('pendingApprovals').where('email', '==', email).get()
        for (const d of snap.docs) {
          if (!pendingDocs.some((p) => p.id === d.id)) pendingDocs.push(d)
        }
      }
      await Promise.all(pendingDocs.map((d) => d.ref.delete().catch(() => {})))
    } catch (err) {
      console.error('[DeleteAccount] Pending cleanup failed', err)
    }

    // 4/5. Firestore is always cleaned up; warn if the Auth side may linger.
    if (authWarning) {
      return NextResponse.json({
        success: true,
        warning: 'Removed from database but Auth account may still exist',
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DeleteAccount]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
