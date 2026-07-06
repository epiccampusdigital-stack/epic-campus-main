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
    const { staffId, approvedBy } = await req.json()

    if (!staffId || !approvedBy) {
      return NextResponse.json(
        { error: 'staffId and approvedBy are required' },
        { status: 400 },
      )
    }

    const staffRef = adminDb.collection('users').doc(staffId)
    const staffSnap = await staffRef.get()

    if (!staffSnap.exists) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const data = staffSnap.data()!
    if (data.role === 'student') {
      return NextResponse.json({ error: 'Cannot approve student as staff' }, { status: 400 })
    }
    if (data.status === 'active' && data.uid) {
      return NextResponse.json({ uid: data.uid, alreadyActive: true })
    }

    const email = String(data.email ?? '')
    const displayName = String(data.displayName ?? '')
    if (!email) {
      return NextResponse.json({ error: 'Staff email is required for approval' }, { status: 400 })
    }

    const password =
      `Epic${Math.random().toString(36).slice(2, 6)}${Math.floor(Math.random() * 90 + 10)}!`

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    })

    const now = new Date().toISOString()
    const payload = {
      ...data,
      uid: userRecord.uid,
      status: 'active',
      approvedBy,
      approvedAt: now,
    }

    await adminDb.collection('users').doc(userRecord.uid).set(payload)
    if (data.role && typeof data.role === 'string') {
      await adminAuth.setCustomUserClaims(userRecord.uid, { role: data.role })
    }

    if (staffId !== userRecord.uid) {
      await staffRef.delete()
    }

    return NextResponse.json({ uid: userRecord.uid, password })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Approval failed'
    console.error('[api/staff/approve]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
