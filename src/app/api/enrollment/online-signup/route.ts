import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// The students/{id} security rule only allows admin/owner/reception to
// *create* a student doc (no self-create carve-out, unlike users/{uid}) —
// so a freshly-created Auth account (no custom claim role yet) could never
// write its own students doc from the client. Both the Auth user and the
// students/users docs are created here with the Admin SDK instead, which
// bypasses that rule entirely, then a custom token is handed back so the
// browser can sign in as the account it just asked for.
async function getSignedInUid(req: NextRequest): Promise<string | null> {
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

export async function POST(req: NextRequest) {
  try {
    const signedInUid = await getSignedInUid(req)

    // Already signed in as an existing (residential) student — upgrade to
    // 'both' rather than creating a second account.
    if (signedInUid) {
      const userSnap = await adminDb.collection('users').doc(signedInUid).get()
      const linkedStudentId = userSnap.exists ? String(userSnap.data()?.studentId ?? '') : ''

      let studentRef = linkedStudentId ? adminDb.collection('students').doc(linkedStudentId) : null
      let studentSnap = studentRef ? await studentRef.get() : null

      if (!studentSnap || !studentSnap.exists) {
        const byDocId = adminDb.collection('students').doc(signedInUid)
        const byDocIdSnap = await byDocId.get()
        if (byDocIdSnap.exists) {
          studentRef = byDocId
          studentSnap = byDocIdSnap
        }
      }

      if (!studentSnap || !studentSnap.exists) {
        const byUid = await adminDb.collection('students').where('uid', '==', signedInUid).limit(1).get()
        if (byUid.empty) {
          return NextResponse.json({ error: 'Could not find your student profile' }, { status: 404 })
        }
        studentRef = byUid.docs[0].ref
      }

      await studentRef!.set({ enrollmentType: 'both' }, { merge: true })
      return NextResponse.json({ ok: true, alreadySignedIn: true })
    }

    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const password = String(body?.password ?? '')

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'name, email, phone and password are required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const userRecord = await adminAuth.createUser({ email, password, displayName: name })

    // Auto-generated doc id — deliberately NOT the Auth uid. Every JP
    // collection (jpEnrollments, jpOrders, jpProgress via uid, etc.) already
    // has to cope with students/{id} not matching the owning uid, so this
    // stores `uid` explicitly rather than pretending the ids will ever line
    // up for this student either.
    const studentRef = adminDb.collection('students').doc()
    const now = new Date().toISOString()

    await studentRef.set({
      studentCode: `JPO-${studentRef.id.slice(0, 6).toUpperCase()}`,
      uid: userRecord.uid,
      name,
      nic: '',
      email,
      mobile: phone,
      courseId: 'japan-ssw',
      batchId: 'jp-online',
      branchId: 'online',
      registrationFee: 0,
      status: 'active',
      enrollmentType: 'online',
      createdAt: now,
      createdBy: userRecord.uid,
    })

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName: name,
      role: 'student',
      studentId: studentRef.id,
      createdAt: now,
    })

    const customToken = await adminAuth.createCustomToken(userRecord.uid)
    return NextResponse.json({ ok: true, customToken })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'An account with this email already exists. Try signing in instead.' },
        { status: 409 },
      )
    }
    const message = err instanceof Error ? err.message : 'Signup failed'
    console.error('[api/enrollment/online-signup]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
