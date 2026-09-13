import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { rejectOrder } from '@/lib/jp/orders'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const staff = await verifyJpRole(req, ['admin', 'owner', 'accountant'])
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { orderId, reason } = await req.json()
    if (!orderId || !reason) {
      return NextResponse.json({ error: 'orderId and reason are required' }, { status: 400 })
    }

    const updated = await rejectOrder(orderId, String(reason))
    await adminDb.collection('jpOrders').doc(orderId).set({ verifiedBy: staff.uid }, { merge: true })

    return NextResponse.json({ order: { ...updated, verifiedBy: staff.uid } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reject order'
    console.error('[api/jp/orders/reject]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
