import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const callerSnap = await adminDb.collection('users').doc(decoded.uid).get()
    const callerRole = String(callerSnap.data()?.role ?? '')

    if (callerRole !== 'admin' && callerRole !== 'owner') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { studentId } = await req.json()
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }

    const studentRef = adminDb.collection('students').doc(String(studentId))
    const studentSnap = await studentRef.get()
    if (!studentSnap.exists) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const parentUid = studentSnap.data()?.parentId
      ? String(studentSnap.data()?.parentId)
      : null

    const parentsSnap = await adminDb
      .collection('parentAccounts')
      .where('studentId', '==', studentId)
      .get()

    const batch = adminDb.batch()
    for (const doc of parentsSnap.docs) {
      batch.delete(doc.ref)
    }
    await batch.commit()

    await studentRef.update({
      parentId: null,
      parentAccessEnabled: false,
    })

    if (parentUid) {
      try {
        await adminDb.collection('users').doc(parentUid).delete()
        await adminAuth.deleteUser(parentUid)
      } catch (err) {
        console.warn('[parent/remove-access] Could not delete parent auth:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[parent/remove-access]', err)
    const message = err instanceof Error ? err.message : 'Failed to remove access'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
