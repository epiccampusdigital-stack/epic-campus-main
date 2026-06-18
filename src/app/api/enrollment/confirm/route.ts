import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'
import {
  createStudentAccount,
  generateEnrollmentPassword,
  generateStudentCode,
} from '@/lib/students/createStudentAccount'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'owner', 'reception']

async function verifyStaff(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return ALLOWED_ROLES.includes(role) ? decoded.uid : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const staffUid = await verifyStaff(req)
    if (!staffUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { enrollmentId, studentCode, location, batchIntake } = await req.json()
    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
    }

    const enrollRef = adminDb.collection('enrollmentApplications').doc(String(enrollmentId))
    const enrollSnap = await enrollRef.get()
    if (!enrollSnap.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    const e = enrollSnap.data()!
    if (e.studentId) {
      return NextResponse.json(
        { error: 'Student account already exists for this enrollment' },
        { status: 400 },
      )
    }

    const fullName = `${String(e.firstName ?? '')} ${String(e.lastName ?? '')}`.trim()
    const email = String(e.email ?? '')
    const phone = String(e.phone ?? '')
    const resolvedStudentCode =
      String(studentCode ?? '').trim() || (await generateStudentCode())
    const password = generateEnrollmentPassword(String(e.firstName ?? 'Student'), phone)

    const result = await createStudentAccount({
      email,
      password,
      displayName: fullName,
      studentCode: resolvedStudentCode,
      phone,
      address: String(e.address ?? ''),
      dateOfBirth: String(e.dateOfBirth ?? ''),
      program: String(e.program ?? 'japan-ssw'),
      location: String(location ?? e.location ?? 'galle'),
      batchIntake: batchIntake ? String(batchIntake) : undefined,
      batchDuration: String(e.batchDuration ?? '45days'),
      batchCustomDays: e.batchCustomDays ?? null,
      registrationFeePaid: Boolean(e.registrationFeePaid),
      courseFeePaid: Boolean(e.courseFeePaid),
      totalPaid: Number(e.totalPaid ?? 0),
      createdBy: staffUid,
    })

    await enrollRef.update({
      studentId: result.uid,
      status: 'confirmed',
      studentCode: result.studentCode,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: staffUid,
    })

    if (phone) {
      const firstName = String(e.firstName ?? fullName)
      await sendWhatsApp(
        phone,
        `🎉 Welcome to Epic Campus, ${firstName}!\nYour account has been created.\nLogin at: www.epiccampus.live/login\nEmail: ${result.email}\nPassword: ${result.password}\nPlease change your password after first login.\n📞 Questions? Call us: 076 254 8383`,
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[enrollment/confirm]', err)
    const message = err instanceof Error ? err.message : 'Failed to create account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
