import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio/helpers'
import { buildCredentialsMessage, normalizeLkPhone } from '@/lib/students/credentialsMessage'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'owner', 'reception']

async function verifyStaff(
  req: NextRequest,
): Promise<{ uid: string; role: string; email: string } | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    if (!STAFF_ROLES.includes(role)) return null
    return { uid: decoded.uid, role, email: String(snap.data()?.email ?? decoded.email ?? '') }
  } catch {
    return null
  }
}

/** Resets an existing student's Firebase Auth password to a caller-supplied
 *  value and WhatsApps them the new credentials. Used for students already in
 *  the system whose original generated password was never stored. */
export async function POST(req: NextRequest) {
  try {
    const staff = await verifyStaff(req)
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { studentId, uid, phone, email, studentName, studentCode, newPassword } =
      (await req.json()) as {
        studentId?: string
        uid?: string
        phone?: string
        email?: string
        studentName?: string
        studentCode?: string
        newPassword?: string
      }

    if (!phone || !newPassword) {
      return NextResponse.json({ error: 'phone and newPassword are required' }, { status: 400 })
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Resolve the student's Firebase Auth uid: explicit uid > student doc's uid > email lookup.
    let authUid = uid ? String(uid) : ''
    if (!authUid && studentId) {
      const studentSnap = await adminDb.collection('students').doc(String(studentId)).get()
      authUid = String(studentSnap.data()?.uid ?? '')
    }
    if (!authUid && email) {
      const userRecord = await adminAuth.getUserByEmail(String(email)).catch(() => null)
      authUid = userRecord?.uid ?? ''
    }
    if (!authUid) {
      return NextResponse.json(
        { error: 'This student has no login account yet. Create one from the student form first.' },
        { status: 400 },
      )
    }

    await adminAuth.updateUser(authUid, { password: String(newPassword) })

    const to = normalizeLkPhone(String(phone))
    if (!to) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const resolvedEmail = String(email ?? '')
    const message = buildCredentialsMessage({
      studentName: String(studentName ?? 'Student'),
      email: resolvedEmail,
      password: String(newPassword),
      studentCode: String(studentCode ?? ''),
    })
    const sent = await sendWhatsApp(to, message)

    // Log the action (server-only write; adminDb bypasses rules). Matches the
    // existing auditLog collection shape (parseAuditLog).
    try {
      await adminDb.collection('auditLog').add({
        userId: staff.uid,
        userEmail: staff.email,
        userRole: staff.role,
        action: 'credentials_sent',
        entityType: 'student',
        entityId: String(studentId ?? authUid),
        details: `Reset password & sent credentials to ${studentName ?? resolvedEmail} via WhatsApp`,
        createdAt: FieldValue.serverTimestamp(),
      })
    } catch (logErr) {
      console.warn('[reset-and-send] audit log skipped:', logErr)
    }

    if (!sent) {
      // Password WAS reset — surface that so reception can share it another way.
      return NextResponse.json(
        {
          success: false,
          passwordReset: true,
          error: 'Password reset, but WhatsApp could not be sent. Share the password manually.',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, passwordReset: true })
  } catch (err) {
    console.error('[students/reset-and-send]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
