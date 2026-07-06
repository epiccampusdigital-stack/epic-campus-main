export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

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

// One-time migration: copies each studentPaymentPlans doc into payments, keyed by
// studentId (matching the convention payments/page.tsx already uses for plan docs),
// merging rather than overwriting so it never clobbers an existing payments doc.
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const snap = await adminDb.collection('studentPaymentPlans').get()
    let migrated = 0
    const skipped: string[] = []
    const errors: string[] = []

    for (const docSnap of snap.docs) {
      const data = docSnap.data()
      const studentId = data.studentId ? String(data.studentId) : ''

      if (!studentId) {
        skipped.push(`${docSnap.id} (no studentId)`)
        continue
      }

      try {
        await adminDb.collection('payments').doc(studentId).set(
          {
            ...data,
            migratedFrom: `studentPaymentPlans/${docSnap.id}`,
            migratedAt: new Date().toISOString(),
          },
          { merge: true },
        )
        migrated += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`${docSnap.id}: ${message}`)
      }
    }

    return NextResponse.json({
      migrated,
      skipped,
      errors,
      total: snap.size,
    })
  } catch (error) {
    console.error('[migrate-payment-plans]', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
