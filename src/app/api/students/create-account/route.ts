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

const STAFF_ROLES = ['admin', 'owner', 'reception']

async function verifyStaff(req: NextRequest): Promise<{ uid: string; role: string } | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    if (!STAFF_ROLES.includes(role)) return null
    return { uid: decoded.uid, role }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await verifyStaff(req)
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      email,
      password: providedPassword,
      displayName,
      studentCode: providedStudentCode,
      enrollmentId,
      phone,
      address,
      dateOfBirth,
      program,
      location,
      batchIntake,
      batchDuration,
      batchCustomDays,
      registrationFeePaid,
      courseFeePaid,
      totalPaid,
    } = body

    let resolvedEmail = String(email ?? '')
    let resolvedName = String(displayName ?? '')
    let resolvedPhone = String(phone ?? '')
    let resolvedProgram = program ? String(program) : 'japan-ssw'
    let resolvedLocation = location ? String(location) : 'galle'
    let resolvedBatchDuration = batchDuration ? String(batchDuration) : '45days'
    let resolvedAddress = String(address ?? '')
    let resolvedDob = String(dateOfBirth ?? '')
    let resolvedRegPaid = Boolean(registrationFeePaid)
    let resolvedCoursePaid = Boolean(courseFeePaid)
    let resolvedTotalPaid = Number(totalPaid ?? 0)

    if (enrollmentId) {
      const enrollSnap = await adminDb
        .collection('enrollmentApplications')
        .doc(String(enrollmentId))
        .get()
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
      resolvedEmail = String(e.email ?? resolvedEmail)
      resolvedName =
        resolvedName ||
        `${String(e.firstName ?? '')} ${String(e.lastName ?? '')}`.trim()
      resolvedPhone = String(e.phone ?? resolvedPhone)
      resolvedProgram = String(e.program ?? resolvedProgram)
      resolvedLocation = String(location ?? e.location ?? 'galle')
      resolvedBatchDuration = String(e.batchDuration ?? resolvedBatchDuration)
      resolvedAddress = String(e.address ?? resolvedAddress)
      resolvedDob = String(e.dateOfBirth ?? resolvedDob)
      resolvedRegPaid = Boolean(e.registrationFeePaid)
      resolvedCoursePaid = Boolean(e.courseFeePaid)
      resolvedTotalPaid = Number(e.totalPaid ?? resolvedTotalPaid)
    }

    if (!resolvedEmail || !resolvedName) {
      return NextResponse.json(
        { error: 'email and displayName are required' },
        { status: 400 },
      )
    }

    const studentCode =
      String(providedStudentCode ?? '').trim() || (await generateStudentCode())
    const password =
      String(providedPassword ?? '').trim() ||
      generateEnrollmentPassword(resolvedName.split(/\s+/)[0] ?? 'Student', resolvedPhone)

    const result = await createStudentAccount({
      email: resolvedEmail,
      password,
      displayName: resolvedName,
      studentCode,
      phone: resolvedPhone,
      address: resolvedAddress,
      dateOfBirth: resolvedDob,
      program: resolvedProgram,
      location: resolvedLocation,
      batchIntake: batchIntake ? String(batchIntake) : undefined,
      batchDuration: resolvedBatchDuration,
      batchCustomDays: batchCustomDays ?? null,
      registrationFeePaid: resolvedRegPaid,
      courseFeePaid: resolvedCoursePaid,
      totalPaid: resolvedTotalPaid,
      createdBy: staff.uid,
    })

    if (enrollmentId) {
      await adminDb
        .collection('enrollmentApplications')
        .doc(String(enrollmentId))
        .update({
          studentId: result.uid,
          status: 'confirmed',
          studentCode: result.studentCode,
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: staff.uid,
        })
    }

    if (resolvedPhone) {
      const firstName = resolvedName.split(/\s+/)[0] || resolvedName
      await sendWhatsApp(
        resolvedPhone,
        `🎉 Welcome to Epic Campus, ${firstName}!\nYour account has been created.\nLogin at: www.epiccampus.live/login\nEmail: ${result.email}\nPassword: ${result.password}\nPlease change your password after first login.\n📞 Questions? Call us: 076 254 8383`,
      )
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Account creation failed'
    console.error('[api/students/create-account]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
