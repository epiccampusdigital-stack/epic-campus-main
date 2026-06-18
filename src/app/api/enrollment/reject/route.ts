import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

async function verifyStaff(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    if (!['admin', 'owner', 'reception'].includes(role)) return null
    return decoded.uid
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const staffUid = await verifyStaff(req)
  if (!staffUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enrollmentId, rejectionReason } = await req.json()
  if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 })

  const enrollRef = adminDb.collection('enrollmentApplications').doc(String(enrollmentId))
  const enrollSnap = await enrollRef.get()
  if (!enrollSnap.exists) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const e = enrollSnap.data()!
  const phone = String(e.phone ?? '')
  const fullName = `${String(e.firstName ?? '')} ${String(e.lastName ?? '')}`.trim()

  await enrollRef.update({
    status: 'rejected',
    rejectionReason: rejectionReason ? String(rejectionReason) : '',
    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy: staffUid,
  })

  if (phone) {
    await sendWhatsApp(
      phone,
      `We're sorry, your enrollment could not be approved at this time. Please contact us: 076 254 8383`,
    )
  }

  return NextResponse.json({ ok: true, name: fullName })
}
