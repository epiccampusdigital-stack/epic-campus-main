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

/** Activates or repairs a student's login. Loads the student doc by studentId, then:
 *  - if it has a uid → updates that Firebase Auth account's email + password;
 *  - if it has no uid (student added manually) OR the uid is stale → creates a fresh
 *    Auth account, stamps role=student, and writes the uid back to Firestore.
 *  Works for students who never had an Auth account. */
export async function POST(req: NextRequest) {
  try {
    const staffUid = await verifyStaff(req)
    if (!staffUid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { uid: bodyUid, email, loginEmail, password, loginType, studentId } = (await req.json()) as {
      uid?: string
      email?: string
      loginEmail?: string
      password?: string
      loginType?: string
      studentId?: string
    }

    // Prefer an explicit loginEmail (staff can set ANY login); fall back to legacy `email`.
    const finalEmail = String(loginEmail ?? email ?? '').trim()

    if (!studentId || !finalEmail || !password) {
      return NextResponse.json(
        { success: false, error: 'studentId, loginEmail and password are required' },
        { status: 400 },
      )
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 },
      )
    }

    const passwordStr = String(password)
    const now = new Date().toISOString()

    // Step 1 — Load the student doc (source of truth for the uid + display name).
    const studentRef = adminDb.collection('students').doc(String(studentId))
    const studentSnap = await studentRef.get()
    if (!studentSnap.exists) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 })
    }
    const student = (studentSnap.data() ?? {}) as Record<string, unknown>
    const displayName = String(student.name ?? student.fullName ?? '')

    // Step 2 — Update the existing Auth account, or create a fresh one when the
    // student has no uid (manual add) or the stored uid is stale.
    let uid = String(student.uid ?? bodyUid ?? '')
    let created = false

    if (uid) {
      try {
        await adminAuth.updateUser(uid, { email: finalEmail, password: passwordStr })
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'auth/user-not-found') {
          uid = '' // stale uid — fall through to create
        } else {
          throw err
        }
      }
    }

    if (!uid) {
      const newUser = await adminAuth.createUser({
        email: finalEmail,
        password: passwordStr,
        displayName,
      })
      uid = newUser.uid
      created = true
    }

    // Ensure the student role claim is present in every case (idempotent).
    await adminAuth.setCustomUserClaims(uid, { role: 'student' })

    // Step 3 — Persist loginEmail + uid onto the student doc. `email` mirrors the
    // auth identity; personalEmail is never touched. lastPassword is stored in PLAIN
    // TEXT intentionally, for front-desk staff credential recovery (admin-only view).
    await studentRef.set(
      {
        loginEmail: finalEmail,
        email: finalEmail,
        uid,
        lastPassword: passwordStr,
        loginType: loginType ? String(loginType) : null,
        lastLoginSetAt: now,
        updatedAt: now,
      },
      { merge: true },
    )

    // Create/update the users/{uid} doc used for role + redirect resolution.
    await adminDb.collection('users').doc(uid).set(
      {
        uid,
        email: finalEmail,
        displayName,
        role: 'student',
        studentId: String(studentId),
        ...(created ? { createdAt: now } : { updatedAt: now }),
      },
      { merge: true },
    )

    return NextResponse.json({ success: true, uid })
  } catch (err) {
    // A login email already claimed by a DIFFERENT Auth account.
    if ((err as { code?: string }).code === 'auth/email-already-exists') {
      return NextResponse.json(
        { success: false, error: 'This email is already used by another account. Use a different email.' },
        { status: 400 },
      )
    }
    console.error('[students/set-login]', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
