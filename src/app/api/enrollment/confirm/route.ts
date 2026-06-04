import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'
import { generateTempPassword } from '@/lib/enrollment/helpers'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'owner', 'reception']
const PROGRAM_COURSE_MAP: Record<string, string> = {
  'japan-ssw': 'japan-ssw',
  korea: 'korea-d2d4',
  china: 'china',
  ielts: 'ielts',
  nvq: 'nvq-it',
}

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

    const { enrollmentId } = await req.json()
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
    const tempPassword = generateTempPassword()

    const userRecord = await adminAuth.createUser({
      email,
      password: tempPassword,
      displayName: fullName,
    })

    const allSnap = await adminDb.collection('students').get()
    const year = new Date().getFullYear()
    const seq = String(allSnap.size + 1).padStart(3, '0')
    const studentCode = `EC-${year}-${seq}`
    const courseId = PROGRAM_COURSE_MAP[String(e.program)] ?? 'japan-ssw'
    const parentAccessCode = String(Math.floor(100000 + Math.random() * 900000))

    await adminDb.collection('students').doc(userRecord.uid).set({
      studentCode,
      uid: userRecord.uid,
      name: fullName,
      nic: '',
      email,
      mobile: phone,
      address: String(e.address ?? ''),
      dateOfBirth: String(e.dateOfBirth ?? ''),
      courseId,
      batchId: `${courseId}-${year}`,
      branchId: 'galle',
      location: String(e.location ?? 'galle'),
      batchDuration: String(e.batchDuration ?? '45days'),
      batchCustomDays: e.batchCustomDays ?? null,
      registrationFee: 25_000,
      feeAmount: 85_000,
      feeCurrency: 'LKR',
      paymentStatus: e.courseFeePaid ? 'paid' : e.registrationFeePaid ? 'partial' : 'pending',
      status: 'active',
      visaStatus: 'not-started',
      parentAccessCode,
      parentAccessEnabled: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: staffUid,
    })

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName: fullName,
      role: 'student',
      studentId: userRecord.uid,
      createdAt: new Date().toISOString(),
    })

    await enrollRef.update({
      studentId: userRecord.uid,
      status: 'confirmed',
    })

    if (phone) {
      await sendWhatsApp(
        phone,
        `Hi ${fullName}, welcome to EPIC Campus! 🎉\n\nYour student account is ready.\nEmail: ${email}\nPassword: ${tempPassword}\n\nLogin at: epiccampus.live\n\nSee you soon! — EPIC Campus`,
      )
    }

    return NextResponse.json({ uid: userRecord.uid, studentCode })
  } catch (err) {
    console.error('[enrollment/confirm]', err)
    const message = err instanceof Error ? err.message : 'Failed to create account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
