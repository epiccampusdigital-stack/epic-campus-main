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
      idNumber,
      loginEmail,
      personalEmail,
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
      // Real enrollment/fee data — takes priority over the legacy
      // registrationFeePaid/courseFeePaid/totalPaid-derived defaults.
      feeAmount,
      paymentStatus,
      paidAmount,
      pendingAmount,
      courseId,
      batchId,
      agentId,
      notes,
    } = body

    // Student ID login: when an idNumber is supplied, the Firebase Auth email is the
    // synthetic {idNumber}@epiccampus.lk (the Student ID is the username). The real
    // address is kept separately as personalEmail and never used for auth.
    const resolvedIdNumber = idNumber != null ? String(idNumber) : undefined
    const resolvedLoginEmail = resolvedIdNumber
      ? `${resolvedIdNumber}@epiccampus.lk`
      : loginEmail
        ? String(loginEmail)
        : undefined
    const resolvedPersonalEmail = personalEmail ? String(personalEmail) : undefined

    let resolvedEmail = resolvedLoginEmail ?? String(email ?? '')
    let resolvedName = String(displayName ?? '')
    let resolvedPhone = String(phone ?? '')
    // Left undefined (not defaulted) unless actually provided — createStudentAccount()
    // needs to tell "no course/location sent" apart from "sent as the default value"
    // so a bare login-creation request never overwrites a real record's real data.
    let resolvedProgram: string | undefined = program ? String(program) : undefined
    let resolvedLocation: string | undefined = location ? String(location) : undefined
    let resolvedBatchDuration: string | undefined = batchDuration ? String(batchDuration) : undefined
    let resolvedAddress = String(address ?? '')
    let resolvedDob = String(dateOfBirth ?? '')
    let resolvedRegPaid = Boolean(registrationFeePaid)
    let resolvedCoursePaid = Boolean(courseFeePaid)
    let resolvedTotalPaid = Number(totalPaid ?? 0)
    let resolvedFeeAmount: number | undefined = feeAmount != null ? Number(feeAmount) : undefined
    let resolvedPaymentStatus: string | undefined = paymentStatus ?? undefined
    let resolvedPaidAmount: number | undefined = paidAmount != null ? Number(paidAmount) : undefined
    let resolvedCourseId: string | undefined = courseId ? String(courseId) : undefined
    let resolvedBatchId: string | undefined = batchId ? String(batchId) : undefined
    let resolvedAgentId: string | null | undefined = agentId ?? undefined

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
      resolvedProgram = e.program ? String(e.program) : resolvedProgram
      resolvedLocation = location ? String(location) : e.location ? String(e.location) : resolvedLocation
      resolvedBatchDuration = e.batchDuration ? String(e.batchDuration) : resolvedBatchDuration
      resolvedAddress = String(e.address ?? resolvedAddress)
      resolvedDob = String(e.dateOfBirth ?? resolvedDob)
      resolvedRegPaid = Boolean(e.registrationFeePaid)
      resolvedCoursePaid = Boolean(e.courseFeePaid)
      resolvedTotalPaid = Number(e.totalPaid ?? resolvedTotalPaid)
      resolvedFeeAmount = resolvedFeeAmount ?? (e.totalFee != null ? Number(e.totalFee) : e.feeAmount != null ? Number(e.feeAmount) : undefined)
      resolvedPaymentStatus = resolvedPaymentStatus ?? (e.paymentStatus ? String(e.paymentStatus) : undefined)
      resolvedPaidAmount = resolvedPaidAmount ?? (e.paidAmount != null ? Number(e.paidAmount) : undefined)
      resolvedCourseId = resolvedCourseId ?? (e.courseId ? String(e.courseId) : undefined)
      resolvedBatchId = resolvedBatchId ?? (e.batch ? String(e.batch) : e.batchId ? String(e.batchId) : undefined)
      resolvedAgentId = resolvedAgentId ?? (e.agentId ? String(e.agentId) : undefined)
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
      feeAmount: resolvedFeeAmount,
      paymentStatus: resolvedPaymentStatus,
      paidAmount: resolvedPaidAmount,
      pendingAmount: pendingAmount != null ? Number(pendingAmount) : undefined,
      courseId: resolvedCourseId,
      batchId: resolvedBatchId,
      agentId: resolvedAgentId ?? null,
      notes: notes ? String(notes) : undefined,
      idNumber: resolvedIdNumber,
      loginEmail: resolvedLoginEmail,
      personalEmail: resolvedPersonalEmail,
    })

    if (enrollmentId) {
      await adminDb
        .collection('enrollmentApplications')
        .doc(String(enrollmentId))
        .update({
          studentId: result.studentDocId,
          status: 'confirmed',
          studentCode: result.studentCode,
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: staff.uid,
        })
    }

    // Only send login credentials when we actually created a new account —
    // for a reused existing account the real password wasn't changed.
    if (resolvedPhone && result.created) {
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
