import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { getJpOrder, markOrderPaid } from '@/lib/jp/orders'

export const dynamic = 'force-dynamic'

// Staff approval of a bank-transfer order awaiting verification. Funnels
// through the same markOrderPaid every other rail uses (Stripe webhook,
// PayPal capture) — this is not a second way to grant access.
export async function POST(req: NextRequest) {
  const staff = await verifyJpRole(req, ['admin', 'owner', 'accountant'])
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const order = await getJpOrder(orderId)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const updated = await markOrderPaid(orderId, order.paymentRef ?? `manual-${orderId}`, order.rail)
    await adminDb.collection('jpOrders').doc(orderId).set({ verifiedBy: staff.uid }, { merge: true })

    return NextResponse.json({ order: { ...updated, verifiedBy: staff.uid } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to approve order'
    console.error('[api/jp/orders/approve]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
